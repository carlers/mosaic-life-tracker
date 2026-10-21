import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 850 }, isMobile: false, hasTouch: false });

async function alignment(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
    const selected = document.querySelector('[data-calendar-slide-index="30"]');
    if (!(viewport instanceof HTMLElement) || !(selected instanceof HTMLElement)) return 999;
    return Math.abs(selected.getBoundingClientRect().left - viewport.getBoundingClientRect().left);
  });
}

async function inspectGeometry(page, stage) {
  const snapshot = await page.evaluate(() => {
    const viewport = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
    const slide = document.querySelector('[data-calendar-slide-index="30"]');
    const track = viewport?.firstElementChild;
    const panel = document.querySelector('[data-testid="day-panel-motion-host"]');
    const frame = document.querySelector('.mosaic-calendar-split');
    const rect = (node) => node instanceof Element ? {
      x: Math.round(node.getBoundingClientRect().x),
      width: Math.round(node.getBoundingClientRect().width),
    } : null;
    return { viewport: rect(viewport), slide: rect(slide), track: rect(track),
      panel: rect(panel), frame: rect(frame),
      transform: track instanceof HTMLElement ? getComputedStyle(track).transform : null,
      direction: frame instanceof HTMLElement ? getComputedStyle(frame).flexDirection : null };
  });
  console.log('MOSAIC_SPLIT_GEOMETRY ' + JSON.stringify({ stage, ...snapshot }));
}

for (const height of ['grid', 'screen']) {
  test('left inspector keeps the focused month aligned and fills the ' + height + ' workspace', async ({ page }) => {
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?splitPanelProbe=${height}&side=left`);
    const viewport = page.locator('[data-route-swipe-horizontal-owner="true"]');
    await expect(viewport).toBeVisible();
    await expect.poll(() => alignment(page)).toBeLessThan(2);
    const first = page.locator('[data-calendar-slide-index="30"] [data-calendar-day]').first();
    await first.click();
    const inspector = page.getByRole('complementary', { name: 'Day details' });
    await expect(inspector).toBeVisible();
    await inspectGeometry(page, 'after-open-' + height);
    await expect.poll(() => alignment(page), { timeout: 5000 }).toBeLessThan(2);
    // Both the first and last weekday columns must belong to the selected
    // month, not the neighboring slide whose pixels could remain exposed.
    const grid = page.locator('[data-calendar-slide-index="30"] [role="grid"]');
    await expect(grid.getByRole('columnheader')).toHaveCount(7);
    const bounds = await page.evaluate((heightMode) => {
      const host = document.querySelector('[data-testid="day-panel-motion-host"]');
      const frame = document.querySelector(heightMode === 'screen'
        ? '[data-testid="split-workspace"]' : '[data-testid="split-calendar-frame"]');
      if (!(host instanceof HTMLElement) || !(frame instanceof HTMLElement)) return null;
      return { panel: host.getBoundingClientRect().toJSON(),
        frame: frame.getBoundingClientRect().toJSON() };
    }, height);
    if (!bounds) throw Error('Missing visible panel or workspace geometry');
    expect(Math.abs(bounds.panel.bottom - bounds.frame.bottom)).toBeLessThan(4);
    expect(Math.abs(bounds.panel.height - bounds.frame.height)).toBeLessThan(4);
    // The panel opens by revealing its width; opacity never performs the
    // reveal, and the calendar must land on its original selected snap.
    const motion = page.getByTestId('day-panel-motion-host');
    await expect(motion).toHaveCSS('opacity', '1');
    await expect(motion).toHaveCSS('transition-property', 'width');
    const divider = page.getByRole('separator', { name: 'Resize day details panel' });
    const box = await divider.boundingBox();
    if (!box) throw Error('Missing split divider');
    await page.mouse.move(box.x + box.width / 2, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 55, box.y + 50, { steps: 5 });
    await page.mouse.up();
    await inspectGeometry(page, 'after-drag-' + height);
    await expect.poll(() => alignment(page), { timeout: 5000 }).toBeLessThan(2);
    await page.getByRole('button', { name: 'Close day details' }).click();
    await expect(motion).toHaveCount(0);
    await expect.poll(() => alignment(page)).toBeLessThan(2);
  });
}
