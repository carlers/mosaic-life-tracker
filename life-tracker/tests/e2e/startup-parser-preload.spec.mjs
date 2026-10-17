import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// No real accounts, backend calls, or permanent browser profile. Preload mode
// is only supported by the DISPOSABLE dist/index.html patch in this lab.
const BASE = 'http://127.0.0.1:4179';
const SLOW = { offline: false, latency: 220, downloadThroughput: 120_000,
  uploadThroughput: 60_000 };
const OWNER = { $id: 'issue858_parser_lab', email: 'lab@example.invalid',
  name: 'Parser Lab', prefs: {} };
const MODES = ['baseline', 'db', 'shell', 'home', 'all'];

async function run(browser, mode, sampleNumber) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    serviceWorkers: 'block',
  });
  let resolveRemote, heldRemote = 0;
  const remote = new Promise(resolve => { resolveRemote = resolve; });
  try {
    await context.addInitScript(owner => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(owner));
      Object.defineProperty(navigator, 'onLine', {
        configurable: true, get: () => true,
      });
    }, OWNER);
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      heldRemote++;
      await remote;
      await route.abort('failed').catch(() => {});
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await cdp.send('Network.emulateNetworkConditions', SLOW);
    const started = Date.now();
    await page.goto(BASE + '/home' + (mode === 'baseline' ? '' : '?preload=' + mode),
      { waitUntil: 'domcontentloaded', timeout: 75_000 });
    await expect(page.getByRole('grid', { name: /calendar/ }).first())
      .toBeVisible({ timeout: 75_000 });
    await page.waitForFunction(() =>
      performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
      null, { timeout: 75_000 });
    const wallMs = Date.now() - started;
    const result = await page.evaluate(() => {
      const mark = name =>
        performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null;
      const resources = performance.getEntriesByType('resource')
        .filter(e => e.name.startsWith(location.origin + '/assets/') && e.name.includes('.js'));
      return {
        homeReadyMs: mark('home:owner-data-ready'),
        appShellReadyMs: mark('app-shell:module-ready'),
        dbModuleReadyMs: mark('database:module-ready'),
        entryStartMs: mark('bootstrap:start'),
        parserPreloadMs: mark('parser-preload-requested'),
        firstContentfulPaintMs: performance.getEntriesByName(
          'first-contentful-paint', 'paint')[0]?.startTime ?? null,
        jsResources: resources.length,
        transferredJsBytes: resources.reduce((sum, e) => sum + e.transferSize, 0),
        importantResources: resources
          .filter(e => /database-|AppDataShell-|HomePage-/.test(e.name))
          .map(e => ({
            file: e.name.split('/').pop(),
            started: Math.round(e.startTime),
            finished: Math.round(e.responseEnd),
            transferredBytes: e.transferSize,
          })),
      };
    });
    expect(heldRemote).toBeGreaterThan(0);
    expect(result.parserPreloadMs !== null).toBe(mode !== 'baseline');
    expect(result.homeReadyMs).not.toBeNull();
    if (mode !== 'baseline') {
      expect(result.parserPreloadMs).toBeLessThan(result.entryStartMs);
    }
    return { mode, sampleNumber, wallMs, ...result, heldAppwrite: heldRemote };
  } finally {
    resolveRemote();
    await context.close();
  }
}
const med = rows => {
  const sorted = rows.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};
test('@performance #858 passive browser modulepreload before React entry', async ({ browser }) => {
  test.setTimeout(950_000);
  const records = [];
  // Rotate baseline position and candidate order to reduce runner drift bias.
  for (let i = 1; i <= 3; i++) {
    const modes = i === 1 ? MODES : i === 2
      ? [...MODES].reverse() : ['shell', 'home', 'baseline', 'all', 'db'];
    for (const mode of modes) {
      const record = await run(browser, mode, i);
      records.push(record);
      console.log('MOSAIC_858_PRELOAD_SAMPLE ' + JSON.stringify(record));
    }
  }
  const summary = Object.fromEntries(MODES.map(mode => {
    const rows = records.filter(x => x.mode === mode);
    return [mode, {
      n: rows.length, medianHomeReadyMs: med(rows.map(x => x.homeReadyMs)),
      medianAppShellReadyMs: med(rows.map(x => x.appShellReadyMs)),
      medianDbReadyMs: med(rows.map(x => x.dbModuleReadyMs)),
      medianFirstPaintMs: med(rows.map(x => x.firstContentfulPaintMs)),
      medianWallMs: med(rows.map(x => x.wallMs)),
      medianJsRequests: med(rows.map(x => x.jsResources)),
      medianJsBytes: med(rows.map(x => x.transferredJsBytes)),
    }];
  }));
  const report = {
    sha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    limits: 'synthetic Chromium, 2x CPU, slow CDP network, no SW, no real accounts',
    note: 'Disposable dist mutation invalidates production SW precache; do not deploy directly',
    summary, records,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(resolve('.mosaic/slow-startup/parser-preload-ab.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_PRELOAD_SUMMARY ' + JSON.stringify(summary));
});
