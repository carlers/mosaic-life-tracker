import { expect, test } from '@playwright/test';

const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 850 },
  hasTouch: false, isMobile: false });

function stats(trace, mode, nodes, rows) {
  const events = trace.traceEvents || [];
  const names = ['UpdateLayoutTree', 'Layout', 'FunctionCall', 'HitTest'];
  const totals = Object.fromEntries(names.map(name => {
    const hits = events.filter(e => e.name === name && e.ph === 'X');
    const ms = hits.map(e => (e.dur || 0) / 1000).sort((a,b) => a-b);
    return [name, { count: hits.length, ms: +(ms.reduce((a,b) => a+b, 0)).toFixed(2),
      p95: +(ms[Math.min(ms.length-1, Math.ceil(ms.length*.95)-1)] || 0).toFixed(2),
      max: +(ms[ms.length-1] || 0).toFixed(2) }];
  }));
  return { mode, nodes, rows, totals,
    layoutRoots: [...new Set(events.filter(e => e.name === 'Layout' && e.ph === 'X')
      .flatMap(e => e.args?.endData?.layoutRoots?.map(r => r.nodeName) ?? []))],
    ruleChanges: events.filter(e => e.name === 'StyleRecalcInvalidationTracking' &&
      e.args?.data?.reason === 'Style rule change').length
  };
}
async function traceStop(cdp) {
  const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await done;
  const chunks = [];
  try {
    while (true) {
      const chunk = await cdp.send('IO.read', { handle: stream });
      chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
      if (chunk.eof) break;
    }
  } finally { await cdp.send('IO.close', { handle: stream }); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  if (!rect) throw Error('No drag geometry');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
for (const mode of ['baseline', 'memo']) {
  test('@performance #2298 dense task projection ' + mode, async ({ page }) => {
    test.setTimeout(110000);
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE).origin
      ? route.continue() : route.abort());
    await page.goto(BASE + '/tests/e2e/interaction-contract.html?splitRows=1&splitDense=1&side=right&splitPanelProbe=grid' +
      (mode === 'memo' ? '&mosaic2298Memo=1' : ''));
    const date = await page.getByTestId('split-workspace').getAttribute('data-profile-date');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.locator('[data-calendar-slide-index="30"] [data-calendar-day="' + date + '"]').click();
    const root = page.getByRole('complementary', { name: 'Day details' });
    const slide = root.locator('.swiper-slide-active [data-testid="day-slide"]');
    await expect(slide.locator('[data-task-id="dense_task_0"]')).toBeVisible({ timeout: 15000 });
    const rows = await slide.locator('[data-task-id]').count();
    const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(rows).toBeGreaterThanOrEqual(110);
    await page.waitForTimeout(400);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Tracing.start', {categories: 'devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReturnAsStream'});
    let result;
    try {
      for (let i = 0; i < 3; i++) {
        const source = slide.getByRole('button', { name: 'Dense task 1', exact: true });
        const target = slide.getByRole('button', { name: 'Dense task 3', exact: true });
        const from = await center(source), to = await center(target);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        try {
          await page.waitForTimeout(560);
          await expect(page.locator('[data-task-drag-overlay="true"]')).toBeVisible({ timeout: 8000 });
          for (let pass=0; pass<2; pass++) {
            await page.mouse.move(to.x, to.y, { steps: 30 });
            await page.mouse.move(from.x, from.y, { steps: 30 });
          }
        } finally { await page.keyboard.press('Escape'); await page.mouse.up(); }
        await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(0);
      }
    } finally {
      result = stats(await traceStop(cdp), mode, nodes, rows);
      console.log('MOSAIC_2298_DENSE_RENDER_TRACE ' + JSON.stringify(result));
      await cdp.detach();
    }
  });
}
