import { expect, test } from '@playwright/test';

test.use({ ignoreHTTPSErrors: true });

const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test('repeated tasks save when focus leaves an inline draft on an iPad-sized WebKit page', async ({ page }) => {
  // Exercise the original iPad-sized task-entry case even though the full
  // WebKit browser corpus uses a phone-sized default viewport.
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${BASE}/tests/e2e/interaction-contract.html?taskEntry=1`);
  const work = page.getByRole('button', { name: 'Add a task to Work' });
  const personal = page.getByRole('button', { name: 'Add a task to Personal' });
  const input = () => page.getByRole('textbox', { name: 'New task title' });

  await work.click();
  await input().fill('First task');
  await personal.click();
  await expect(page.getByTestId('saved-task-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'First task' })).toBeVisible();

  await input().fill('Second task');
  await work.click();
  await expect(page.getByTestId('saved-task-count')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Second task' })).toBeVisible();

  await input().fill('Third task');
  await input().press('Enter');
  await expect(page.getByTestId('saved-task-count')).toHaveText('3');
  await expect(page.getByRole('button', { name: 'Third task' })).toBeVisible();
  await expect(input()).toHaveCount(0);

  await personal.click();
  await input().fill(' ');
  await page.getByRole('heading', { name: 'Task input browser regression' }).click();
  await expect(input()).toHaveCount(0);
  await expect(page.getByTestId('saved-task-count')).toHaveText('3');
});
