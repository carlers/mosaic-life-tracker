import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Production-build, credential-free browser diagnostic, not a release budget.
// Seed legitimate local RxDB documents through the actual Mosaic UI.
const BASE = 'http://127.0.0.1:4179';
const COUNTS = [0, 25, 100, 250, 500];
const MODES = ['pwa-online-slow', 'pwa-offline', 'pwa-online-session-200', 'uncached-online-fast', 'uncached-online-slow'];
const REPEATS = 5;
const USER = { $id: 'issue858_scale_user', email: 'scale@example.invalid', name: 'Scale Test', prefs: {} };
const FAST = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const SLOW = { offline: false, latency: 220, downloadThroughput: 120_000, uploadThroughput: 60_000 };
const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
const taskName = n => 'Startup scale task ' + String(n).padStart(4, '0');
const percentile = (arr, p) => {
  const sorted = arr.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
};

async function syntheticNetwork(context) {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let requests = 0;
  let accountResponses = 0;
  let resolveAccount = false;
  await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
    const request = route.request();
    if (resolveAccount && request.method() === 'GET' &&
        /\/v1\/account(?:\?|$)/.test(request.url())) {
      accountResponses++;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        headers: {
          'access-control-allow-origin': BASE,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': '*',
        },
        body: JSON.stringify({
          ...USER, $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-01T00:00:00.000Z',
          registration: '2026-01-01T00:00:00.000Z', status: true,
          labels: [], emailVerification: true, phone: '',
          phoneVerification: false, passwordUpdate: '', accessedAt: '',
          mfa: false, targets: [],
        }),
      });
      return;
    }
    requests++;
    await pending;
    await route.abort('failed').catch(() => {});
  });
  return { release, count: () => requests,
    resolveSession: () => { resolveAccount = true; },
    accountResponses: () => accountResponses };
}
async function waitForHome(page) {
  await expect(page.getByRole('grid', { name: /calendar/ }).first())
    .toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => performance.getEntriesByName(
    'mosaic:home:owner-data-ready', 'mark').length > 0, null, { timeout: 90_000 });
}

async function seedStates(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers: 'block',
  });
  const network = await syntheticNetwork(ctx);
  const snapshots = new Map();
  try {
    await ctx.addInitScript(user => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
    }, USER);
    const page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
    await waitForHome(page);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Lists & Categories' }).click();
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Scale Fixture');
    await page.getByRole('button', { name: 'Add Category' }).click();
    await expect(page.getByText('Scale Fixture', { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Todo list' }).click();
    await page.evaluate(() => localStorage.setItem('mosaic_home_view', 'todo'));
    await expect(page.getByRole('tab', { name: 'Todo list' }))
      .toHaveAttribute('aria-selected', 'true');
    const entry = 'button[aria-label="Add a task to Scale Fixture"]';
    await expect.poll(() => page.locator(entry).count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    // Match the 0-task control's category and Todo-view state to every populated tier.
    snapshots.set(0, await ctx.storageState({ indexedDB: true }));

    for (let index = 1; index <= Math.max(...COUNTS); index++) {
      // Multiple Swiper slides retain duplicate entry pills. Select active day.
      await page.evaluate(selector => {
        const candidate = [...document.querySelectorAll(selector)].find(el =>
          el.closest('.swiper-slide')?.getAttribute('aria-hidden') !== 'true');
        if (!candidate) throw new Error('No active-day category entry pill');
        candidate.click();
      }, entry);
      const input = page.getByRole('textbox', { name: 'New task title' }).first();
      await input.fill(taskName(index));
      await input.press('Enter');
      if (index % 25 === 0) {
        await expect(page.getByText(taskName(index), { exact: true }))
          .toBeVisible({ timeout: 30_000 });
        console.log('MOSAIC_858_SCALE_SEED ' + JSON.stringify({ created: index }));
      }
      if (COUNTS.includes(index)) {
        // Restart the real app to validate persistence before taking snapshot.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
        await waitForHome(page);
        await expect(page.getByText(taskName(index), { exact: true }))
          .toBeVisible({ timeout: 60_000 });
        const snapshot = await ctx.storageState({ indexedDB: true });
        const stores = snapshot.origins.reduce((n, o) => n + (o.indexedDB?.length ?? 0), 0);
        expect(stores).toBeGreaterThan(0);
        // Verify every intended row exists, not merely the newest task.
        const distinctTitles = new Set(
          JSON.stringify(snapshot).match(/Startup scale task \d{4}/g) ?? []);
        expect(distinctTitles.size, 'exact persisted task cardinality').toBe(index);
        snapshots.set(index, snapshot);
        console.log('MOSAIC_858_SCALE_SNAPSHOT ' + JSON.stringify({ tasks: index, stores }));
      }
    }
    expect(snapshots.size).toBe(COUNTS.length);
    return snapshots;
  } finally {
    network.release();
    await ctx.close();
  }
}

async function sample(browser, tasks, state, mode, iteration) {
  const cachedAssets = mode.startsWith('pwa-');
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    serviceWorkers: cachedAssets ? 'allow' : 'block',
    storageState: state,
  });
  const network = await syntheticNetwork(ctx);
  try {
    await ctx.addInitScript(user => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
      window.__scaleLongTasks = [];
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__scaleLongTasks.push(Math.round(entry.duration));
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch { /* Optional browser API. */ }
    }, USER);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    if (cachedAssets) {
      await cdp.send('Network.emulateNetworkConditions', FAST);
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
      await waitForHome(page);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForHome(page);
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    }
    await cdp.send('Network.emulateNetworkConditions',
      mode === 'pwa-offline' ? OFFLINE : mode === 'uncached-online-fast' ? FAST : SLOW);
    if (mode === 'pwa-online-session-200') network.resolveSession();
    const started = Date.now();
    if (cachedAssets) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    } else {
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    }
    await waitForHome(page);
    let firstTaskVisibleMs = null;
    let lastTaskVisibleMs = null;
    if (tasks > 0) {
      await expect(page.getByText(taskName(1), { exact: true }))
        .toBeVisible({ timeout: 30_000 });
      firstTaskVisibleMs = await page.evaluate(() => Math.round(performance.now()));
      await expect(page.getByText(taskName(tasks), { exact: true }))
        .toBeVisible({ timeout: 45_000 });
      lastTaskVisibleMs = await page.evaluate(() => Math.round(performance.now()));
    }
    const result = await page.evaluate(({ tasks, mode, iteration }) => {
      const mark = name => performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null;
      const delta = (a, b) => mark(a) !== null && mark(b) !== null
        ? Math.round(mark(b) - mark(a)) : null;
      const scripts = performance.getEntriesByType('resource').filter(e =>
        e.initiatorType === 'script' || /\.js(?:\?|$)/.test(e.name));
      const longTasks = window.__scaleLongTasks ?? [];
      return {
        tasks, mode, iteration,
        online: navigator.onLine,
        controlled: Boolean(navigator.serviceWorker?.controller),
        fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint', 'paint')[0]?.startTime ?? NaN),
        homeReadyMs: Math.round(mark('home:owner-data-ready') ?? NaN),
        homeMountedMs: Math.round(mark('home:mounted') ?? NaN),
        databaseReadyMs: Math.round(mark('database:ready') ?? NaN),
        dbModuleMs: delta('database:import-start', 'database:module-ready'),
        dbOpenMs: delta('database:create-start', 'database:create-ready'),
        dbCollectionsMs: delta('database:collections-start', 'database:collections-ready'),
        appShellModuleMs: delta('app-shell:import-start', 'app-shell:module-ready'),
        homeAfterDatabaseMs: delta('database:ready', 'home:owner-data-ready'),
        tasksReadyMs: Math.round(mark('home:tasks-ready') ?? NaN),
        taskQueryAfterDbMs: delta('database:ready', 'home:tasks-ready'),
        homeAfterTaskQueryMs: delta('home:tasks-ready', 'home:owner-data-ready'),
        longTaskCount: longTasks.length,
        totalLongTaskMs: longTasks.reduce((a, n) => a + n, 0),
        longestTaskMs: Math.max(0, ...longTasks),
        jsHeapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
        scriptTransferBytes: scripts.reduce((sum, e) => sum + e.transferSize, 0),
      };
    }, { tasks, mode, iteration });
    result.firstTaskVisibleMs = firstTaskVisibleMs;
    result.lastTaskVisibleMs = lastTaskVisibleMs;
    result.wallClockReadyMs = Date.now() - started;
    result.appwriteRequestsHeld = network.count();
    result.syntheticAccountResponses = network.accountResponses();
    expect(Number.isFinite(result.homeReadyMs)).toBe(true);
    expect(Number.isFinite(result.tasksReadyMs)).toBe(true);
    if (mode === 'pwa-online-session-200') {
      expect(result.syntheticAccountResponses, 'measured launch must verify the synthetic session')
        .toBeGreaterThan(0);
    }
    expect(Number.isFinite(result.fcpMs)).toBe(true);
    expect(result.online).toBe(mode !== 'pwa-offline');
    expect(result.controlled).toBe(cachedAssets);
    if (cachedAssets) expect(result.scriptTransferBytes).toBe(0);
    console.log('MOSAIC_858_SCALE_ROW ' + JSON.stringify(result));
    return result;
  } finally {
    network.release();
    await ctx.close();
  }
}

test('@performance Issue 858 task-volume startup scaling', async ({ browser }) => {
  test.setTimeout(1_650_000);
  const states = await seedStates(browser);
  const rows = [];
  const groups = [];
  // Interleave network modes; reverse each second iteration to limit runner drift.
  for (const count of COUNTS) {
    for (let i = 1; i <= REPEATS; i++) {
      const modes = i % 2 ? MODES : [...MODES].reverse();
      for (const mode of modes) {
        rows.push(await sample(browser, count, states.get(count), mode, i));
      }
    }
    const subset = rows.filter(row => row.tasks === count);
    const byMode = Object.fromEntries(MODES.map(mode => {
      const samples = subset.filter(row => row.mode === mode);
      return [mode, {
        n: samples.length,
        homeReadyP50Ms: percentile(samples.map(row => row.homeReadyMs), .5),
        homeReadyP90Ms: percentile(samples.map(row => row.homeReadyMs), .9),
        firstTaskP50Ms: percentile(samples.map(row => row.firstTaskVisibleMs), .5),
        dbCollectionsP50Ms: percentile(samples.map(row => row.dbCollectionsMs), .5),
        homeAfterDbP50Ms: percentile(samples.map(row => row.homeAfterDatabaseMs), .5),
        taskQueryAfterDbP50Ms: percentile(samples.map(row => row.taskQueryAfterDbMs), .5),
        homeAfterTaskQueryP50Ms: percentile(samples.map(row => row.homeAfterTaskQueryMs), .5),
        fcpP50Ms: percentile(samples.map(row => row.fcpMs), .5),
        longTaskSumP50Ms: percentile(samples.map(row => row.totalLongTaskMs), .5),
        longestTaskP50Ms: percentile(samples.map(row => row.longestTaskMs), .5),
        jsHeapUsedP50Bytes: percentile(samples.map(row => row.jsHeapUsedBytes), .5),
      }];
    }));
    groups.push({ tasks: count, byMode });
    console.log('MOSAIC_858_SCALE_GROUP ' + JSON.stringify(groups.at(-1)));
    // Persist partial results even if the next, larger tier exhausts the runner.
    await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
    await writeFile(resolve('.mosaic/slow-startup/task-volume-partial.json'),
      JSON.stringify({ completedTaskTiers: groups.map(g => g.tasks), groups, rows }, null, 2) + '\n');
  }
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    protocol: {
      taskCounts: COUNTS, repeatsPerMode: REPEATS,
      cpuSlowdown: 2, slowLink: SLOW, mobileViewport: '412x915',
      localData: 'Tasks created through actual app UI; copied genuine IndexedDB state',
      onlineBackend: 'Appwrite held except synthetic account 200 mode; non-account calls held; no remote-only task hydration',
      appAssets: 'Production build; controlled SW vs blocked SW',
      limitations: [
        'All tasks are on the current day in one category (visible-day stress case).',
        'Uncached refers to JS assets. Tasks absent locally cannot load without remote sync.',
        'No physical device, real account, live sync or remote-only task population.',
        'Five samples per condition are directional and cannot prove timing equivalence.',
        'Synthetic 200 verifies account reachability but does not allow server data sync.',
      ],
    },
    groups, rows,
  };
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  await writeFile(resolve('.mosaic/slow-startup/task-volume-startup.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_SCALE_FINAL ' + JSON.stringify(groups));
});
