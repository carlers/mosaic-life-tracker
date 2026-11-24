import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 841 }, isMobile: false, hasTouch: false });

async function finishTrace(cdp) {
  const completed = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await completed;
  if (!stream) throw new Error('Chromium did not return a trace stream');
  const chunks = [];
  try {
    while (true) {
      const result = await cdp.send('IO.read', { handle: stream });
      chunks.push(Buffer.from(result.data, result.base64Encoded ? 'base64' : 'utf8'));
      if (result.eof) break;
    }
  } finally {
    await cdp.send('IO.close', { handle: stream });
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function summarize(trace) {
  const events = trace.traceEvents ?? [];
  const groups = {};
  for (const event of events) {
    if (!['Layout', 'UpdateLayoutTree', 'LayoutInvalidationTracking', 'StyleRecalcInvalidationTracking', 'ScheduleStyleInvalidationTracking', 'HitTest', 'FunctionCall'].includes(event.name)) continue;
    const group = groups[event.name] ??= { count: 0, totalMs: 0, maxMs: 0, slow: [] };
    const ms = (event.dur ?? 0) / 1000;
    group.count++;
    group.totalMs += ms;
    group.maxMs = Math.max(group.maxMs, ms);
    if (ms >= 8) group.slow.push({ ms, beginData: event.args?.beginData, endData: event.args?.endData, data: event.args?.data });
  }
  for (const group of Object.values(groups)) {
    group.slow.sort((a, b) => b.ms - a.ms);
    group.slow = group.slow.slice(0, 12);
  }
  return groups;
}

async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing synthetic gesture target');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page, source, target, overlay, kind) {
  const from = await center(source);
  const to = await center(target);
  await page.evaluate(name => performance.mark(name + ':start'), kind);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  try {
    if (kind === 'task') await page.waitForTimeout(580);
    else await page.mouse.move(from.x, from.y + 10, { steps: 4 });
    await expect(overlay).toBeVisible({ timeout: 5000 });
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(to.x, to.y, { steps: 16 });
      await page.waitForTimeout(80);
      await page.mouse.move(from.x, from.y, { steps: 16 });
      await page.waitForTimeout(80);
    }
    // Return to the starting position before release; synthetic data only.
  } finally {
    await page.mouse.up();
  }
  await expect(overlay).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.evaluate(name => performance.mark(name + ':end'), kind);
}

for (const mode of ['grid', 'cursorless-grid', 'sheet', 'cursorless-sheet']) {
  test('@performance #2298 layout invalidation ' + mode, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    // Never send synthetic fixtures or credentials to a backend/analytics host.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === new URL(BASE_URL).origin ? route.continue() : route.abort();
    });
    await page.goto(BASE_URL + '/tests/e2e/interaction-contract.html?splitRows=1&side=right&splitPanelProbe=' +
      (mode === 'screen' ? 'screen' : 'grid') + '&splitProfile=' + (mode.endsWith('sheet') ? 'sheet' : mode) +
      (mode.startsWith('cursorless-') ? '&mosaic2298Cursorless=1' : ''));
    const date = await page.getByTestId('split-workspace').getAttribute('data-profile-date');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.locator('[data-calendar-slide-index="30"] [data-calendar-day="' + date + '"]').click();
    const shell = mode.endsWith('sheet') ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Day details' });
    await expect(shell).toBeVisible();
    const slide = shell.locator('.swiper-slide-active [data-testid="day-slide"]');
    await expect(slide).toBeVisible();
    await expect(slide.locator('[data-task-id="profile_task_0"]')).toBeVisible({ timeout: 12000 });
    await page.waitForTimeout(500);
    const dimensions = await slide.evaluate(el => ({
      width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height,
      nodes: document.querySelectorAll('*').length, slideNodes: el.querySelectorAll('*').length,
      taskCount: el.querySelectorAll('[data-task-id]').length,
      categoryCount: el.querySelectorAll('[data-task-category-id]').length,
      rootInert: Boolean(document.getElementById('root')?.inert),
      containment: getComputedStyle(el.closest('[data-testid="calendar-day-side-panel"]') ?? el).contain,
      hostContainment: getComputedStyle(document.querySelector('[data-testid="day-panel-motion-host"]') ?? el).contain,
      innerContainment: getComputedStyle(document.querySelector('[data-testid="day-panel-motion-host"]')?.firstElementChild ?? el).contain,
    }));
    expect(dimensions.taskCount).toBeGreaterThanOrEqual(13);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Tracing.start', {
      categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline.stack',
      transferMode: 'ReturnAsStream',
    });
    try {
      const task = slide.getByRole('button', { name: 'Profile task 1', exact: true });
      const taskTarget = slide.getByRole('button', { name: 'Profile task 3', exact: true });
      await drag(page, task, taskTarget, page.locator('[data-task-drag-overlay="true"]'), 'task');
      const category = slide.locator('[data-category-reorder-id="profile_cat_0"] [data-category-drag-handle]');
      const categoryTarget = slide.locator('[data-category-reorder-id="profile_cat_1"] [data-category-drag-handle]');
      await drag(page, category, categoryTarget, page.locator('[data-category-drag-overlay]'), 'category');
    } finally {
      const trace = await finishTrace(cdp);
      const layoutEvents = (trace.traceEvents ?? []).filter(e => e.name === 'Layout' && e.ph === 'X');
      const partialLayouts = layoutEvents.filter(e => e.args?.beginData?.partialLayout).length;
      const layoutRoots = Object.fromEntries([...new Set(layoutEvents.flatMap(e =>
        (e.args?.endData?.layoutRoots ?? []).map(r => r.nodeName ?? 'unknown')))].map(name =>
          [name, layoutEvents.filter(e => (e.args?.endData?.layoutRoots ?? []).some(r => r.nodeName === name)).length]));
      const styleReasons = Object.fromEntries([...new Set((trace.traceEvents ?? [])
        .filter(e => e.name === 'StyleRecalcInvalidationTracking')
        .map(e => e.args?.data?.reason).filter(Boolean))].map(reason => [reason,
          (trace.traceEvents ?? []).filter(e => e.name === 'StyleRecalcInvalidationTracking' &&
          e.args?.data?.reason === reason).length]));
      const metrics = { mode, dimensions, styleReasons, partialLayouts, wholeLayouts: layoutEvents.length - partialLayouts,
        layoutRoots, groups: summarize(trace) };
      await writeFile(testInfo.outputPath('layout-trace.json'), JSON.stringify(trace));
      await writeFile(testInfo.outputPath('layout-summary.json'), JSON.stringify(metrics, null, 2));
      console.log('MOSAIC_2298_TRACE_SUMMARY ' + JSON.stringify({ mode, dimensions, partialLayouts, wholeLayouts: metrics.wholeLayouts, layoutRoots, styleReasons, totals: Object.fromEntries(Object.entries(metrics.groups).map(([name, { count, totalMs, maxMs }]) => [name, { count, totalMs, maxMs }])) }));
      await cdp.detach();
    }
  });
}
