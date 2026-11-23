import { expect, test } from '@playwright/test';

const URL = (process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173') +
  '/tests/e2e/mobile-task-keyboard.html';
test.use({
  ignoreHTTPSErrors: true, hasTouch: true, isMobile: true,
  viewport: { width: 412, height: 915 },
});

test('task blur preserves the sheet through keyboard viewport pan and restoration', async ({ page }) => {
  await page.addInitScript(() => {
    // Automated browsers do not summon the OS keyboard. Emulate its independent
    // VisualViewport offset and height without changing the CSS layout viewport.
    const visual = Object.assign(new EventTarget(), { scale: 1, height: 380, offsetTop: 445 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visual });
    window.__mosaicKeyboardViewport = visual;
  });
  await page.goto(URL);
  const dialog = page.getByRole('dialog', { name: 'Day View' });
  await expect(dialog).toBeVisible();
  const sheetAlignment = () => page.evaluate(() => {
    const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
    const visual = window.visualViewport;
    if (!rect || !visual) return 999;
    return Math.abs(rect.bottom - (visual.offsetTop + visual.height));
  });
  await expect.poll(sheetAlignment).toBeLessThanOrEqual(2);
  await page.getByRole('textbox', { name: 'New task title' }).fill('One task');
  await page.getByRole('button', { name: 'Empty day view space' }).tap();
  await expect(page.getByTestId('saved-tasks')).toHaveText('One task');
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const visual = window.__mosaicKeyboardViewport;
    visual.height = 915;
    visual.offsetTop = 0;
    visual.dispatchEvent(new Event('resize'));
  });
  await expect.poll(sheetAlignment).toBeLessThanOrEqual(2);
  await expect(dialog).toBeVisible();
});

test('first touch on backdrop saves task and does not dismiss Day View', async ({ page }) => {
  await page.goto(URL);
  const dialog = page.getByRole('dialog', { name: 'Day View' });
  await expect(dialog).toBeVisible();
  await page.getByRole('textbox', { name: 'New task title' }).fill('Tap-away task');
  const backdrop = page.getByTestId('bottom-sheet-backdrop');
  await backdrop.tap({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId('saved-tasks')).toHaveText('Tap-away task');
  await expect(dialog).toBeVisible();
  await backdrop.tap({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
});
