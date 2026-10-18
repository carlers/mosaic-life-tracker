import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// #858 non-shipping matched rendering graph ablation on real cached task fixtures.
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
  { count: 1000, distribution: 'month' },
];
const VARIANTS = {
  todo: ['baseline', 'near-motion', 'near-motion-no-passive',
    'no-idle-motion-no-passive'],
};
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

async function sample(browser, fixture, snapshot, mode, view, variant, iteration) {
  const context = await syntheticContext(browser, snapshot, 'allow');
  const network = await holdAppwrite(context);
  try {
    await context.addInitScript(({ user, view, variant }) => {
      localStorage.setItem('mosaic_last_known_user', JSON.stringify(user));
      localStorage.setItem('mosaic_home_view', view);
      localStorage.setItem('mosaic_858_render_variant', variant);
      window.__mosaic858LongTasks = [];
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__mosaic858LongTasks.push(Math.round(entry.duration));
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch { /* Optional long-task API. */ }
    }, { user: USER, view, variant });
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
    const result = await page.evaluate(({ fixture, mode, view, variant, iteration }) => {
      const round = value => Number.isFinite(value) ? Math.round(value) : null;
      const mark = name => performance.getEntriesByName('mosaic:' + name, 'mark')[0]?.startTime ?? null;
      const delta = (a, b) => mark(a) !== null && mark(b) !== null
        ? round(mark(b) - mark(a)) : null;
      const longTasks = window.__mosaic858LongTasks || [];
      return {
        ...fixture, mode, view, variant, iteration,
        taskQueryCreatedMs: round(mark('858:tasks-query-created')),
        taskFirstEmissionMs: round(mark('858:tasks-first-emission')),
        querySubscriptionToResultMs: delta('858:tasks-query-created', '858:tasks-first-emission'),
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
    }, { fixture, mode, view, variant, iteration });
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
    // Behavior probe independent from timing: first 550ms+ touch holds must
    // lift both the eager row and last row AFTER scrolling into view.
    if (fixture.count === 25 && iteration === 1 &&
        ['baseline', 'near-motion', 'near-motion-no-passive'].includes(variant)) {
      await page.keyboard.press('Escape');
      result.firstLongPressOverlays = [];
      for (const number of [0, 24]) {
        const title = 'Scaling fixture ' + String(number).padStart(5, '0');
        const taskId = 'issue858_task_' + String(number).padStart(5, '0');
        const item = page.getByRole('button', { name: title, exact: true }).first();
        // The inline Swiper can relayout after a distant row scrolls into
        // view. Require an actual stable box; do not infer readiness from a
        // momentary toBeVisible pass before the next React commit.
        let box = null;
        await expect(async () => {
          await item.scrollIntoViewIfNeeded();
          await expect(item).toBeVisible();
          const candidate = await item.boundingBox();
          expect(candidate, 'Distant title must retain geometry: ' + title).not.toBeNull();
          expect(candidate?.width ?? 0).toBeGreaterThan(0);
          expect(candidate?.height ?? 0).toBeGreaterThan(0);
          box = candidate;
        }).toPass({ timeout: 12_000, intervals: [100, 200, 300] });
        if (!box) throw new Error('Dragged title not stable: ' + title);
        const session = await context.newCDPSession(page);
        const point = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
        await session.send('Input.dispatchTouchEvent',
          { type: 'touchStart', touchPoints: [point] });
        try {
          await page.waitForTimeout(610);
          await expect(page.locator('[data-task-overlay-id="' + taskId + '"]'))
            .toBeVisible({ timeout: 10_000 });
          result.firstLongPressOverlays.push(taskId);
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ ...point, y: point.y - 25 }],
          });
        } finally {
          await session.send('Input.dispatchTouchEvent',
            { type: 'touchCancel', touchPoints: [] }).catch(() => {});
        }
        await expect(page.locator('[data-task-overlay-id="' + taskId + '"]'))
          .toHaveCount(0, { timeout: 10_000 });
      }
    }
    if (view === 'todo' && fixture.distribution === 'dense') {
      expect(result.todoRowDomCount, 'all selected-day rows retained by ' + variant)
        .toBeGreaterThanOrEqual(fixture.count);
    }
    expect(Number.isFinite(result.querySubscriptionToResultMs)).toBe(true);
    console.log('MOSAIC_858_NEAR_ROW ' + JSON.stringify(result));
    return result;
  } finally {
    network.release();
    await context.close();
  }
}

test('@performance Issue 858 proximity-gated Motion and first long press', async ({ browser }) => {
  test.setTimeout(3_500_000);
  await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
  const { states } = await seedFixtures(browser);
  const rows = [];
  const groups = [];
  for (const fixture of CASES) {
    const key = fixture.count + ':' + fixture.distribution;
    const modes = fixture.count === 1000 && fixture.distribution === 'dense'
      ? ['pwa-online-slow', 'pwa-offline']
      : ['pwa-online-slow'];
    for (let iteration = 1; iteration <= REPEATS; iteration++) {
      const scenarios = Object.entries(VARIANTS).flatMap(([view, variants]) =>
        variants.flatMap(variant => modes.map(mode => ({ view, variant, mode }))));
      // Per-fixture matched ABBA-like reversals avoid fixed warm-run advantage.
      if (iteration % 2 === 0) scenarios.reverse();
      for (const { view, variant, mode } of scenarios) {
        rows.push(await sample(browser, fixture, states.get(key),
          mode, view, variant, iteration));
      }
    }
    const stats = Object.fromEntries(Object.entries(VARIANTS).flatMap(
      ([view, variants]) => variants.flatMap(variant => modes.map(mode => {
        const subset = rows.filter(row =>
          row.count === fixture.count && row.distribution === fixture.distribution &&
          row.view === view && row.mode === mode && row.variant === variant);
        return [view + ':' + variant + ':' + mode, {
          n: subset.length,
          readyP50Ms: percentile(subset.map(x => x.ownerReadyMs), .5),
          readyP90Ms: percentile(subset.map(x => x.ownerReadyMs), .9),
          afterQueryP50Ms: percentile(subset.map(x => x.taskQueryToOwnerReadyMs), .5),
          querySubToResultP50Ms: percentile(subset.map(x => x.querySubscriptionToResultMs), .5),
          firstActionP50Ms: percentile(subset.map(x => x.firstActionDomResponseMs), .5),
          domElementsP50: percentile(subset.map(x => x.domElements), .5),
          todoRowDomCountP50: percentile(subset.map(x => x.todoRowDomCount), .5),
          frameP50Ms: percentile(subset.map(x => x.twoFrameReadyMs), .5),
        }];
      }))));
    groups.push({ ...fixture, stats });
    console.log('MOSAIC_858_NEAR_GROUP ' + JSON.stringify(groups.at(-1)));
    await writeFile(resolve('.mosaic/slow-startup/near-motion-partial.json'),
      JSON.stringify({ groups, rows }, null, 2) + '\n');
  }
  const report = {
    sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
    protocol: {
      cases: CASES, variants: VARIANTS, repeats: REPEATS,
      browser: '412x915 Chromium, 2x CPU throttle, locally persisted task fixture, PWA precache',
      network: 'Every Appwrite request held; slow online all cases; offline dense 1000 control.',
      ablations: {
        'near-motion': 'Only rows inside drag-proximity 800px observer use Motion layout; other registered drag hooks and controls retained.',
        'near-motion-no-passive': 'Same with two inert offscreen target elements removed.',
        'no-idle-motion-no-passive': 'Prior test-only lower bound: Motion layout off until drag starts; gesture compatibility unverified.',
      },
      safeguards: 'Lab-only Vite compile flag, synthetic owner guard, never deploy/merge to stable.',
      limitations: [
        'Real Chromium first long-press overlay check included on 25-task baseline and near variants; multi-category/autoscroll and device gestures remain unproven.',
        'Readiness and DOM event response are browser proxies, not first-painted native touch.',
        'Three repetitions and shared order require a separate larger causal replication.',
        'Photo/Diary/shared, multi-account, real-device and cross-category/long-distance behavior remain untested.',
      ],
    },
    groups, rows,
  };
  await writeFile(resolve('.mosaic/slow-startup/near-motion.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log('MOSAIC_858_NEAR_FINAL ' + JSON.stringify(groups));
});
