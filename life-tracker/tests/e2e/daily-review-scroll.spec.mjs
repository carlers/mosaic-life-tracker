import { expect, test } from '@playwright/test';

test.use({ ignoreHTTPSErrors: true, hasTouch: true });
const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

// Regression #1794: Overview has three columns at every viewport width,
// Focus shows only one full-width stage; pan-y stays inside the review Swiper.
for (const viewport of [{ width: 1600, height: 900 }, { width: 390, height: 844 }]) {
  test('Daily Review three-column vertical scroll at ' + viewport.width + 'px', async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(BASE_URL + '/tests/e2e/daily-review-scroll.html');
    const outer = page.getByTestId('outer-ancestor');
    const inner = page.getByTestId('review-inner-scroller');
    await expect(page.locator('.swiper-slide-active')).toHaveCount(1);
    expect(await outer.evaluate(node => node.scrollLeft)).toBe(0);
    const columns = inner.locator('[data-review-stage]');
    await expect(columns).toHaveCount(3);
    await expect(inner.locator('[data-review-stage]:visible')).toHaveCount(3);
    const overviewBounds = await columns.evaluateAll(nodes =>
      nodes.map(node => {
        const r = node.getBoundingClientRect();
        return { x: r.x, width: r.width };
      }));
    expect(overviewBounds[0].x).toBeLessThan(overviewBounds[1].x);
    expect(overviewBounds[1].x).toBeLessThan(overviewBounds[2].x);
    expect(Math.abs(overviewBounds[0].width - overviewBounds[1].width)).toBeLessThan(2);
    await page.getByRole('button', { name: 'Focus Execution' }).click();
    await page.getByRole('button', { name: 'Focus Reflection' }).click();
    const focused = inner.locator('[data-review-stage]:visible');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveAttribute('data-review-stage', 'Reflection');
    const focusedBounds = await focused.boundingBox();
    const stripBounds = await inner.boundingBox();
    if (!focusedBounds || !stripBounds) throw new Error('Missing focused review bounds');
    expect(Math.abs(focusedBounds.width - stripBounds.width)).toBeLessThan(4);
    await page.getByRole('button', { name: 'Show Overview' }).click();
    await expect(inner.locator('[data-review-stage]:visible')).toHaveCount(3);
    await page.getByRole('button', { name: 'Focus Reflection' }).click();
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
