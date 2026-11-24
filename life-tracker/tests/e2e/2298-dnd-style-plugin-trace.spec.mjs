import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 850 }, hasTouch: false, isMobile: false });

async function traceStop(cdp) {
  const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await done;
  if (!stream) throw Error('No Chromium trace stream');
  const buffers = [];
  try {
    while (true) {
      const chunk = await cdp.send('IO.read', { handle: stream });
      buffers.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
      if (chunk.eof) break;
    }
  } finally { await cdp.send('IO.close', { handle: stream }); }
  return JSON.parse(Buffer.concat(buffers).toString('utf8'));
}
function quartile(a, p) {
  if (!a.length) return 0;
  const sorted = [...a].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}
function report(trace, mode) {
  const events = trace.traceEvents ?? [];
  const kinds = ['UpdateLayoutTree', 'Layout', 'HitTest', 'FunctionCall'];
  const summary = Object.fromEntries(kinds.map(kind => {
    const eventsForKind = events.filter(e => e.name === kind && e.ph === 'X');
    const ms = eventsForKind.map(e => (e.dur ?? 0) / 1000);
    return [kind, { count: ms.length, sumMs: +ms.reduce((a, b) => a + b, 0).toFixed(2),
      p50Ms: +quartile(ms, .5).toFixed(2), p95Ms: +quartile(ms, .95).toFixed(2),
      maxMs: +Math.max(0, ...ms).toFixed(2) }];
  }));
  const layout = events.filter(e => e.name === 'Layout' && e.ph === 'X');
  const partial = layout.filter(e => e.args?.beginData?.partialLayout).length;
  const reasons = {};
  for (const e of events) if (e.name === 'StyleRecalcInvalidationTracking') {
    const key = e.args?.data?.reason || 'unattributed';
    reasons[key] = (reasons[key] ?? 0) + 1;
  }
  return { mode, summary, invalidationEvents: events.filter(e => e.name === 'LayoutInvalidationTracking').length, partialLayouts: partial, wholeLayouts: layout.length - partial,
    roots: [...new Set(layout.flatMap(e => (e.args?.endData?.layoutRoots ?? []).map(r => r.nodeName)))],
    reasons };
}
async function point(locator) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  if (!rect) throw Error('No drag target geometry');
  return { x: rect.x + rect.width * .5, y: rect.y + rect.height * .5 };
}
async function drag(page, source, target, overlay, kind) {
  const from = await point(source);
  const to = await point(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  try {
    if (kind === 'task') await page.waitForTimeout(580);
    else await page.mouse.move(from.x, from.y + 12, { steps: 5 });
    await expect(overlay).toBeVisible({ timeout: 7000 });
    for (let pass = 0; pass < 2; pass++) {
      await page.mouse.move(to.x, to.y, { steps: 16 });
      await page.waitForTimeout(80);
      await page.mouse.move(from.x, from.y, { steps: 16 });
      await page.waitForTimeout(80);
    }
  } finally {
    await page.mouse.up();
  }
  await expect(overlay).toHaveCount(0, { timeout: 7000 });
  await page.waitForTimeout(120);
}

for (const mode of ['baseline', 'cursorless', 'selectionless', 'scoped', 'no-feedback']) {
  test('@performance #2298 dense synthetic layout trace ' + mode, async ({ page }, info) => {
    test.setTimeout(100000);
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE).origin ?
      route.continue() : route.abort());
    const url = BASE + '/tests/e2e/interaction-contract.html?splitRows=1&side=right&splitPanelProbe=grid&splitHeavy=1&splitProfile=grid' +
      (mode === 'baseline' ? '' : '&mosaic2298Plugins=' + mode);
    await page.goto(url);
    const date = await page.getByTestId('split-workspace').getAttribute('data-profile-date');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.locator('[data-calendar-slide-index="30"] [data-calendar-day="' + date + '"]').click();
    const root = page.getByRole('complementary', { name: 'Day details' });
    await expect(root).toBeVisible();
    const slide = root.locator('.swiper-slide-active [data-testid="day-slide"]');
    await expect(slide.locator('[data-task-id="profile_task_0"]')).toBeVisible({ timeout: 12000 });
    await page.waitForTimeout(450);
    const dims = await slide.evaluate(el => ({
      width: el.getBoundingClientRect().width, nodes: document.querySelectorAll('*').length,
      slideNodes: el.querySelectorAll('*').length,
      rootInert: Boolean(document.getElementById('root')?.inert),
      activeTasks: el.querySelectorAll('[data-task-id]').length,
      panelParentIsBody: document.querySelector('[data-testid="day-panel-motion-host"]')?.parentElement === document.body,
    }));
    expect(dims.nodes).toBeGreaterThan(7300);
    expect(dims.activeTasks).toBeGreaterThanOrEqual(13);
    expect(dims.panelParentIsBody).toBe(false);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Tracing.start', {
      categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking',
      transferMode: 'ReturnAsStream',
    });
    try {
      for (let i = 0; i < 3; i++) {
        await drag(page, slide.getByRole('button', { name: 'Profile task 1', exact: true }),
          slide.getByRole('button', { name: 'Profile task 3', exact: true }),
          page.locator('[data-task-drag-overlay="true"]'), 'task');
      }
      const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '');
      expect(selectedText.length, 'native text selection during touch-like task drag').toBeLessThan(1);
    } finally {
      const trace = await traceStop(cdp);
      const result = { ...report(trace, mode), dimensions: dims };
      await writeFile(info.outputPath('summary.json'), JSON.stringify(result, null, 2));
      console.log('MOSAIC_2298_PLUGIN_STYLE_TRACE ' + JSON.stringify(result));
      await cdp.detach();
    }
  });
}

for (const mode of ['baseline', 'scoped', 'no-feedback', 'manual-overlay']) {
  test('@performance #2298 overlay-pointer differential ' + mode, async ({ page }) => {
    test.setTimeout(30000);
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE).origin ?
      route.continue() : route.abort());
    await page.goto(BASE + '/tests/e2e/interaction-contract.html?splitPanelProbe=grid&side=right&splitRows=1&splitProfile=grid' +
      (mode === 'baseline' ? '' : '&mosaic2298Plugins=' + mode));
    const date = await page.getByTestId('split-workspace').getAttribute('data-profile-date');
    await page.locator('[data-calendar-slide-index="30"] [data-calendar-day="' + date + '"]').click();
    const slide = page.getByRole('complementary', { name: 'Day details' }).locator('.swiper-slide-active [data-testid="day-slide"]');
    const source = slide.getByRole('button', { name: 'Profile task 1', exact: true });
    const from = await point(source);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    try {
      await page.waitForTimeout(580);
      const overlay = page.locator('[data-task-drag-overlay="true"]');
      await expect(overlay).toBeVisible({ timeout: 5000 });
      const before = await overlay.boundingBox();
      if (!before) throw Error('Overlay not in document');
      await page.mouse.move(from.x + 75, from.y + 65, { steps: 15 });
      const after = await overlay.boundingBox();
      if (!after) throw Error('Overlay lost');
      const result = {mode, expectedDx: 75, expectedDy: 65,
        actualDx: +(after.x - before.x).toFixed(2), actualDy: +(after.y - before.y).toFixed(2),
        initial: { w: before.width, h: before.height }, final: { w: after.width, h: after.height }};
      console.log('MOSAIC_2298_POINTER_FOLLOW ' + JSON.stringify(result));
      if (mode !== 'no-feedback') {
        expect(Math.abs(result.actualDx - result.expectedDx)).toBeLessThan(6);
        expect(Math.abs(result.actualDy - result.expectedDy)).toBeLessThan(6);
      }
    } finally { await page.mouse.up(); }
    await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(0);
  });
}
