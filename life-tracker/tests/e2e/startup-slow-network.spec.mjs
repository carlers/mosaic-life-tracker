import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Deterministic Chromium-only diagnostic using a production Vite build.
// No real credentials, Production/Appwrite traffic, data rows or account access.
// Service-worker repeat launch is intentionally distinct from a cold browser.
const BASE = 'http://127.0.0.1:4179';
const OUTPUT = resolve('.mosaic/slow-startup/slow-startup.json');
const USER = {
  $id: 'issue858_lab_user',
  email: 'lab@example.invalid',
  name: 'Issue 858 Lab',
  prefs: {},
};
const SLOW = {
  offline: false,
  latency: 220,
  downloadThroughput: 120_000,
  uploadThroughput: 60_000,
};
const FAST = {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
};
const MARKS = [
  'bootstrap:start', 'database:import-start', 'database:module-ready',
  'database:create-start', 'database:create-ready',
  'database:collections-start', 'database:collections-ready',
  'database:ready', 'app-shell:import-start',
  'app-shell:module-ready', 'app-shell:database-fallback-visible',
  'app-shell:module-fallback-visible', 'app-data-shell:mounted',
  'home:mounted', 'home:owner-data-ready',
];
function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
}
const round = n => Number.isFinite(n) ? Math.round(n) : null;

async function run(browser, scenario, iteration) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: scenario === 'pwa-cached-assets' ? 'allow' : 'block',
  });
  let releaseRemote;
  let pendingRemoteRequests = 0;
  let pending = false;
  const heldRemote = new Promise(resolve => { releaseRemote = resolve; });
  try {
    await context.addInitScript((user) => {
      // Browser reports online so auth attempts its real asynchronous probe.
      Object.defineProperty(navigator, 'onLine', {
        configurable: true, get: () => true,
      });
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
    }, USER);
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      pendingRemoteRequests += 1;
      pending = true;
      await heldRemote;
      await route.abort('failed').catch(() => {});
    });

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    const readyHome = async () => {
      await expect(page.getByRole('grid', { name: /calendar/ }).first())
        .toBeVisible({ timeout: 75_000 });
      await page.waitForFunction(() =>
        performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
        null, { timeout: 75_000 });
    };

    let serviceWorkerControlled = false;
    if (scenario === 'pwa-cached-assets') {
      // Install and populate the real VitePWA precache on fast network before
      // timing a slow repeat navigation in the same isolated browser profile.
      await cdp.send('Network.emulateNetworkConditions', FAST);
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
      await readyHome();
      await page.evaluate(() => navigator.serviceWorker.ready);
      // A newly installed worker begins controlling on the next navigation.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await readyHome();
      serviceWorkerControlled = await page.evaluate(() =>
        Boolean(navigator.serviceWorker.controller));
      expect(serviceWorkerControlled, 'PWA repeat run needs an active controller').toBe(true);
    }
    await cdp.send('Network.emulateNetworkConditions',
      scenario === 'fast-assets' ? FAST : SLOW);
    const started = Date.now();
    if (scenario === 'pwa-cached-assets') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 75_000 });
    } else {
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded', timeout: 75_000 });
    }
    await readyHome();

    const record = await page.evaluate(({ scenario, iteration, markNames }) => {
      const round = n => Number.isFinite(n) ? Math.round(n) : null;
      const values = Object.fromEntries(markNames.map(name => [
        name,
        performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null,
      ]));
      const delta = (from, to) => values[from] !== null && values[to] !== null
        ? round(values[to] - values[from]) : null;
      const slowAssets = performance.getEntriesByType('resource')
        .filter(e => e.name.startsWith(location.origin + '/'))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(e => ({
          // Only code asset basename; never record request query or user data.
          file: new URL(e.name).pathname.split('/').pop(),
          durationMs: round(e.duration),
          transferredBytes: e.transferSize,
          decodedBytes: e.decodedBodySize,
          initiator: e.initiatorType,
        }));
      return {
        scenario, iteration,
        homeReadyMs: round(values['home:owner-data-ready']),
        homeMountedMs: round(values['home:mounted']),
        databaseModuleMs: delta('database:import-start', 'database:module-ready'),
        databaseOpenMs: delta('database:create-start', 'database:create-ready'),
        collectionsMs: delta('database:collections-start', 'database:collections-ready'),
        appShellModuleMs: delta('app-shell:import-start', 'app-shell:module-ready'),
        databaseReadyMs: round(values['database:ready']),
        marks: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, round(v)])),
        slowAssets,
      };
    }, { scenario, iteration, markNames: MARKS });
    record.wallClockMs = Date.now() - started;
    record.serviceWorkerControlled = serviceWorkerControlled;
    record.heldAppwriteRequests = pendingRemoteRequests;
    expect(record.homeReadyMs).not.toBeNull();
    expect(pending, 'Appwrite must remain unresolved during local Home startup').toBe(true);
    console.log('MOSAIC_858_SLOW_STARTUP ' + JSON.stringify(record));
    return record;
  } finally {
    releaseRemote();
    await context.close();
  }
}

test('@performance Issue 858 cached Home under independently throttled assets and Appwrite', async ({ browser }) => {
  test.setTimeout(500_000);
  const modes = ['fast-assets', 'slow-assets', 'pwa-cached-assets'];
  const rows = [];
  for (const mode of modes) {
    for (let i = 1; i <= 2; i++) {
      rows.push(await run(browser, mode, i));
    }
  }
  const summary = Object.fromEntries(modes.map(mode => {
    const records = rows.filter(r => r.scenario === mode);
    return [mode, {
      samples: records.length,
      homeReadyMedianMs: percentile(records.map(r => r.homeReadyMs), .5),
      homeReadyP90Ms: percentile(records.map(r => r.homeReadyMs), .9),
      databaseModuleMedianMs: percentile(records.map(r => r.databaseModuleMs), .5),
      appShellModuleMedianMs: percentile(records.map(r => r.appShellModuleMs), .5),
      databaseOpenMedianMs: percentile(records.map(r => r.databaseOpenMs), .5),
    }];
  }));
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    environment: {
      chromium: 'headless, mobile viewport, 2x CPU throttle, Ubuntu GitHub runner',
      slowNetwork: SLOW,
      backend: 'all Appwrite requests held unresolved until local Home readiness',
      profiles: 'synthetic cached identity; fresh local DB except warmed PWA repeat',
      limitations: [
        'Not a physical phone or logged-in real Appwrite account.',
        'No real user data. PWA repeat uses synthetic empty account.',
        'Local Vite Preview hosting does not simulate carrier/CDN behavior.',
        '120 kB/s throttling covers same-origin assets, not solely the Appwrite API.',
        'Two samples per scenario establish a controlled comparison, not a fleet-level SLA.',
      ],
    },
    summary, rows,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_SUMMARY ' + JSON.stringify(summary));
});
