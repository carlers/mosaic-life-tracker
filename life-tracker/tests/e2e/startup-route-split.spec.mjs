import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Paired same-runner Vite production builds; no real data or Appwrite response.
const BASE = 'http://127.0.0.1:4179';
const SLOW = { offline: false, latency: 220,
  downloadThroughput: 120_000, uploadThroughput: 60_000 };
const OWNER = { $id: 'issue858_route_lab', name: 'Route split Lab',
  email: 'lab@example.invalid', prefs: {} };

async function measure(browser, scenario, sampleNumber) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    serviceWorkers: 'block',
  });
  let remoteCount = 0;
  let release;
  const wait = new Promise(done => { release = done; });
  try {
    await context.addInitScript(({ owner, cached }) => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true, get: () => true,
      });
      if (cached) localStorage.setItem('mosaic_last_known_user', JSON.stringify(owner));
    }, { owner: OWNER, cached: scenario === 'home' });
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      remoteCount += 1;
      await wait;
      await route.abort('failed').catch(() => {});
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await cdp.send('Network.emulateNetworkConditions', SLOW);
    const started = Date.now();
    await page.goto(BASE + (scenario === 'home' ? '/home' : '/login'),
      { waitUntil: 'domcontentloaded', timeout: 75_000 });
    if (scenario === 'home') {
      await expect(page.getByRole('grid', { name: /calendar/ }).first())
        .toBeVisible({ timeout: 75_000 });
      await page.waitForFunction(() =>
        performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
        null, { timeout: 75_000 });
    } else {
      await expect(page.getByRole('heading', { name: 'Welcome Back' }))
        .toBeVisible({ timeout: 75_000 });
    }
    const wallMs = Date.now() - started;
    const timing = await page.evaluate(() => ({
      homeReady: performance.getEntriesByName(
        'mosaic:home:owner-data-ready', 'mark')[0]?.startTime ?? null,
      fcp: performance.getEntriesByName('first-contentful-paint', 'paint')[0]?.startTime ?? null,
      domContentLoaded: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? null,
      scriptResources: performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('/assets/') && entry.name.includes('.js'))
        .length,
    }));
    expect(remoteCount, 'Appwrite must remain blocked').toBeGreaterThan(0);
    return { scenario, sampleNumber, variant: process.env.MOSAIC_AUTH_ROUTE_VARIANT,
      wallMs, homeReadyMs: timing.homeReady,
      firstContentfulPaintMs: timing.fcp,
      domContentLoadedMs: timing.domContentLoaded,
      jsResources: timing.scriptResources, heldRemote: remoteCount };
  } finally {
    release();
    await context.close();
  }
}

test('@performance #858 compare auth-route split and Login cold startup', async ({ browser }) => {
  test.setTimeout(450_000);
  const records = [];
  for (let i = 1; i <= 3; i++) {
    const scenarios = i % 2 ? ['home', 'login'] : ['login', 'home'];
    for (const scenario of scenarios) {
      const row = await measure(browser, scenario, i);
      records.push(row);
      console.log('MOSAIC_858_ROUTE_SAMPLE ' + JSON.stringify(row));
    }
  }
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)];
  };
  const summary = Object.fromEntries(['home', 'login'].map(scenario => {
    const subset = records.filter(record => record.scenario === scenario);
    return [scenario, {
      count: subset.length, medianWallMs: median(subset.map(x => x.wallMs)),
      medianFcpMs: median(subset.map(x => x.firstContentfulPaintMs)),
      medianHomeReadyMs: scenario === 'home'
        ? median(subset.map(x => x.homeReadyMs)) : null,
    }];
  }));
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    variant: process.env.MOSAIC_AUTH_ROUTE_VARIANT ?? 'unspecified',
    scenario: 'same-runner production Vite output with fresh SW-blocked contexts',
    environment: { throttle: SLOW, mobile: true, cpuThrottle: 2,
      backend: 'fake cached identity or signed-out Login, all Appwrite held',
      limitations: ['synthetic, not a real installed PWA',
        'three samples per case cannot establish statistical significance'] },
    summary, records,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(resolve('.mosaic/slow-startup/auth-route-split.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_ROUTE_SUMMARY ' + JSON.stringify(report.summary));
});
