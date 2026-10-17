import { expect, test, chromium } from '@playwright/test';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

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
const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
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

async function run(browser, scenario, iteration, seededState = null) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: scenario.startsWith('pwa-') ? 'allow' : 'block',
    ...(seededState ? { storageState: seededState } : {}),
  });
  let releaseRemote;
  let pendingRemoteRequests = 0;
  let pending = false;
  let remoteMode = 'held';
  let authResponseCount = 0;
  const heldRemote = new Promise(resolve => { releaseRemote = resolve; });
  try {
    await context.addInitScript((user) => {
      // Preserve native navigator.onLine: CDP will set actual offline state.
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
    }, USER);
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      const request = route.request();
      if (remoteMode !== 'held' && request.method() === 'GET' &&
          /\/v1\/account(?:\?|$)/.test(request.url())) {
        authResponseCount += 1;
        const isSuccess = remoteMode === 'valid-session';
        await route.fulfill({
          status: isSuccess ? 200 : 503,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': BASE,
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': '*',
          },
          body: JSON.stringify(isSuccess ? {
            ...USER, $createdAt: '2026-01-01T00:00:00.000Z',
            $updatedAt: '2026-01-01T00:00:00.000Z',
            registration: '2026-01-01T00:00:00.000Z',
            status: true, labels: [], emailVerification: true,
            phone: '', phoneVerification: false, passwordUpdate: '',
            accessedAt: '2026-01-01T00:00:00.000Z',
            mfa: false, targets: [],
          } : { message: 'Synthetic unavailable', code: 503, type: 'general_server_error' }),
        });
        return;
      }
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
    if (scenario.startsWith('pwa-')) {
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
    // Warmups always hold auth. Only the measured navigation may return a
    // synthetic account response; all other cloud work stays blocked.
    remoteMode = scenario === 'pwa-valid-session' ? 'valid-session' :
      scenario === 'pwa-server-error' ? 'server-error' : 'held';
    await cdp.send('Network.emulateNetworkConditions',
      scenario === 'fast-assets' ? FAST :
        scenario === 'pwa-offline-assets' ? OFFLINE : SLOW);
    const started = Date.now();
    if (scenario.startsWith('pwa-')) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 75_000 });
    } else {
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded', timeout: 75_000 });
    }
    await readyHome();
    let seededTaskVisibleMs = null;
    if (seededState) {
      await expect(page.getByText('Startup fixture task 001', { exact: true }))
        .toBeVisible({ timeout: 15_000 });
      seededTaskVisibleMs = await page.evaluate(() => Math.round(performance.now()));
    }

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
        firstContentfulPaintMs: round(performance.getEntriesByName('first-contentful-paint', 'paint')[0]?.startTime),
        browserOnline: navigator.onLine,
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
    record.syntheticAuthResponses = authResponseCount;
    record.hasSeededData = Boolean(seededState);
    record.seededTaskVisibleMs = seededTaskVisibleMs;
    expect(record.homeReadyMs).not.toBeNull();
    if (seededState) {
      await expect(page.getByText('Startup fixture task 001', { exact: true }))
        .toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Startup fixture task 024', { exact: true }))
        .toBeVisible({ timeout: 15_000 });
    }
    expect(record.firstContentfulPaintMs).not.toBeNull();
    expect(record.browserOnline).toBe(scenario !== 'pwa-offline-assets');
    if (scenario.startsWith('pwa-')) {
      expect(serviceWorkerControlled).toBe(true);
      expect(record.slowAssets.every(asset => asset.transferredBytes === 0))
        .toBe(true);
    }
    expect(pending, 'Non-auth Appwrite work must never gate local Home startup').toBe(true);
    if (remoteMode !== 'held') {
      expect(authResponseCount, 'Account response must occur in the measured launch').toBeGreaterThan(0);
    }
    console.log('MOSAIC_858_SLOW_STARTUP ' + JSON.stringify(record));
    return record;
  } finally {
    releaseRemote();
    await context.close();
  }
}

test('@performance Issue 858 cached Home under independently throttled assets and Appwrite', async ({ browser }) => {
  test.setTimeout(500_000);
  const modes = [
    'fast-assets', 'slow-assets', 'pwa-cached-assets', 'pwa-offline-assets',
    'pwa-valid-session', 'pwa-server-error',
  ];
  const rows = [];
  // Interleave same-build, same-precached-state online/offline launches to
  // limit runner drift; preserve two historical uncached samples for context.
  for (let i = 1; i <= 4; i++) {
    const paired = i % 2 === 1
      ? ['pwa-cached-assets', 'pwa-offline-assets']
      : ['pwa-offline-assets', 'pwa-cached-assets'];
    for (const mode of paired) rows.push(await run(browser, mode, i));
    // Fast genuine-looking session resolution can schedule background sync,
    // while HTTP 503 still establishes provider reachability. Both are
    // mocked locally; the experiment never authenticates or writes remotely.
    // Compare them against fully offline and hanging-auth cached launches.
    for (const mode of i % 2 ? ['pwa-valid-session', 'pwa-server-error'] :
      ['pwa-server-error', 'pwa-valid-session']) {
      rows.push(await run(browser, mode, i));
    }
    if (i <= 2) {
      for (const mode of ['fast-assets', 'slow-assets']) {
        rows.push(await run(browser, mode, i));
      }
    }
  }
  const summary = Object.fromEntries(modes.map(mode => {
    const records = rows.filter(r => r.scenario === mode);
    return [mode, {
      samples: records.length,
      homeReadyMedianMs: percentile(records.map(r => r.homeReadyMs), .5),
      firstPaintMedianMs: percentile(records.map(r => r.firstContentfulPaintMs), .5),
      browserOnline: records[0].browserOnline,
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
        'Four service-worker online/offline samples per condition are directional, not a device SLA.',
        'A warm installed SW-controlled page reload is not a cold OS process launch.',
        '200/503 account replies are synthetic; they cannot verify real Appwrite sync contention or backend behavior.',
        'All non-account provider calls remain held, so complete successful sync is not exercised.',
      'The two extra slow/fast asset cases remain online-uncached controls.',
      ],
    },
    summary, rows,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_SUMMARY ' + JSON.stringify(summary));
});


// Seed real application storage through its public UI, then reuse the saved
// IndexedDB + localStorage in fresh isolated Playwright profiles. No test-only
// production exports, direct IDB document writes, or backend fixtures.
async function createPopulatedLocalFixture(browser) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  let releaseRemote;
  const heldRemote = new Promise(resolve => { releaseRemote = resolve; });
  try {
    await context.addInitScript(user => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
    }, USER);
    // A real fast network error displays a top status banner that can cover
    // the app's menu while creating the synthetic fixture. Keep the remote
    // indefinitely pending, as in the established no-network-gate contract.
    await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
      await heldRemote;
      await route.abort('failed').catch(() => {});
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    console.log('MOSAIC_858_SEED_STEP navigation');
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('grid', { name: /calendar/ }).first())
      .toBeVisible({ timeout: 30_000 });
    console.log('MOSAIC_858_SEED_STEP home-visible');
    await page.getByRole('button', { name: 'Open menu' }).click();
    console.log('MOSAIC_858_SEED_STEP opened-menu');
    await page.getByRole('button', { name: 'Lists & Categories' }).click();
    console.log('MOSAIC_858_SEED_STEP opened-manager');
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Startup Fixture');
    await page.getByRole('button', { name: 'Add Category' }).click();
    await expect(page.getByText('Startup Fixture', { exact: true }).first())
      .toBeVisible();
    console.log('MOSAIC_858_SEED_STEP category-created');
    await page.keyboard.press('Escape');
    // Fresh Mosaic opens in Calendar view, which has no category task pill.
    // Persist the existing Todo preference in the synthetic profile.
    await page.getByRole('tab', { name: 'Todo list' }).click();
    await page.evaluate(() => localStorage.setItem('mosaic_home_view', 'todo'));
    await expect(page.getByRole('tab', { name: 'Todo list' }))
      .toHaveAttribute('aria-selected', 'true');
    const selector = 'button[aria-label="Add a task to Startup Fixture"]';
    await expect.poll(() => page.locator(selector).count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    const pillDiagnostic = await page.evaluate((sel) => {
      const list = [...document.querySelectorAll(sel)];
      return {
        count: list.length,
        slides: list.slice(0, 9).map(button => {
          const slide = button.closest('.swiper-slide');
          const rect = button.getBoundingClientRect();
          return {
            aria: slide?.getAttribute('aria-hidden') ?? null,
            cls: slide?.className ?? '',
            x: Math.round(rect.x), y: Math.round(rect.y),
            w: Math.round(rect.width), h: Math.round(rect.height),
          };
        }),
      };
    }, selector);
    console.log('MOSAIC_858_SEED_PILLS ' + JSON.stringify(pillDiagnostic));
    expect(pillDiagnostic.count, 'the Todo category must render task entry pills')
      .toBeGreaterThan(0);
    console.log('MOSAIC_858_SEED_STEP category-pill-ready');
    for (let i = 1; i <= 24; i++) {
      // The inline Day View retains nearby offscreen Swiper slides. Target
      // the innermost slide with aria-hidden != true; raw DOM click invokes
      // the actual app handler without synthetic pointer geometry concerns.
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll(
          'button[aria-label="Add a task to Startup Fixture"]'
        )];
        const active = buttons.find(button =>
          button.closest('.swiper-slide')?.getAttribute('aria-hidden') !== 'true');
        if (!active) throw new Error('No active-day task entry pill');
        active.click();
      });
      const input = page.getByRole('textbox', { name: 'New task title' }).first();
      await input.fill('Startup fixture task ' + String(i).padStart(3, '0'));
      await input.press('Enter');
      if (i % 6 === 0) console.log('MOSAIC_858_SEED_STEP tasks-submitted-' + i);
    }
    await expect(page.getByText('Startup fixture task 001', { exact: true }))
      .toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Startup fixture task 024', { exact: true }))
      .toBeVisible({ timeout: 20_000 });
    console.log('MOSAIC_858_SEED_STEP task-ui-visible');
    // Finish local writes and verify that the original app can reopen them.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Startup fixture task 024', { exact: true }))
      .toBeVisible({ timeout: 30_000 });
    console.log('MOSAIC_858_SEED_STEP survived-reload');
    const state = await context.storageState({ indexedDB: true });
    const idbs = state.origins.reduce((sum, origin) =>
      sum + (origin.indexedDB?.length ?? 0), 0);
    expect(idbs, 'fixture must contain persisted IndexedDB databases')
      .toBeGreaterThan(0);
    console.log('MOSAIC_858_POPULATED_FIXTURE ' +
      JSON.stringify({ tasks: 24, indexedDbCount: idbs }));
    return state;
  } finally {
    releaseRemote();
    await context.close();
  }
}

test('@performance Issue 858 populated owner cache network parity', async ({ browser }) => {
  test.setTimeout(500_000);
  const seed = await createPopulatedLocalFixture(browser);
  const modes = [
    'pwa-offline-assets', 'pwa-cached-assets',
    'pwa-valid-session', 'pwa-server-error',
  ];
  const rows = [];
  for (let iteration = 1; iteration <= 4; iteration++) {
    const ordered = iteration % 2 ? modes : [...modes].reverse();
    for (const mode of ordered) {
      rows.push(await run(browser, mode, iteration, seed));
    }
  }
  const summary = Object.fromEntries(modes.map(mode => {
    const records = rows.filter(row => row.scenario === mode);
    return [mode, {
      samples: records.length,
      homeReadyMs: records.map(row => row.homeReadyMs),
      medianMs: percentile(records.map(row => row.homeReadyMs), 0.5),
      seededTaskVisibleMs: records.map(row => row.seededTaskVisibleMs),
      seededTaskVisibleMedianMs: percentile(records.map(row => row.seededTaskVisibleMs), 0.5),
      firstPaintMs: records.map(row => row.firstContentfulPaintMs),
      dbOpenMs: records.map(row => row.databaseOpenMs),
    }];
  }));
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    fixture: '24 private owner tasks in IndexedDB written through UI; synthetic identity',
    backend: 'account outcomes intercepted locally, all other Appwrite held unresolved',
    note: 'Warm SW-controlled reloads; no physical phone, no real session or real sync',
    summary, rows,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(resolve('.mosaic/slow-startup/populated-startup.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_POPULATED_SUMMARY ' + JSON.stringify(summary));
});


test('@performance Issue 858 installed cache across separate Chromium processes', async () => {
  test.setTimeout(300_000);
  const userDataDir = await mkdtemp(join(tmpdir(), 'mosaic-858-process-'));
  const launch = () => chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    serviceWorkers: 'allow',
  });
  const ready = async page => {
    await expect(page.getByRole('grid', { name: /calendar/ }).first())
      .toBeVisible({ timeout: 40_000 });
    await page.waitForFunction(() =>
      performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
      null, { timeout: 40_000 });
  };
  try {
    // Real browser profile, service worker, CacheStorage and IndexedDB
    // persist to disk; close Chromium before each measured new process.
    const setup = await launch();
    try {
      await setup.addInitScript(user => {
        localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
      }, USER);
      await setup.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//,
        route => route.abort('failed'));
      const page = setup.pages()[0] ?? await setup.newPage();
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
        .toBe(true);
    } finally {
      await setup.close();
    }

    const rows = [];
    for (let i = 1; i <= 3; i++) {
      const order = i % 2
        ? ['online-cached-process', 'offline-cached-process']
        : ['offline-cached-process', 'online-cached-process'];
      for (const scenario of order) {
        const started = Date.now();
        const context = await launch();
        let releaseRemote;
        const heldRemote = new Promise(resolve => { releaseRemote = resolve; });
        try {
          await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//,
            async route => {
              await heldRemote;
              await route.abort('failed').catch(() => {});
            });
          const page = context.pages()[0] ?? await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
          await cdp.send('Network.emulateNetworkConditions',
            scenario.startsWith('offline') ? OFFLINE : SLOW);
          await page.goto(BASE + '/home',
            { waitUntil: 'domcontentloaded', timeout: 55_000 });
          await ready(page);
          const row = await page.evaluate(({ scenario, iteration }) => ({
            scenario, iteration,
            browserOnline: navigator.onLine,
            controlled: Boolean(navigator.serviceWorker.controller),
            homeReadyMs: Math.round(performance.getEntriesByName(
              'mosaic:home:owner-data-ready', 'mark')[0].startTime),
            fcpMs: Math.round(performance.getEntriesByName(
              'first-contentful-paint', 'paint')[0].startTime),
            scriptTransfers: performance.getEntriesByType('resource')
              .filter(e => e.initiatorType === 'script')
              .reduce((sum, e) => sum + e.transferSize, 0),
          }), { scenario, iteration: i });
          row.processLaunchToReadyMs = Date.now() - started;
          expect(row.browserOnline).toBe(scenario.startsWith('online'));
          expect(row.controlled).toBe(true);
          expect(row.scriptTransfers).toBe(0);
          rows.push(row);
          console.log('MOSAIC_858_PROCESS_SAMPLE ' + JSON.stringify(row));
        } finally {
          releaseRemote();
          await context.close();
        }
      }
    }
    const summary = Object.fromEntries([
      'online-cached-process', 'offline-cached-process',
    ].map(mode => {
      const subset = rows.filter(row => row.scenario === mode);
      return [mode, {
        samples: subset.length,
        medianHomeMs: percentile(subset.map(row => row.homeReadyMs), .5),
        medianProcessLaunchToReadyMs: percentile(
          subset.map(row => row.processLaunchToReadyMs), .5),
        medianFcpMs: percentile(subset.map(row => row.fcpMs), .5),
      }];
    }));
    await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
    await writeFile(resolve('.mosaic/slow-startup/process-startup.json'),
      JSON.stringify({
        sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
        note: 'Headless Chromium process restart on the same real PWA profile; synthetic empty account, no hosted device',
        summary, rows,
      }, null, 2) + '\n');
    console.log('MOSAIC_858_PROCESS_SUMMARY ' + JSON.stringify(summary));
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
});
