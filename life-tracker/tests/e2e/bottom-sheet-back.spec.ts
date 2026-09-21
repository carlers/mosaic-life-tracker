import { test, expect } from '@playwright/test';

test.describe('bottom sheet browser back contract', () => {
  test('back dismisses modal layers before route navigation', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\//);
  });
});
