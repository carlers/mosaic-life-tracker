import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// #858 reproducible dual-view cached Home scale diagnostic; advisory, not a release budget.
// Compare default Calendar with Todo under identical persisted RxDB state.
// Seed legitimate local RxDB documents through the actual Mosaic UI.
const BASE = 'http://127.0.0.1:4179';
const COUNTS = [0, 25, 500, 1000];
const MODES = ['pwa-online-slow', 'pwa-offline'];
const BASE_VIEWS = ['calendar', 'todo'];
const NO_TEXT_OBSERVERS_SCENARIO = 'calendar-no-text-image-observers'; // Historical control, not tested in this prototype
const REPEATS = 3;
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

async function sample(browser, tasks, state, mode, iteration, scenario) {
  const view = scenario === NO_TEXT_OBSERVERS_SCENARIO ? 'calendar' : scenario;
  const skipTextObservers = scenario === NO_TEXT_OBSERVERS_SCENARIO;
  const cachedAssets = mode.startsWith('pwa-');
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    serviceWorkers: cachedAssets ? 'allow' : 'block',
    storageState: state,
  });
  const network = await syntheticNetwork(ctx);
  try {
    await ctx.addInitScript(({ user, view, skipTextObservers }) => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
      // Explicitly override the seed fixture's Todo preference for every measured launch.
      localStorage.setItem('mosaic_home_view', view);
      window.__scaleLongTasks = [];
      window.__calendarImageObservers = 0;
      window.__calendarObservedTaskBlocks = 0;
      window.__calendarSkippedTaskObservations = 0;
      const NativeObserver = window.IntersectionObserver;
      if (NativeObserver) {
        window.IntersectionObserver = class extends NativeObserver {
          constructor(callback, options) {
            super(callback, options);
            window.__calendarImageObservers++;
          }
          observe(target) {
            if (target.getAttribute('title')?.startsWith('Startup scale task ')) {
              window.__calendarObservedTaskBlocks++;
              // Diagnostic-only ablation: no image exists for these synthetic tasks.
              // Suppress native observation and ensuing state updates, not the component tree.
              if (skipTextObservers) {
                window.__calendarSkippedTaskObservations++;
                return;
              }
            }
            return super.observe(target);
          }
        };
      }
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__scaleLongTasks.push(Math.round(entry.duration));
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch { /* Optional browser API. */ }
    }, { user: USER, view, skipTextObservers });
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
    await expect(page.getByRole('tab', { name: view === 'calendar' ? 'Calendar' : 'Todo list' }))
      .toHaveAttribute('aria-selected', 'true');
    if (view === 'calendar') {
      await expect(page.locator('[data-calendar-slide-index="30"] [role="grid"]').first())
        .toBeVisible({ timeout: 30_000 });
    }
    // This measures DOM visibility, NOT the first pixel's paint or touch responsiveness.
    let firstTaskVisibleMs = null;
    let lastTaskVisibleMs = null;
    if (tasks > 0) {
      const taskLocator = n => view === 'calendar'
        ? page.locator('[data-calendar-slide-index="30"] [title="' + taskName(n) + '"]').first()
        : page.getByText(taskName(n), { exact: true }).first();
      await expect(taskLocator(1)).toBeVisible({ timeout: 45_000 });
      firstTaskVisibleMs = await page.evaluate(() => Math.round(performance.now()));
      await expect(taskLocator(tasks)).toBeVisible({ timeout: 45_000 });
      lastTaskVisibleMs = await page.evaluate(() => Math.round(performance.now()));
    }
    const result = await page.evaluate(({ tasks, mode, iteration, scenario }) => {
      const mark = name => performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null;
      const delta = (a, b) => mark(a) !== null && mark(b) !== null
        ? Math.round(mark(b) - mark(a)) : null;
      const scripts = performance.getEntriesByType('resource').filter(e =>
        e.initiatorType === 'script' || /\.js(?:\?|$)/.test(e.name));
      const longTasks = window.__scaleLongTasks ?? [];
      return {
        tasks, mode, iteration, scenario,
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
        domElements: document.getElementsByTagName('*').length,
        calendarDayCells: document.querySelectorAll('[data-calendar-slide-index] [role="gridcell"]').length,
        calendarTaskBlocks: document.querySelectorAll('[data-calendar-slide-index] [title^="Startup scale task "]').length,
        calendarImageObservers: window.__calendarImageObservers,
        calendarObservedTaskBlocks: window.__calendarObservedTaskBlocks,
        calendarSkippedTaskObservations: window.__calendarSkippedTaskObservations,
      };
    }, { tasks, mode, iteration, scenario });
    result.firstTaskVisibleMs = firstTaskVisibleMs;
    result.lastTaskVisibleMs = lastTaskVisibleMs;
    result.wallClockReadyMs = Date.now() - started;
    result.appwriteRequestsHeld = network.count();
    result.syntheticAccountResponses = network.accountResponses();
    expect(Number.isFinite(result.homeReadyMs)).toBe(true);
    expect(Number.isFinite(result.tasksReadyMs)).toBe(true);
    if (view === 'calendar') {
      expect(result.calendarTaskBlocks, 'all tasks on selected day must appear in Calendar').toBeGreaterThanOrEqual(tasks);
    }
    expect(Number.isFinite(result.fcpMs)).toBe(true);
    // Text-only Calendar blocks must not construct image observers per task.
    if (view === 'calendar' && tasks >= 500) {
      expect(result.calendarImageObservers,
        'text-only Calendar image observer allocation must be bounded').toBeLessThan(25);
    }
    // Offscreen Todo rows must remain in DOM without all registering dnd hooks.
    if (view === 'todo' && tasks >= 500) {
      const registered = await page.locator('[data-task-dnd-registered="true"]').count();
      expect(registered, 'nearby Todo rows must be draggable').toBeGreaterThanOrEqual(12);
      expect(registered, 'distant Todo rows must not register').toBeLessThan(250);
      result.registeredTodoDrags = registered;
      // After a programmatic jump, first gesture must find registered targets.
      await page.getByRole('button', { name: taskName(tasks), exact: true })
        .first().scrollIntoViewIfNeeded({ timeout: 30000 });
      await expect.poll(async () => page.evaluate(title => {
        const task = [...document.querySelectorAll('[data-task-id]')]
          .find(node => node.querySelector('button[aria-label="' + title + '"]'));
        return Boolean(task?.parentElement?.querySelector('[data-task-dnd-registered="true"]'));
      }, taskName(tasks)), { timeout: 10000 }).toBe(true);
      // First touch after scrolling a distant row must start dnd-kit drag on
      // the first gesture, not merely expose a registered sensor element.
      if (tasks === 1000 && mode === 'pwa-online-slow' && iteration === 1) {
        const title = page.getByRole('button', { name: taskName(tasks), exact: true }).first();
        const box = await title.boundingBox();
        if (!box) throw new Error('Last Todo row has no touch bounds after scroll');
        const x = box.x + box.width * 0.5;
        const y = box.y + box.height * 0.5;
        let touchStarted = false;
        try {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x, y }],
          });
          touchStarted = true;
          await page.waitForTimeout(750);
          await expect(page.locator('[data-task-overlay-id]').first())
            .toHaveAttribute('data-task-dragging', 'true', { timeout: 8000 });
        } finally {
          if (touchStarted) await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchCancel', touchPoints: [],
          });
        }
        await expect(page.locator('[data-task-overlay-id]')).toHaveCount(0);
        result.firstDragAfterFarScrollPassed = true;
      }
    }
    expect(result.online).toBe(mode !== 'pwa-offline');
    expect(result.controlled).toBe(cachedAssets);
    if (cachedAssets) expect(result.scriptTransferBytes).toBe(0);
    console.log('MOSAIC_858_CALENDAR_ROW ' + JSON.stringify(result));
    return result;
  } finally {
    network.release();
    await ctx.close();
  }
}


test('@performance Issue 858 Calendar-first view and visible-density scaling', async ({ browser }) => {
  test.setTimeout(2_900_000);
  const states = await seedStates(browser);
  const rows = [];
  const groups = [];
  // Interleave mode/view order and reverse every second iteration to reduce warm-run drift.
  for (const count of COUNTS) {
    const scenarios = BASE_VIEWS;
    for (let iteration = 1; iteration <= REPEATS; iteration++) {
      const pairs = scenarios.flatMap(scenario => MODES.map(mode => ({ scenario, mode })));
      if (iteration % 2 === 0) pairs.reverse();
      for (const { scenario, mode } of pairs) {
        rows.push(await sample(browser, count, states.get(count), mode, iteration, scenario));
      }
    }
    const byScenario = {};
    for (const scenario of scenarios) {
      byScenario[scenario] = {};
      for (const mode of MODES) {
        const samples = rows.filter(r => r.tasks === count && r.scenario === scenario && r.mode === mode);
        byScenario[scenario][mode] = {
          n: samples.length,
          homeReadyP50Ms: percentile(samples.map(r => r.homeReadyMs), .5),
          homeReadyP90Ms: percentile(samples.map(r => r.homeReadyMs), .9),
          firstTaskDomP50Ms: percentile(samples.map(r => r.firstTaskVisibleMs), .5),
          lastTaskDomP50Ms: percentile(samples.map(r => r.lastTaskVisibleMs), .5),
          taskQueryAfterDbP50Ms: percentile(samples.map(r => r.taskQueryAfterDbMs), .5),
          homeAfterTaskQueryP50Ms: percentile(samples.map(r => r.homeAfterTaskQueryMs), .5),
          fcpP50Ms: percentile(samples.map(r => r.fcpMs), .5),
          longestTaskP50Ms: percentile(samples.map(r => r.longestTaskMs), .5),
          totalLongTaskP50Ms: percentile(samples.map(r => r.totalLongTaskMs), .5),
          domElementsP50: percentile(samples.map(r => r.domElements), .5),
          calendarDayCellsP50: percentile(samples.map(r => r.calendarDayCells), .5),
          calendarTaskBlocksP50: percentile(samples.map(r => r.calendarTaskBlocks), .5),
          imageObserversP50: percentile(samples.map(r => r.calendarImageObservers), .5),
          observedTaskBlocksP50: percentile(samples.map(r => r.calendarObservedTaskBlocks), .5),
          skippedTaskObservationsP50: percentile(samples.map(r => r.calendarSkippedTaskObservations), .5),
          heapP50Bytes: percentile(samples.map(r => r.jsHeapUsedBytes), .5),
        };
      }
    }
    const result = { count, byScenario };
    groups.push(result);
    console.log('MOSAIC_858_CALENDAR_GROUP ' + JSON.stringify(result));
    await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
    await writeFile(resolve('.mosaic/slow-startup/calendar-volume-partial.json'),
      JSON.stringify({ groups, rows }, null, 2) + '\n');
  }
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    protocol: {
      views: [...BASE_VIEWS, NO_TEXT_OBSERVERS_SCENARIO],
      taskCounts: COUNTS,
      repeatsPerCondition: REPEATS,
      cpuSlowdown: 2,
      slowLink: SLOW,
      mobileViewport: '412x915',
      localData: '0/25/500/1000 same-day text-only tasks added via real UI and verified in IndexedDB',
      observerAblation: 'At >=500 text-only tasks, the test suppresses IntersectionObserver.observe on TaskBlocks only. Native observer constructors and all React task components still run.',
      notes: [
        'Calendar is the default view; Todo is a matched data/control view.',
        'Task DOM existence/visibility is not guaranteed painted or user-interactable.',
        'Three repeats per group are directional, not significance or equivalence tests.',
        'Image observer count is browser instrumentation, not proof observers cause latency.',
        'This run covers dense selected-day tasks; distant and distributed-day controls remain unmeasured.',
        'Prototype verifies text-only image observer removal and viewport-scoped dnd registration, not true first-gesture drag success.',
        'No physical device, real account, genuine remote sync, or images.',
      ],
    },
    groups, rows,
  };
  await writeFile(resolve('.mosaic/slow-startup/calendar-volume-startup.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_CALENDAR_FINAL ' + JSON.stringify(groups));
});
