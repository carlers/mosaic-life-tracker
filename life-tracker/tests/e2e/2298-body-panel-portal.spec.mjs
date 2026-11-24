import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 850 }, hasTouch: false, isMobile: false });

for (const mode of ['grid', 'screen']) {
  for (const side of ['left', 'right']) {
    test('@performance #2298 body portal retains side-panel geometry ' + mode + ' ' + side, async ({ page }) => {
      test.setTimeout(60000);
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE_URL).origin ?
        route.continue() : route.abort());
      await page.goto(BASE_URL + '/tests/e2e/interaction-contract.html?splitPanelProbe=' + mode +
        '&side=' + side + '&splitRows=1&mosaic2298BodyPanel=1');
      const viewport = page.locator('[data-route-swipe-horizontal-owner="true"]');
      await page.locator('[data-calendar-slide-index="30"] [data-calendar-day]').first().click();
      const panel = page.getByTestId('day-panel-motion-host');
      const slot = page.getByTestId('day-panel-reserved-slot');
      await expect(panel).toHaveAttribute('data-mosaic2298-body-panel', 'true');
      await expect(page.getByRole('complementary', { name: 'Day details' })).toBeVisible();
      await expect(slot).toBeVisible();
      await page.waitForTimeout(380);
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="day-panel-motion-host"]');
        const slot = document.querySelector('[data-testid="day-panel-reserved-slot"]');
        const viewport = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
        if (!panel || !slot || !viewport) return null;
        const a = panel.getBoundingClientRect();
        const b = slot.getBoundingClientRect();
        return { parentIsBody: panel.parentElement === document.body,
          dx: Math.abs(a.left - b.left), dy: Math.abs(a.top - b.top),
          dw: Math.abs(a.width - b.width), slotWidth: b.width, calendarWidth: viewport.getBoundingClientRect().width };
      });
      expect(geometry).not.toBeNull();
      expect(geometry.parentIsBody).toBe(true);
      expect(geometry.dx).toBeLessThan(2);
      expect(geometry.dy).toBeLessThan(2);
      expect(geometry.dw).toBeLessThan(2);
      expect(geometry.calendarWidth).toBeGreaterThan(300);
      const dragHandle = page.getByRole('separator', { name: 'Resize day details panel' });
      const bar = await dragHandle.boundingBox();
      if (!bar) throw Error('Resize handle inaccessible');
      const oldWidth = geometry.slotWidth;
      await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
      await page.mouse.down();
      await page.mouse.move(bar.x + bar.width / 2 + (side === 'right' ? -90 : 90), bar.y + bar.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => slot.boundingBox().then(rect => rect?.width ?? 0)).not.toBe(oldWidth);
      const after = await Promise.all([slot.boundingBox(), panel.boundingBox()]);
      expect(Math.abs(after[0].x - after[1].x)).toBeLessThan(2);
      expect(Math.abs(after[0].width - after[1].width)).toBeLessThan(2);
      await panel.getByRole('button', { name: 'Close day details' }).click();
      await expect(panel).toHaveCount(0, { timeout: 5000 });
      await expect(slot).toHaveCount(0);
      await expect(viewport).toBeVisible();
    });
  }
}

test('@performance #2298 task gesture remains operable after body portal', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE_URL).origin ?
    route.continue() : route.abort());
  await page.goto(BASE_URL + '/tests/e2e/interaction-contract.html?splitPanelProbe=grid&side=right&splitRows=1&mosaic2298BodyPanel=1');
  await page.locator('[data-calendar-slide-index="30"] [data-calendar-day]').first().click();
  const panel = page.getByTestId('day-panel-motion-host');
  const task = panel.locator('.swiper-slide-active [data-task-id]').first();
  await expect(task).toBeVisible();
  const box = await task.boundingBox();
  if (!box) throw Error('First task is not rendered');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(580);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 70, { steps: 12 });
  await expect(page.locator('[data-task-drag-overlay="true"]')).toBeVisible({ timeout: 5000 });
  await page.mouse.up();
  await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(0);
  await expect(panel.getByTestId('calendar-day-side-panel')).toBeVisible();
});
