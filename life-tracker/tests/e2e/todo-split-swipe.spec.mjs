import { test, expect } from '@playwright/test';
const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 850 }, isMobile: false, hasTouch: false });

async function aligned(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="todo-calendar-grid"]');
    const track = viewport?.firstElementChild;
    const active = [...(track?.children ?? [])].find(node => !node.hasAttribute('aria-hidden'));
    if (!(viewport instanceof HTMLElement) || !(active instanceof HTMLElement)) return 999;
    return Math.abs(active.getBoundingClientRect().left - viewport.getBoundingClientRect().left);
  });
}

async function swipe(page, direction) {
  const viewport = page.locator('[data-testid="todo-calendar-grid"]');
  const rect = await viewport.boundingBox();
  if (!rect) throw Error('Missing compact Todo calendar viewport');
  const title = await page.getByTestId('todo-split-month-title').textContent();
  await page.mouse.move(rect.x + rect.width * (direction === 'next' ? .82 : .18), rect.y + 95);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * (direction === 'next' ? .18 : .82), rect.y + 95, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('todo-split-month-title')).not.toHaveText(title ?? '');
  await expect.poll(() => aligned(page)).toBeLessThan(2);
  await expect(viewport).toHaveJSProperty('scrollLeft', 0);
}

for (const side of ['left', 'right']) {
  test('compact calendar keeps month alignment after ' + side + ' panel swipes and resize', async ({ page }) => {
    await page.goto(BASE_URL + '/tests/e2e/interaction-contract.html?todoSplitProbe=1&side=' + side);
    const viewport = page.getByTestId('todo-calendar-grid');
    await expect(viewport).toBeVisible();
    await expect.poll(() => aligned(page)).toBeLessThan(2);
    await swipe(page, 'next');
    await swipe(page, 'next');
    await swipe(page, 'prev');
    await page.getByTestId('todo-resize-panel').click();
    await expect.poll(() => aligned(page)).toBeLessThan(2);
    await swipe(page, 'next');
    await swipe(page, 'prev');
  });
}
