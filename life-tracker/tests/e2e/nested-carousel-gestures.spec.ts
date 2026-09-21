import { test } from '@playwright/test';

test('calendar gesture ownership regression placeholder', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(100, 200);
  await page.mouse.up();
});
