import { expect, test } from '@playwright/test';
test.use({ ignoreHTTPSErrors: true });
const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

for (const viewport of [{ width: 412, height: 750 }, { width: 1440, height: 810 }]) {
  test('Widgets page uses a real vertical scrollport and reaches the last widget at ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(BASE + '/tests/e2e/widgets-scroll.html');
    const scroll = page.getByTestId('widgets-page');
    await expect(scroll).toBeVisible();
    const geometry = await scroll.evaluate(el => ({
      client: el.clientHeight, scroll: el.scrollHeight,
      wrapper: el.parentElement?.getBoundingClientRect().height,
    }));
    expect(geometry.client, JSON.stringify(geometry)).toBeGreaterThan(100);
    expect(geometry.scroll - geometry.client, JSON.stringify(geometry)).toBeGreaterThan(200);
    const top = await scroll.boundingBox();
    if (!top) throw Error('Missing Widgets scroller');
    await page.mouse.move(top.x + top.width / 2, top.y + 160);
    for (let i = 0; i < 7; i++) await page.mouse.wheel(0, 500);
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
    const final = await page.locator('[data-widget-id="weekly"]').boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    if (!final || !nav) throw Error('Missing last widget or bottom navigation');
    expect(final.y + final.height).toBeLessThanOrEqual(nav.y + 1);
    expect(await page.locator('[data-mosaic-main-scroll="true"]').evaluate(el => el.scrollTop)).toBe(0);
  });
}

test('Top categories retains widget height and scrolls all fifteen categories internally', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(BASE + '/tests/e2e/widgets-scroll.html');
  const category = page.getByRole('region', { name: 'Heaviest categories, last seven days' });
  const list = page.getByRole('list', { name: 'Categories by scheduled task count' });
  await expect(list.locator('li')).toHaveCount(15);
  const height = await category.evaluate(el => el.getBoundingClientRect().height);
  const before = await page.getByTestId('widgets-page').evaluate(el => el.scrollTop);
  const box = await list.boundingBox();
  if (!box) throw Error('Missing category scroll list');
  await page.mouse.move(box.x + box.width / 2, box.y + 65);
  await page.mouse.wheel(0, 380);
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
  expect(await category.evaluate(el => el.getBoundingClientRect().height)).toBe(height);
  expect(await page.getByTestId('widgets-page').evaluate(el => el.scrollTop)).toBe(before);
  const selector = page.getByRole('combobox', { name: 'Category history range: Last 7 days' });
  await selector.click();
  await page.getByRole('option', { name: 'Last 30 days' }).click();
  await expect(page.getByRole('combobox', { name: 'Category history range: Last 30 days' })).toBeVisible();
});

test('Edit disables Swiper navigation, grip drag stays in grid and resize tap is inert', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 790 });
  await page.goto(BASE + '/tests/e2e/widgets-scroll.html');
  await page.getByTestId('toggle-widgets-edit').click();
  const root = page.getByTestId('widgets-page');
  const first = page.locator('[data-widget-id="today"]');
  const second = page.locator('[data-widget-id="diary"]');
  const source = await first.boundingBox();
  const target = await second.boundingBox();
  if (!source || !target) throw Error('Missing widgets to drag');
  // Horizontal gesture from the page itself must not navigate away in Edit.
  await page.mouse.move(source.x + 35, source.y + 120);
  await page.mouse.down();
  await page.mouse.move(source.x + 200, source.y + 120, { steps: 7 });
  await page.mouse.up();
  await expect(page.getByTestId('swiper-active')).toHaveText('0');
  // Use the dedicated grip, not a moving target to calculate release.
  const grip = page.getByRole('button', { name: 'Drag Today to move' });
  const gripBox = await grip.boundingBox();
  if (!gripBox) throw Error('Missing move grip');
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2,
    gripBox.y + gripBox.height / 2 + target.y - source.y + 35, { steps: 12 });
  await expect(page.locator('[data-widget-drag-overlay="today"]')).toHaveCount(1);
  expect(await first.evaluate(el => getComputedStyle(el).position)).not.toBe('fixed');
  await page.mouse.up();
  await expect(page.locator('[data-widget-drag-overlay]')).toHaveCount(0);
  await expect(page.getByTestId('swiper-active')).toHaveText('0');
  const resize = page.getByRole('button', { name: 'Drag to resize Today to half width' });
  await resize.click();
  await expect(first).toHaveAttribute('data-widget-size', 'full');
  const rect = await resize.boundingBox();
  if (!rect) throw Error('Missing resize grip');
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 - 90, rect.y + rect.height / 2, { steps: 7 });
  await expect(first).toHaveAttribute('data-widget-size', 'half');
  await page.mouse.up();
  await expect(first).toHaveAttribute('data-widget-size', 'half');
  // A valid page-scroll gesture remains possible in Edit despite gesture ownership.
  await root.evaluate(el => { el.scrollTop = 0; });
  const scrollBox = await root.boundingBox();
  if (!scrollBox) throw Error('Missing scrollbox');
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + 170);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => root.evaluate(el => el.scrollTop)).toBeGreaterThan(10);
});
