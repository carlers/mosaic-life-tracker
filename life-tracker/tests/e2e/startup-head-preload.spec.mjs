import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Synthetic cached owner / signed-out Login; no real Appwrite credentials.
const BASE = 'http://127.0.0.1:4179';
const USER = { $id: 'issue858_head_lab', name: 'Head preload Lab',
  email: 'lab@example.invalid', prefs: {} };
const THROTTLE = { offline: false, latency: 220,
  downloadThroughput: 120_000, uploadThroughput: 60_000 };
const MARKS = [
  'head-preload-requested', 'bootstrap:start', 'database:import-start',
  'database:module-ready', 'database:ready', 'app-shell:import-start',
  'app-shell:module-ready', 'home:owner-data-ready', 'home:mounted',
];

async function run(browser, scenario, iteration) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    serviceWorkers: 'block',
  });
  let remoteRequests = 0;
  let unblockRemote;
  const held = new Promise(resolve => { unblockRemote = resolve; });
  try {
    await context.addInitScript(({ owner, scenario }) => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true, get: () => true,
      });
      if (scenario === 'cached-home') {
        localStorage.setItem('mosaic_last_known_user', JSON.stringify(owner));
      }
    }, { owner: USER, scenario });

    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      remoteRequests++;
      await held;
      await route.abort('failed').catch(() => {});
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await cdp.send('Network.emulateNetworkConditions', THROTTLE);
    const started = Date.now();
    const target = scenario === 'cached-home' ? '/home' : '/login';
    await page.goto(BASE + target, { waitUntil: 'domcontentloaded', timeout: 75_000 });
    if (scenario === 'cached-home') {
      await expect(page.getByRole('grid', { name: /calendar/ }).first())
        .toBeVisible({ timeout: 75_000 });
      await page.waitForFunction(() =>
        performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
        null, { timeout: 75_000 });
    } else {
      await expect(page.getByRole('heading', { name: 'Welcome Back' }))
        .toBeVisible({ timeout: 75_000 });
    }
    const elapsedWallMs = Date.now() - started;
    const record = await page.evaluate(names => {
      const marks = Object.fromEntries(names.map(name => [
        name, performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null,
      ]));
      const resources = performance.getEntriesByType('resource')
        .filter(resource => resource.name.includes('/assets/') && resource.name.endsWith('.js'));
      return {
        marks, firstContentfulPaintMs: performance.getEntriesByName(
          'first-contentful-paint', 'paint')[0]?.startTime ?? null,
        jsRequests: resources.length,
        totalJsTransferBytes: resources.reduce((n, resource) => n + resource.transferSize, 0),
      };
    }, MARKS);
    const variant = process.env.MOSAIC_HEAD_PRELOAD_VARIANT ?? 'unspecified';
    if (scenario === 'cached-home') {
      expect(record.marks['head-preload-requested'] !== null,
        'experiment must be present only in candidate').toBe(variant === 'head');
      if (variant === 'head') {
        expect(record.marks['head-preload-requested'])
          .toBeLessThan(record.marks['bootstrap:start']);
      }
    } else {
      expect(record.marks['head-preload-requested']).toBeNull();
    }
    expect(remoteRequests).toBeGreaterThan(0);
    return {
      variant, scenario, iteration, elapsedWallMs,
      homeReadyMs: record.marks['home:owner-data-ready'],
      firstContentfulPaintMs: record.firstContentfulPaintMs,
      jsRequests: record.jsRequests,
      transferredBytes: record.totalJsTransferBytes,
      markers: record.marks,
      heldAppwriteRequests: remoteRequests,
    };
  } finally {
    unblockRemote();
    await context.close();
  }
}

test('@performance #858 HTML dispatch vs app-entry waterfall on slow cached Home', async ({ browser }) => {
  test.setTimeout(500_000);
  const records = [];
  for (let iteration = 1; iteration <= 4; iteration++) {
    const scenarios = iteration % 2 === 1
      ? ['cached-home', 'login'] : ['login', 'cached-home'];
    for (const scenario of scenarios) {
      const record = await run(browser, scenario, iteration);
      records.push(record);
      console.log('MOSAIC_858_HEAD_SAMPLE ' + JSON.stringify(record));
    }
  }
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[1] + sorted[2]) / 2;
  };
  const summary = Object.fromEntries(['cached-home', 'login'].map(scenario => {
    const rows = records.filter(r => r.scenario === scenario);
    return [scenario, {
      count: rows.length,
      medianWallMs: median(rows.map(r => r.elapsedWallMs)),
      medianFcpMs: median(rows.map(r => r.firstContentfulPaintMs)),
      medianHomeReadyMs: scenario === 'cached-home'
        ? median(rows.map(r => r.homeReadyMs)) : null,
      medianJsRequests: median(rows.map(r => r.jsRequests)),
      medianTransferredBytes: median(rows.map(r => r.transferredBytes)),
    }];
  }));
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    variant: process.env.MOSAIC_HEAD_PRELOAD_VARIANT ?? 'unknown',
    environment: {
      browser: 'Chromium emulated mobile, 2x CPU slowdown, fresh browser contexts',
      network: THROTTLE,
      backend: 'all Appwrite requests held while local Home readies',
      limits: ['synthetic identity/empty RxDB, not a real authenticated phone',
        'CDP slow connection is not actual carrier, 4 samples per scenario',
        'Speculative HTML dynamic imports evaluate modules; import side effects require review'],
    },
    summary, records,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(resolve('.mosaic/slow-startup/head-' + report.variant + '.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_HEAD_SUMMARY ' + JSON.stringify(summary));
});
