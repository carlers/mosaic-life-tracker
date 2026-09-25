import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({
  ignoreHTTPSErrors: true,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 412, height: 915 },
  userAgent:
    'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 SamsungBrowser/28.0',
});

test('three nested sheets consume Back one layer at a time before route history', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/history-base.html`);
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);

  const sheetRoute = page.url();
  const baselineLength = await page.evaluate(() => window.history.length);

  await page.getByRole('button', { name: 'Open parent sheet' }).click();
  await expect(page.getByText('Parent content', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.history.length)).toBe(baselineLength + 1);

  await page.getByRole('button', { name: 'Open nested sheet' }).click();
  await expect(page.getByText('Nested content', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.history.length)).toBe(baselineLength + 2);

  await page.getByRole('button', { name: 'Open third sheet' }).click();
  await expect(page.getByText('Third content', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.history.length)).toBe(baselineLength + 3);

  await page.evaluate(() => window.history.back());
  await expect(page.getByText('Third content', { exact: true })).toBeHidden();
  await expect(page.getByText('Nested content', { exact: true })).toBeVisible();
  await expect(page.getByText('Parent content', { exact: true })).toBeVisible();
  expect(page.url()).toBe(sheetRoute);

  await page.evaluate(() => window.history.back());
  await expect(page.getByText('Nested content', { exact: true })).toBeHidden();
  await expect(page.getByText('Parent content', { exact: true })).toBeVisible();
  expect(page.url()).toBe(sheetRoute);

  await page.evaluate(() => window.history.back());
  await expect(page.getByText('Parent content', { exact: true })).toBeHidden();
  expect(page.url()).toBe(sheetRoute);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/tests\/e2e\/history-base\.html$/);
});

test('closing the final sheet with Back restores focus to its opener', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);
  const opener = page.getByRole('button', { name: 'Open parent sheet' });

  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Parent sheet' })).toBeVisible();

  await page.evaluate(() => window.history.back());

  await expect(page.getByRole('dialog', { name: 'Parent sheet' })).toBeHidden();
  await expect(opener).toBeFocused();
});
