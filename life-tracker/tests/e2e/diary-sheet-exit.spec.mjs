import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({ ignoreHTTPSErrors: true, hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

test('Nested action exit restores parent without a second late scale animation', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?nestedSheetProbe=1&nestedBlur=1`);
  await page.getByTestId('nested-parent-open').click();

  const parent = page.locator('[role="dialog"]').filter({
    has: page.getByTestId('nested-parent-content'),
  });
  const child = page.locator('[role="dialog"]').filter({
    has: page.getByTestId('nested-detail-content'),
  });
  await expect(parent).toBeVisible();
  const width = () => parent.evaluate(element => element.getBoundingClientRect().width);
  await expect.poll(width).toBeGreaterThan(410);
  const fullWidth = await width();

  // The upper sheet still gives the background visible depth while open.
  await page.getByTestId('nested-detail-open').click();
  await expect(child).toBeVisible();
  await expect.poll(width).toBeLessThan(fullWidth - 3);

  await page.getByTestId('nested-detail-close').click();
  // Closing still owns the inert stack and prevents premature interaction.
  await expect(parent).toHaveAttribute('inert');
  await expect(child).toHaveCount(0);

  // Previously the parent began its 320ms scale-back only *after* the child
  // disappeared. It must now be fully restored when the exit is finished.
  const samples = await parent.evaluate(async element => {
    const values = [];
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      values.push(element.getBoundingClientRect().width);
    }
    return values;
  });
  expect(Math.min(...samples)).toBeGreaterThan(fullWidth - 1.5);
  expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(1.25);
  await expect(parent).not.toHaveAttribute('inert');

  // Reopen and dismiss via Escape; modal ownership must not get stuck.
  await page.getByTestId('nested-detail-open').click();
  await expect(child).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(parent).not.toHaveAttribute('inert');
  await page.getByTestId('nested-parent-close').click();
  await expect(parent).toHaveCount(0);
});

test('Diary preserves its portal through an animated close and releases on completion', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?diaryExitProbe=1`);
  const open = page.getByTestId('diary-exit-open');
  const dialog = page.locator('[role="dialog"][aria-label="Diary"], [role="dialog"][aria-labelledby]');
  const exits = page.getByTestId('diary-exit-count');

  await open.click();
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  const nestedReply = page.getByText('Reply privately about the diary from 2026-09-15.');
  await expect(nestedReply).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nestedReply).toHaveCount(0);
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await expect(exits).toHaveText('0');

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
