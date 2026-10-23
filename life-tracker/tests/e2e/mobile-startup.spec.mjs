import { test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Read-only lab diagnostic: Chromium emulates a phone; no actual phone, real
// account, production API calls, or Vercel deployment is involved.
const BASE_URL = process.env.MOSAIC_E2E_BASE_URL || 'http://127.0.0.1:4179';
const OUTPUT_DIR = resolve(process.env.MOSAIC_AUDIT_OUTPUT_DIR || '.mosaic/mobile-startup');
const SAMPLES = 3;
const CPU_SLOWDOWN = 4;
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
};
const STARTUP_MARKS = [
  'bootstrap:start',
  'react:mounted',
  'database:import-start',
  'database:module-ready',
  'database:create-start',
  'database:create-ready',
  'database:collections-start',
  'database:collections-ready',
  'database:ready',
  'app-shell:import-start',
  'app-shell:module-ready',
  'app-shell:database-fallback-visible',
  'app-shell:module-fallback-visible',
  'app-data-shell:mounted',
  'auth:resolved',
  'home:mounted',
  'home:owner-data-ready',
  'home:local-data-ready',
];

function percentile(values, percentileRank) {
  const numbers = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  return Math.round(numbers[Math.min(numbers.length - 1,
    Math.ceil(numbers.length * percentileRank) - 1)] * 100) / 100;
}

async function measureOnce(browser, scenario, iteration) {
  // A fresh nonpersistent browser profile for EVERY sample deliberately
  // excludes previously installed service workers, memory and disk cache.
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });

  try {
    // This lab audit must never consult even the Scratch API, much less
    // Production: genuine signed-in/Home + installed-PWA timings are not claimed.
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, (route) => route.abort());
    await context.addInitScript((profile) => {
      window.__mosaicAuditLargestPaint = null;
      try {
        const observer = new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries()) {
            window.__mosaicAuditLargestPaint = entry.startTime;
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Optional browser metric, not a proxy for Mosaic content readiness.
      }
      if (profile === 'cached-offline-home') {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => false,
        });
        localStorage.setItem('mosaic_last_known_user', JSON.stringify({
          $id: 'perf_cached_user',
          email: 'startup-perf@example.invalid',
          prefs: {},
          name: 'Startup Perf',
        }));
      }
    }, scenario);

    const page = await context.newPage();
    const devtools = await context.newCDPSession(page);
    await devtools.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
    await devtools.send('Network.enable');
    await devtools.send('Network.emulateNetworkConditions', NETWORK);

    const path = scenario === 'signed-out-login' ? '/login' : '/home';
    await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (scenario === 'signed-out-login') {
      await page.getByRole('heading', { name: 'Welcome Back' })
        .waitFor({ state: 'visible', timeout: 25_000 });
    } else {
      await page.waitForFunction(
        () => performance.getEntriesByName('mosaic:home:local-data-ready', 'mark').length > 0,
        null,
        { timeout: 40_000 },
      );
    }
    // Paint observer callbacks may be dispatched after the readiness event.
    await page.waitForTimeout(150);

    return await page.evaluate(({ scenario, iteration, markNames }) => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const marks = Object.fromEntries(markNames.map((key) => {
        const entry = performance.getEntriesByName('mosaic:' + key, 'mark')[0];
        return [key, entry?.startTime ?? null];
      }));
      const readyName = scenario === 'signed-out-login'
        ? 'react:mounted' : 'home:local-data-ready';
      const readyMs = marks[readyName];
      if (readyMs == null) throw new Error('Missing required startup mark: ' + readyName);
      const interval = (start, end) => marks[start] != null && marks[end] != null
        ? Math.round((marks[end] - marks[start]) * 100) / 100 : null;

      const sameOrigin = performance.getEntriesByType('resource')
        .filter((item) => item.name.startsWith(location.origin + '/'));
      const fixed = (value) => Number.isFinite(value)
        ? Math.round(value * 100) / 100 : null;
      return {
        scenario,
        iteration,
        requestedPath: location.pathname,
        readyMark: readyName,
        readyMs: fixed(readyMs),
        homeMountedMs: fixed(marks['home:mounted']),
        homeOwnerDataReadyMs: fixed(marks['home:owner-data-ready']),
        startupPhaseMs: {
          databaseModule: interval('database:import-start', 'database:module-ready'),
          databaseOpen: interval('database:create-start', 'database:create-ready'),
          databaseCollections: interval('database:collections-start', 'database:collections-ready'),
          appShellModule: interval('app-shell:import-start', 'app-shell:module-ready'),
          localDatabaseToHomeMount: interval('database:ready', 'home:mounted'),
        },
        firstContentfulPaintMs: fixed(
          paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? NaN,
        ),
        largestContentfulPaintMs: fixed(window.__mosaicAuditLargestPaint),
        domContentLoadedMs: fixed(navigation?.domContentLoadedEventEnd ?? NaN),
        transferBytesRecorded: sameOrigin.reduce(
          (sum, entry) => sum + (entry.transferSize || 0), 0,
        ),
        resourceEntries: sameOrigin.length,
        startupMarksMs: marks,
      };
    }, { scenario, iteration, markNames: STARTUP_MARKS });
  } finally {
    await context.close();
  }
}

test('@performance @mobile-audit production-build emulated mobile cold startup', async ({ browser }) => {
  test.setTimeout(250_000);
  const scenarios = ['signed-out-login', 'cached-offline-home'];
  const samples = [];
  const failures = [];

  for (const scenario of scenarios) {
    for (let iteration = 1; iteration <= SAMPLES; iteration += 1) {
      try {
        const result = await measureOnce(browser, scenario, iteration);
        samples.push(result);
        console.log('MOSAIC_MOBILE_STARTUP ' + JSON.stringify(result));
      } catch (error) {
        const failure = { scenario, iteration, error: String(error) };
        failures.push(failure);
        console.error('MOSAIC_MOBILE_STARTUP_ERROR ' + JSON.stringify(failure));
      }
    }
  }

  const summaries = Object.fromEntries(scenarios.map((scenario) => {
    const rows = samples.filter((row) => row.scenario === scenario);
    return [scenario, {
      successfulSamples: rows.length,
      readyMedianMs: percentile(rows.map((row) => row.readyMs), 0.5),
      readyP90Ms: percentile(rows.map((row) => row.readyMs), 0.9),
      fcpMedianMs: percentile(rows.map((row) => row.firstContentfulPaintMs), 0.5),
      lcpMedianMs: percentile(rows.map((row) => row.largestContentfulPaintMs), 0.5),
    }];
  }));

  const report = {
    schemaVersion: 1,
    buildSourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA || 'local-unknown',
    createdAt: new Date().toISOString(),
    environment: {
      browser: 'Playwright Chromium (desktop host, mobile emulation)',
      viewport: '412x915 CSS px',
      cpuSlowdownFactor: CPU_SLOWDOWN,
      latencyMs: NETWORK.latency,
      downloadBitsPerSecond: NETWORK.downloadThroughput * 8,
      serviceWorkers: 'blocked (cold-document profile)',
      backend: 'all Appwrite requests blocked; synthetic offline identity only',
      build: 'local Vite Preview, Scratch-bound client configuration, GIPHY disabled',
    },
    limitations: [
      'Not physical Android/iOS device data or authenticated Scratch Home.',
      'CPU throttle is relative to GitHub runner; cross-run absolute times may vary.',
      'Fresh browser profiles simulate first navigation, not installed PWA startup.',
      'Localhost network throttling does not replicate remote TLS, cellular packets or CDN.',
      'LCP is a generic paint metric; Home startup marks represent local-data readiness.',
      'The database and app-shell module intervals include download, parse, and evaluation; they cannot alone distinguish the three.',
      'An actual cached-online delayed Appwrite session requires the separate browser contract and device follow-up.',
    ],
    samples,
    failures,
    summaries,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const output = join(OUTPUT_DIR, 'mobile-startup.json');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_MOBILE_STARTUP_REPORT ' + output);
  if (failures.length !== 0 || samples.length !== scenarios.length * SAMPLES) {
    throw new Error('Mobile startup audit did not collect all synthetic scenario samples');
  }
});
