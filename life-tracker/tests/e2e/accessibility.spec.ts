import { test } from '@playwright/test';

test('accessibility browser surface loads', async ({ page }) => {
  await page.goto('/');
});
