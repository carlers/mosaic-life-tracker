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

  // Observe *ordering*, not a brittle poll of a 320ms animation phase.
  // The app must never lose its inert lock while the outgoing dialog exists.
  await page.evaluate(() => {
    const root = document.querySelector('#root');
    if (!root) throw new Error('Missing root');
    window.__modalLockLeak = false;
    window.__modalLockObserver = new MutationObserver(() => {
      if (!root.inert && document.querySelector('[role="dialog"]')) {
        window.__modalLockLeak = true;
      }
    });
    window.__modalLockObserver.observe(root, {
      attributes: true, attributeFilter: ['inert'],
    });
  });

  await page.evaluate(() => window.history.back());

  await expect(page.getByRole('dialog', { name: 'Parent sheet' })).toBeHidden();
  await expect.poll(() => page.locator('#root').evaluate((node) => node.inert)).toBe(false);
  await expect(opener).toBeFocused();
  const unlockedBeforeExit = await page.evaluate(() => {
    window.__modalLockObserver.disconnect();
    return window.__modalLockLeak;
  });
  expect(unlockedBeforeExit).toBe(false);
});


test('Back cannot dismiss a locked sheet while work is in flight', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);
  const baselineLength = await page.evaluate(() => window.history.length);

  await page.getByRole('button', { name: 'Open locked sheet' }).click();
  const locked = page.getByRole('dialog', { name: 'Locked sheet' });
  await expect(locked).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.history.length)).toBe(
    baselineLength + 1
  );

  await page.evaluate(() => window.history.back());

  await expect(locked).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.history.length)).toBe(
    baselineLength + 1
  );

  await page.getByRole('button', { name: 'Finish locked work' }).click();
  await expect(locked).toBeHidden();
});

test('nested sheets automatically prevent underlay interaction without caller suspension', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);
  const root = page.locator('#root');
  await page.getByRole('button', { name: 'Open parent sheet' }).click();
  await expect.poll(() => root.evaluate((node) => node.inert)).toBe(true);

  await page.getByRole('button', { name: 'Open nested sheet' }).click();
  const parent = page.getByRole('dialog', { name: 'Parent sheet', includeHidden: true });
  const nested = page.getByRole('dialog', { name: 'Nested sheet' });
  await expect(parent).toHaveAttribute('inert', '');
  await expect(nested).not.toHaveAttribute('inert');
  await expect(page.getByRole('button', { name: 'Open parent sheet', includeHidden: true })).not.toBeFocused();

  await page.evaluate(() => window.history.back());
  await expect(nested).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Parent sheet' })).toBeVisible();
  await expect(parent).not.toHaveAttribute('inert');
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole('dialog', { name: 'Parent sheet' })).toBeHidden();
  await expect.poll(() => root.evaluate((node) => node.inert)).toBe(false);
});

async function armExitTiming(page, title) {
  await page.evaluate((name) => {
    const sheet = [...document.querySelectorAll('[role="dialog"]')]
      .find((node) => node.querySelector('h3')?.textContent === name);
    if (!sheet) throw new Error('Expected sheet not mounted: ' + name);
    window.__sheetExitMs = null;
    const started = performance.now();
    const observer = new MutationObserver(() => {
      if (!sheet.isConnected) {
        window.__sheetExitMs = performance.now() - started;
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, title);
}

test('Android-style Back plays the full exit after clearing a memo entity', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);
  await page.getByRole('button', { name: 'Open data-clearing memo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Memo exit regression', includeHidden: true });
  await expect(dialog).toBeVisible();
  await armExitTiming(page, 'Memo exit regression');

  await page.evaluate(() => window.history.back());
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.__sheetExitMs)).toBeGreaterThan(180);
  await expect.poll(() => page.locator('#root').evaluate((node) => node.inert)).toBe(false);
});

test('data-backed message actions retain their exit after Android-style Back', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);
  await page.getByRole('button', { name: 'Open data-clearing message actions' }).click();
  const dialog = page.getByRole('dialog', { name: 'Message', includeHidden: true });
  await expect(dialog).toBeVisible();
  await armExitTiming(page, 'Message');

  await page.evaluate(() => window.history.back());
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.__sheetExitMs)).toBeGreaterThan(180);
});

test('dragging the header closes a sheet that initially mounted closed', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/bottom-sheet-history.html`);
  await page.getByRole('button', { name: 'Open data-clearing memo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Memo exit regression', includeHidden: true });
  await expect(dialog).toBeVisible();
  const handle = dialog.locator('.cursor-grab').first();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, centerY + 190, { steps: 12 });
  await page.mouse.up();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.locator('#root').evaluate((node) => node.inert)).toBe(false);
});
