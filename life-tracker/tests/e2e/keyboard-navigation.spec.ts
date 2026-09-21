import { test } from '@playwright/test';

test('arrow navigation regression surface', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ArrowRight');
});
