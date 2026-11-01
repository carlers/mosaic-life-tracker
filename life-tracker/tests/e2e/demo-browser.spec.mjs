
import { test, expect } from '@playwright/test';

const demoURL = process.env.MOSAIC_DEMO_TEST_URL;

test.describe('isolated public Mosaic live demo (#1617)', () => {
  test.skip(!demoURL, 'Demo browser check runs only against the local standalone demo build.');

  test('opens fictional data, persists edits, and resets without outbound calls', async ({ page }) => {
    const outbound = [];
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (new URL(url).origin === new URL(demoURL).origin) {
        await route.continue();
      } else {
        outbound.push(url);
        await route.abort();
      }
    });
    await page.goto(demoURL);
    await expect(page.getByText('Mosaic · Live demo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset demo' })).toBeEnabled({ timeout: 12000 }).catch(async error => {
      const demoErrors = await page.locator('.demo-error').allTextContents();
      throw new Error(String(error) + '\\nBrowser errors: ' + JSON.stringify(pageErrors) + '\\nDemo errors: ' + JSON.stringify(demoErrors));
    });
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    await page.locator('[data-calendar-day="' + today + '"]').first().click();
    await expect(page.getByText('Build a landing page demo')).toBeVisible();

    await page.getByRole('textbox', { name: 'New task' }).fill('Prototype a fictional task');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Prototype a fictional task')).toBeVisible();
    await page.reload();
    await page.locator('[data-calendar-day="' + today + '"]').first().click();
    await expect(page.getByText('Prototype a fictional task')).toBeVisible();

    await page.getByRole('button', { name: 'Delete Prototype a fictional task' }).click();
    await expect(page.getByText('Prototype a fictional task')).toHaveCount(0);
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page.getByRole('textbox', { name: 'New category name' }).fill('Learning');
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByRole('textbox', { name: 'Name of Learning' })).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await expect(page.getByRole('textbox', { name: 'Name of Learning' })).toHaveCount(0);
    await expect(page.getByText('Prototype a fictional task')).toHaveCount(0);
    expect(outbound).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
