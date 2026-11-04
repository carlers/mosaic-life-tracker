import { expect, test } from '@playwright/test';

test.use({ ignoreHTTPSErrors: true });
const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

// Regression #1794: focusing inner review stages must not scroll ancestor
// containers or move Swiper to an adjacent friend's calendar.
for (const viewport of [{width:1600,height:900}, {width:390,height:844}]) {
  test(`Daily Review focus stays in its own horizontal strip at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto(`${BASE_URL}/tests/e2e/daily-review-scroll.html`);
    const outer = page.getByTestId('outer-ancestor');
    const inner = page.getByTestId('review-inner-scroller');
    await expect(page.locator('.swiper-slide-active')).toHaveCount(1);
    expect(await outer.evaluate(node => node.scrollLeft)).toBe(0);
    await page.getByRole('button', {name:'Focus Execution'}).click();
    await page.getByRole('button', {name:'Focus Reflection'}).click();
    await expect.poll(() => page.locator('.swiper').evaluate(node => node.swiper?.activeIndex ?? -1))
      .toBe(0);
    expect(await outer.evaluate(node => node.scrollLeft)).toBe(0);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    if (viewport.width < 768) {
      await expect.poll(() => inner.evaluate(node => node.scrollLeft)).toBeGreaterThan(100);
    } else {
      expect(await inner.evaluate(node => node.scrollLeft)).toBe(0);
    }
    // The same inner strip must own vertical scrolling. The horizontal overflow
    // element must not intercept vertical gestures with no scroll range.
    const sizes = await inner.evaluate(node => ({
      height: node.clientHeight, overflow: node.scrollHeight - node.clientHeight,
    }));
    expect(sizes.overflow).toBeGreaterThan(150);
    const rect = await inner.boundingBox();
    if (!rect) throw new Error('Missing review viewport');
    await page.mouse.move(rect.x + Math.min(80, rect.width / 3), rect.y + 80);
    await page.mouse.wheel(0, 420);
    await expect.poll(() => inner.evaluate(node => node.scrollTop)).toBeGreaterThan(60);
    expect(await outer.evaluate(node => node.scrollTop)).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.locator('.swiper').evaluate(node => node.swiper?.activeIndex)).toBe(0);

  });
}
