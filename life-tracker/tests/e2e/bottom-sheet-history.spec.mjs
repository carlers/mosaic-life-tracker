import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({ ignoreHTTPSErrors: true });

test('nested sheets consume Back one layer at a time before route history', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/history-base.html`);
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);

  const sheetRoute = page.url();
  const baselineLength = await page.evaluate(() => window.history.length);

  await page.getByRole('button', { name: 'Open parent sheet' }).click();
  await expect(page.getByText('Parent sheet', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.history.length))
    .toBe(baselineLength + 1);

  await page.getByRole('button', { name: 'Open nested sheet' }).click();
  await expect(page.getByText('Nested sheet', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.history.length))
    .toBe(baselineLength + 2);

  await page.evaluate(() => window.history.back());
  await expect(page.getByText('Nested sheet', { exact: true })).toBeHidden();
  await expect(page.getByText('Parent sheet', { exact: true })).toBeVisible();
  expect(page.url()).toBe(sheetRoute);

  await page.evaluate(() => window.history.back());
  await expect(page.getByText('Parent sheet', { exact: true })).toBeHidden();
  expect(page.url()).toBe(sheetRoute);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/tests\/e2e\/history-base\.html$/);
});
