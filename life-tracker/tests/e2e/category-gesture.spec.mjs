import { expect, test } from '@playwright/test';

const URL = (process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173') +
  '/tests/e2e/category-gesture.html';

test.use({
  ignoreHTTPSErrors: true,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 412, height: 915 },
});

async function center(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing category label bounds');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('mouse: stationary hold opens Edit, then movement lifts category', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  await expect(label).toBeVisible();
  const point = await center(label);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await page.mouse.move(point.x, point.y + 105, { steps: 12 });
  await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByTestId('category-drag-active')).toHaveText('no');
});

test('touch: stationary hold opens Edit, then movement starts real Motion drag', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  await expect(label).toBeVisible();
  const { x, y } = await center(label);
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(650);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  for (let step = 1; step <= 12; step += 1) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + (120 * step) / 12 }],
    });
  }
  await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await expect(page.getByTestId('category-drag-active')).toHaveText('no');
});
