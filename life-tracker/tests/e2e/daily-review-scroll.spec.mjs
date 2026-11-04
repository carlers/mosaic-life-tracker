import { expect, test } from '@playwright/test';

test.use({ ignoreHTTPSErrors: true, hasTouch: true });
const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

// Regression #1794: three columns remain visible at mobile and desktop
// widths. Native pan-y scrolls the inner Review, not the parent Swiper.
for (const viewport of [{ width: 1600, height: 900 }, { width: 390, height: 844 }]) {
  test('Daily Review three-column vertical scroll at ' + viewport.width + 'px', async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(BASE_URL + '/tests/e2e/daily-review-scroll.html');
    const outer = page.getByTestId('outer-ancestor');
    const inner = page.getByTestId('review-inner-scroller');
    await expect(page.locator('.swiper-slide-active')).toHaveCount(1);
    expect(await outer.evaluate(node => node.scrollLeft)).toBe(0);
    await page.getByRole('button', { name: 'Focus Execution' }).click();
    await page.getByRole('button', { name: 'Focus Reflection' }).click();
    await expect(page.locator('[data-review-stage]')).toHaveCount(3);
    expect(await inner.evaluate(node => node.scrollLeft)).toBe(0);
    expect(await outer.evaluate(node => node.scrollLeft)).toBe(0);
    expect(await page.locator('.swiper').evaluate(node => node.swiper?.activeIndex)).toBe(0);
    const sizes = await inner.evaluate(node => ({
      height: node.clientHeight, overflow: node.scrollHeight - node.clientHeight,
    }));
    expect(sizes.overflow).toBeGreaterThan(150);
    const rect = await inner.boundingBox();
    if (!rect) throw new Error('Review viewport is absent');
    const x = Math.min(viewport.width - 25, rect.x + Math.min(75, rect.width / 3));
    const y = rect.y + Math.min(190, rect.height - 25);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 420);
    await expect.poll(() => inner.evaluate(node => node.scrollTop)).toBeGreaterThan(60);
    expect(await outer.evaluate(node => node.scrollTop)).toBe(0);
    expect(await page.locator('.swiper').evaluate(node => node.swiper?.activeIndex)).toBe(0);
    if (viewport.width === 390) {
      await inner.evaluate(node => { node.scrollTop = 0; });
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 10; i++) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x, y: y - i * 13 }],
        });
        await page.waitForTimeout(16);
      }
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd', touchPoints: [],
      });
      await expect.poll(() => inner.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
      expect(await outer.evaluate(node => node.scrollTop)).toBe(0);
      expect(await page.locator('.swiper').evaluate(node => node.swiper?.activeIndex)).toBe(0);
      await client.detach();
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}
