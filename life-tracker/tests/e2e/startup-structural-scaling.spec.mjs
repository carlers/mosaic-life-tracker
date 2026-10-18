import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// #858 non-shipping cold-local startup and query-concurrency diagnostic.
// All fixtures are synthetic, owner-fenced, created with REAL RxDB, and
// Appwrite requests are held. Do not treat readiness marks as device paint.
const BASE = 'http://127.0.0.1:4179';
const USER = {
  $id: 'issue858_scale_user',
  email: 'scale@example.invalid', name: 'Scaling Lab', prefs: {},
};
const CASES = [
  { count: 0, distribution: 'dense' },
  { count: 25, distribution: 'dense' },
  { count: 250, distribution: 'dense' },
  { count: 1000, distribution: 'dense' },
  { count: 250, distribution: 'month' },
  { count: 1000, distribution: 'month' },
  { count: 1000, distribution: 'years' },
];
const VIEWS = ['calendar', 'todo'];
const MODES = ['pwa-online-slow', 'pwa-offline'];
const REPEATS = 3;
const FAST = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const SLOW = { offline: false, latency: 220, downloadThroughput: 120_000, uploadThroughput: 60_000 };
const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
const percentile = (array, p) => {
  const sorted = array.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
};
const round = value => Number.isFinite(value) ? Math.round(value) : null;

async function holdAppwrite(context) {
  let release;
  let held = 0;
  const pending = new Promise(resolve => { release = resolve; });
  await context.route(/https:\/\/(?:fra|sgp)\.cloud\.appwrite\.io\//, async route => {
    held++;
    await pending;
    await route.abort('failed').catch(() => {});
  });
  return { release, count: () => held };
}
async function ready(page, view) {
  await page.waitForFunction(() =>
    performance.getEntriesByName('mosaic:home:owner-data-ready', 'mark').length > 0,
    null, { timeout: 90_000 });
  const tab = page.getByRole('tab', { name: view === 'todo' ? 'Todo list' : 'Calendar' });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 });
  if (view === 'calendar') {
    await expect(page.locator('[data-calendar-slide-index="30"] [role="grid"]'))
      .toBeVisible({ timeout: 60_000 });
  } else {
    await expect(page.locator('[data-testid="todo-day-section"]'))
      .toBeVisible({ timeout: 60_000 });
  }
}
function syntheticContext(browser, state, serviceWorkers = 'block') {
  return browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers,
    ...(state ? { storageState: state } : {}),
  });
}

async function seedFixtures(browser) {
  const baseCtx = await syntheticContext(browser);
  const initialRemote = await holdAppwrite(baseCtx);
  let emptyState;
  try {
    await baseCtx.addInitScript(user =>
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user)), USER);
    const page = await baseCtx.newPage();
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
    await ready(page, 'calendar');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Lists & Categories' }).click();
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Scale Fixture');
    await page.getByRole('button', { name: 'Add Category' }).click();
    await expect(page.getByText('Scale Fixture', { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    emptyState = await baseCtx.storageState({ indexedDB: true });
  } finally {
    initialRemote.release();
    await baseCtx.close();
  }
  const states = new Map();
  const queryRows = [];
  states.set('0:dense', emptyState);
  for (const fixture of CASES.filter(x => x.count !== 0)) {
    const context = await syntheticContext(browser, emptyState);
    const network = await holdAppwrite(context);
    const key = fixture.count + ':' + fixture.distribution;
    try {
      await context.addInitScript(user => {
        localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
        sessionStorage.setItem('mosaic_858_fixture_mode', '1');
      }, USER);
      const page = await context.newPage();
      await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
      await ready(page, 'calendar');
      await page.waitForFunction(() => typeof window.__mosaic858Seed === 'function',
        null, { timeout: 30_000 });
      const seed = await page.evaluate(({ count, distribution }) =>
        window.__mosaic858Seed(count, distribution), fixture);
      expect(seed.count).toBe(fixture.count);
      await expect.poll(() => page.locator(
        '[data-calendar-slide-index="30"] [title^="Scaling fixture "]').count(),
      { timeout: 50_000 }).toBeGreaterThanOrEqual(
        fixture.distribution === 'dense' ? fixture.count :
        fixture.distribution === 'month' ? 1 : 0);
      const snapshot = await context.storageState({ indexedDB: true });
      const uniqueTitles = new Set(JSON.stringify(snapshot).match(/Scaling fixture \d{5}/g) ?? []);
      expect(uniqueTitles.size, 'exact persisted fixture cardinality for ' + key).toBe(fixture.count);
      states.set(key, snapshot);
      const query = await page.evaluate(() => window.__mosaic858ReadProbe());
      expect(query.count).toBe(fixture.count);
      expect(query.currentMonthCount).toBe(seed.activeMonthCount);
      queryRows.push({ key, seed, ...query });
      console.log('MOSAIC_858_QUERY_ROW ' + JSON.stringify({
        key, count: query.count, current: query.currentMonthCount,
        metrics: Object.fromEntries([
          'allSortedMs','currentMonthMs','serialThreeMonthsMs','parallelThreeMonthsMs',
        ].map(m => [m, {
          p50: percentile(query.timings.map(t => t[m]), .5),
          p90: percentile(query.timings.map(t => t[m]), .9),
        }])),
      }));
    } finally {
      network.release();
      await context.close();
    }
  }
  expect(states.size).toBe(CASES.length);
  return { states, queryRows };
}

async function sample(browser, fixture, snapshot, mode, view, iteration) {
  const context = await syntheticContext(browser, snapshot, 'allow');
  const network = await holdAppwrite(context);
  try {
    await context.addInitScript(({ user, view }) => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
      localStorage.setItem('mosaic_home_view', view);
      window.__mosaic858LongTasks = [];
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__mosaic858LongTasks.push(Math.round(entry.duration));
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch { /* Optional long-task API. */ }
    }, { user: USER, view });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await cdp.send('Network.emulateNetworkConditions', FAST);
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
    await ready(page, view);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page, view);
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await cdp.send('Network.emulateNetworkConditions',
      mode === 'pwa-offline' ? OFFLINE : SLOW);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    await ready(page, view);
    const result = await page.evaluate(({ fixture, mode, view, iteration }) => {
      const round = value => Number.isFinite(value) ? Math.round(value) : null;
      const mark = name => performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null;
      const delta = (a, b) => mark(a) !== null && mark(b) !== null
        ? round(mark(b) - mark(a)) : null;
      const longTasks = window.__mosaic858LongTasks || [];
      return {
        ...fixture, mode, view, iteration,
        ownerReadyMs: round(mark('home:owner-data-ready')),
        homeMountMs: round(mark('home:mounted')),
        dbReadyMs: round(mark('database:ready')),
        taskQueryResultMs: round(mark('home:tasks-ready')),
        dbToTaskQueryMs: delta('database:ready', 'home:tasks-ready'),
        taskQueryToOwnerReadyMs: delta('home:tasks-ready', 'home:owner-data-ready'),
        dbToHomeMountMs: delta('database:ready', 'home:mounted'),
        fcpMs: round(performance.getEntriesByName('first-contentful-paint', 'paint')[0]?.startTime),
        taskBlockDomCount: document.querySelectorAll(
          '[data-calendar-slide-index="30"] [title^="Scaling fixture "]').length,
        todoRowDomCount: document.querySelectorAll('[data-task-id]').length,
        domElements: document.getElementsByTagName('*').length,
        longestTaskMs: Math.max(0, ...longTasks),
        totalLongTaskMs: longTasks.reduce((n, v) => n + v, 0),
        longTaskCount: longTasks.length,
        online: navigator.onLine,
        controlled: Boolean(navigator.serviceWorker.controller),
      };
    }, { fixture, mode, view, iteration });
    // The end-of-2-frame probe includes the browser's next paint
    // opportunity; it is not a physical-device "first actionable" SLA.
    result.twoFrameReadyMs = await page.evaluate(() => new Promise(resolve => {
      const round = value => Number.isFinite(value) ? Math.round(value) : null;
      requestAnimationFrame(() => requestAnimationFrame(() =>
        resolve(round(performance.now()))));
    }));
    const interaction = await page.evaluate(async view => {
      const round = value => Number.isFinite(value) ? Math.round(value) : null;
      const target = view === 'calendar'
        ? document.querySelector('[data-calendar-slide-index="30"] button[aria-current="date"]')
        : [...document.querySelectorAll('button[aria-label="Add a task to Scale Fixture"]')]
            .find(el => el.closest('.swiper-slide')?.getAttribute('aria-hidden') !== 'true');
      if (!target) throw new Error('No first-interaction target');
      const visible = () => view === 'calendar'
        ? Boolean(document.querySelector('[data-testid="day-swiper"]'))
        : Boolean(document.querySelector('input[placeholder^="Add a task to Scale Fixture"]'));
      return new Promise((resolve, reject) => {
        const started = performance.now();
        const timeout = setTimeout(() => {
          observer.disconnect();
          reject(new Error('First interaction did not produce target DOM'));
        }, 25_000);
        const finish = () => {
          if (!visible()) return;
          clearTimeout(timeout);
          observer.disconnect();
          resolve({ responseMs: round(performance.now() - started) });
        };
        const observer = new MutationObserver(finish);
        observer.observe(document.body, { subtree: true, childList: true });
        target.click();
        finish();
      });
    }, view);
    result.firstActionDomResponseMs = interaction.responseMs;
    expect(Number.isFinite(result.ownerReadyMs)).toBe(true);
    expect(Number.isFinite(result.fcpMs)).toBe(true);
    expect(result.controlled).toBe(true);
    expect(result.online).toBe(mode !== 'pwa-offline');
    if (fixture.distribution === 'dense' && view === 'calendar') {
      expect(result.taskBlockDomCount).toBeGreaterThanOrEqual(fixture.count);
    }
    result.heldAppwriteRequests = network.count();
    console.log('MOSAIC_858_SCALING_ROW ' + JSON.stringify(result));
    return result;
  } finally {
    network.release();
    await context.close();
  }
}

test('@performance Issue 858 parallel read and Calendar/Todo scaling', async ({ browser }) => {
  test.setTimeout(2_800_000);
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  const { states, queryRows } = await seedFixtures(browser);
  const rows = [];
  const groups = [];
  for (const fixture of CASES) {
    const key = fixture.count + ':' + fixture.distribution;
    for (let iteration = 1; iteration <= REPEATS; iteration++) {
      const conditions = VIEWS.flatMap(view => MODES.map(mode => ({ view, mode })));
      if (iteration % 2 === 0) conditions.reverse();
      for (const { view, mode } of conditions) {
        rows.push(await sample(browser, fixture, states.get(key), mode, view, iteration));
      }
    }
    const stats = Object.fromEntries(VIEWS.flatMap(view =>
      MODES.map(mode => {
        const subset = rows.filter(row =>
          row.count === fixture.count && row.distribution === fixture.distribution &&
          row.view === view && row.mode === mode);
        return [view + ':' + mode, {
          n: subset.length,
          ownerReadyP50Ms: percentile(subset.map(x => x.ownerReadyMs), .5),
          ownerReadyP90Ms: percentile(subset.map(x => x.ownerReadyMs), .9),
          dbToTaskQueryP50Ms: percentile(subset.map(x => x.dbToTaskQueryMs), .5),
          afterQueryP50Ms: percentile(subset.map(x => x.taskQueryToOwnerReadyMs), .5),
          homeMountP50Ms: percentile(subset.map(x => x.homeMountMs), .5),
          twoFrameP50Ms: percentile(subset.map(x => x.twoFrameReadyMs), .5),
          firstActionP50Ms: percentile(subset.map(x => x.firstActionDomResponseMs), .5),
          domElementsP50: percentile(subset.map(x => x.domElements), .5),
        }];
      })));
    groups.push({ ...fixture, stats });
    console.log('MOSAIC_858_SCALING_GROUP ' + JSON.stringify(groups.at(-1)));
    await writeFile(resolve('.mosaic/slow-startup/structural-scaling-partial.json'),
      JSON.stringify({ groups, queryRows, rows }, null, 2) + '\n');
  }
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    protocol: {
      cases: CASES, views: VIEWS, modes: MODES, repeats: REPEATS,
      browser: 'cached PWA mobile Chromium 412x915, 2x simulated CPU',
      network: 'All Appwrite requests held. Offline and slow online measured.',
      fixture: 'Synthetic account with owner-fenced real RxDB bulkInsert, exactly persisted IndexedDB tasks',
      queryMicrobench: 'Six mostly RxDB-cached same-context repetitions, alternating serial vs parallel order; near-zero p50 cannot establish startup or concurrency gains',
      caution: 'Lab import is gated to synthetic seed contexts only; no source/HTML from this branch is deployable or accepted',
      limitations: ['No authenticated Scratch or physical device',
        'Two-frame and first-action DOM proxies are not first painted/interactive human touch',
        'No actual image files, shared memberships, Diary or responsive-font stress',
        'Query speed on a warmed seeded page is not a startup causal intervention',
        'Limited n=3 observations cannot prove statistical significance'],
    },
    groups, queryRows, rows,
  };
  await writeFile(resolve('.mosaic/slow-startup/structural-scaling.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_SCALING_FINAL ' + JSON.stringify(groups));
});
