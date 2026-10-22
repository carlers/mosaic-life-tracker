import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({ ignoreHTTPSErrors: true, hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

test('Diary preserves its portal through an animated close and releases on completion', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?diaryExitProbe=1`);
  const open = page.getByTestId('diary-exit-open');
  const dialog = page.locator('[role="dialog"][aria-label="Diary"], [role="dialog"][aria-labelledby]');
  const exits = page.getByTestId('diary-exit-count');

  await open.click();
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Close diary' }).click();
  // Closing sheets are inert, but their portals remain until Framer exits.
  await expect(page.getByTestId('diary-entry-sheet')).toHaveCount(1);
  await expect(exits).toHaveText('1');
  await expect(page.getByTestId('diary-entry-sheet')).toHaveCount(0);

  await open.click();
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(exits).toHaveText('2');
  await expect(page.getByTestId('diary-entry-sheet')).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
});
