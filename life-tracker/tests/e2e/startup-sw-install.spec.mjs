import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Branch-only diagnostic: same compiled production output for both treatments.
// The deferred case intercepts only the initial native SW registration call.
// No production source, account, backend row or credential is modified.
const BASE = 'http://127.0.0.1:4179';
const OUT = resolve('.mosaic/slow-startup/first-install-registration-ab.json');
const USER = { $id: 'issue858_sw_ab_user', email: 'lab@example.invalid',
  name: 'SW install A/B', prefs: {} };
const THROTTLE = { offline: false, latency: 220, downloadThroughput: 120_000,
  uploadThroughput: 60_000 };
const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0,
  uploadThroughput: 0 };
const MODES = ['immediate', 'deferred'];

async function sample(browser, mode, index) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers: 'allow',
  });
  let releaseAppwrite;
  let appwriteRequests = 0;
  const release = new Promise(done => { releaseAppwrite = done; });
  const requests = [];
  try {
    await context.addInitScript(({ owner, treatment }) => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(owner));
      Object.defineProperty(navigator, 'onLine', {
        configurable: true, get: () => true,
      });
      const sw = navigator.serviceWorker;
      if (!sw) return;
      const nativeRegister = sw.register.bind(sw);
      Object.defineProperty(sw, 'register', {
        configurable: true,
        value(...args) {
          if (treatment === 'immediate') {
            performance.mark('mosaic:lab:sw-register-called');
            return nativeRegister(...args);
          }
          return new Promise((done, fail) => {
            let invoked = false;
            let observer;
            let timeout;
            const start = () => {
              if (invoked) return;
              invoked = true;
              observer?.disconnect();
              clearTimeout(timeout);
              performance.mark('mosaic:lab:sw-register-called');
              nativeRegister(...args).then(done, fail);
            };
            // Existing Home mark is recorded after owner task/category data is
            // locally loaded. A timeout preserves eventual offline installation
            // even if Home cannot complete (e.g. storage failure).
            if (performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length) {
              start();
              return;
            }
            observer = new PerformanceObserver(list => {
              if (list.getEntries().some(entry =>
                entry.name === 'mosaic:home:owner-data-ready')) start();
            });
            observer.observe({ type: 'mark', buffered: true });
            timeout = setTimeout(start, 20_000);
          });
        },
      });
    }, { owner: USER, treatment: mode });
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      appwriteRequests += 1;
      await release;
      await route.abort('failed').catch(() => {});
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await cdp.send('Network.emulateNetworkConditions', THROTTLE);
    const started = Date.now();
    context.on('request', request => {
      if (!request.url().startsWith(BASE)) return;
      requests.push({
        atMs: Date.now() - started,
        type: request.serviceWorker() ? 'worker' : 'page',
        pathname: new URL(request.url()).pathname,
      });
    });
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded', timeout: 75_000 });
    await expect(page.getByRole('grid', { name: /calendar/ }).first())
      .toBeVisible({ timeout: 75_000 });
    await page.waitForFunction(() =>
      performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
      null, { timeout: 75_000 });
    const homeReadyWallMs = Date.now() - started;
    const marks = await page.evaluate(() => {
      const times = ['home:owner-data-ready', 'database:ready',
        'app-shell:module-ready', 'lab:sw-register-called'];
      const record = Object.fromEntries(times.map(name => [name,
        performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null]));
      record.firstContentfulPaint = performance.getEntriesByName(
        'first-contentful-paint', 'paint')[0]?.startTime ?? null;
      return record;
    });
    expect(marks['lab:sw-register-called'], 'SW registration must be intercepted')
      .not.toBeNull();
    if (mode === 'deferred') {
      expect(marks['lab:sw-register-called'])
        .toBeGreaterThanOrEqual(marks['home:owner-data-ready']);
    }
    expect(appwriteRequests, 'Remote Appwrite must remain unresolved').toBeGreaterThan(0);
    await page.evaluate(async () => {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SW install timeout')), 120_000)),
      ]);
    });
    const offlineShellReadyWallMs = Date.now() - started;
    const registrations = await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistrations()).length);
    expect(registrations).toBeGreaterThan(0);

    // The installed app must actually reopen offline with real precached
    // lazy JS, rather than calling registration itself offline readiness.
    await cdp.send('Network.emulateNetworkConditions', OFFLINE);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('grid', { name: /calendar/ }).first())
      .toBeVisible({ timeout: 45_000 });
    const offlineControlled = await page.evaluate(() =>
      Boolean(navigator.serviceWorker.controller));
    expect(offlineControlled, 'offline relaunch must be SW controlled').toBe(true);

    return {
      mode, index, homeReadyMs: Math.round(marks['home:owner-data-ready']),
      homeReadyWallMs, firstContentfulPaintMs: marks.firstContentfulPaint,
      swRegisterMs: Math.round(marks['lab:sw-register-called']),
      swInstalledWallMs: offlineShellReadyWallMs,
      swRequestsBeforeHome: requests.filter(r =>
        r.type === 'worker' && r.atMs <= homeReadyWallMs).length,
      totalWorkerRequests: requests.filter(r => r.type === 'worker').length,
      pageRequestsBeforeHome: requests.filter(r =>
        r.type === 'page' && r.atMs <= homeReadyWallMs).length,
      heldAppwriteRequests: appwriteRequests,
      offlineControlled,
    };
  } finally {
    releaseAppwrite();
    await context.close();
  }
}

const median = ns => {
  const values = [...ns].sort((a, b) => a - b);
  return values[Math.floor((values.length - 1) / 2)];
};

test('@performance #858 first-install worker A/B with cached Home', async ({ browser }) => {
  test.setTimeout(900_000);
  const records = [];
  // Interleave treatments to limit runner warm-up and host-load bias.
  for (let index = 1; index <= 3; index++) {
    for (const mode of index % 2 ? MODES : [...MODES].reverse()) {
      const row = await sample(browser, mode, index);
      records.push(row);
      console.log('MOSAIC_858_SW_AB_SAMPLE ' + JSON.stringify(row));
    }
  }
  const summary = Object.fromEntries(MODES.map(mode => {
    const rows = records.filter(row => row.mode === mode);
    return [mode, {
      count: rows.length,
      medianHomeReadyMs: median(rows.map(row => row.homeReadyMs)),
      medianFirstContentfulPaintMs: median(rows.map(row => row.firstContentfulPaintMs)),
      medianFullOfflineReadyMs: median(rows.map(row => row.swInstalledWallMs)),
    }];
  }));
  const result = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA || 'local',
    comparison: 'unchanged production app build; native SW register intercepted before navigation',
    environment: {
      chromium: 'Linux runner mobile viewport, 2x CPU throttle, slow network CDP',
      throttle: THROTTLE,
      backend: 'synthetic cached identity, remote Appwrite held unresolved',
      limitations: [
        'Not a physical phone, cellular carrier, or an authenticated real user.',
        'CDP page-level throttling may not equally affect worker-owned fetches.',
        'Check worker requests and independent network evidence before causal inference.',
        'No product change is proposed if A/B data are inconclusive.',
        'Full offline-ready and Home-ready times measure different milestones.',
      ],
    },
    summary,
    records,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(OUT, JSON.stringify(result, null, 2) + '\n');
  console.log('MOSAIC_858_SW_AB_SUMMARY ' + JSON.stringify(summary));
});
