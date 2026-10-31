import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

// #1388: a real app-height Home layout and input-driven vertical scrolling.
// Earlier regressions tested only a 280px fixture with all tasks in the last
// week, and directly assigned scrollTop. They could pass while users could
// not reach an ordinary sparse final week behind the fixed bottom bar.
for (const viewport of [
  { width: 2048, height: 1070 },
  { width: 412, height: 915 },
]) {
  for (const zoom of ['default', 'zoom']) {
    test(`full Home Calendar ${viewport.width}px ${zoom} reaches final week by wheel input`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
      await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?mode=${zoom}`);
      const slide = page.locator('[data-calendar-slide-index="30"]');
      const finalTask = slide.locator('[title="Final sparse week task"]');
      const bottomNav = page.getByRole('navigation', { name: 'Main' });
      await expect(finalTask).toHaveCount(1);
      await expect(bottomNav).toBeVisible();
      const geometry = await slide.evaluate(el => ({
        client: el.clientHeight,
        scroll: el.scrollHeight,
      }));
      expect(geometry.scroll - geometry.client).toBeGreaterThan(100);

      const box = await slide.boundingBox();
      if (!box) throw new Error('Missing active Calendar viewport');
      await page.mouse.move(box.x + Math.min(box.width / 2, 220), box.y + Math.min(140, box.height / 3));
      for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 560);

      await expect.poll(() => slide.evaluate(el => el.scrollTop), { timeout: 4500 }).toBeGreaterThan(50);
      const bottom = await finalTask.boundingBox();
      const nav = await bottomNav.boundingBox();
      if (!bottom || !nav) throw new Error('Missing last task/nav bounds');
      const diagnostic = await slide.evaluate(el => ({
        top: el.scrollTop, max: el.scrollHeight - el.clientHeight,
        bottom: el.getBoundingClientRect().bottom,
        ancestors: Array.from((function*(n) { for (let i = 0; n && i < 8; i++, n = n.parentElement) yield n; })(el))
          .map(n => ({className: n.className?.toString().slice(0, 80), height: n.clientHeight, scrollHeight: n.scrollHeight, y: getComputedStyle(n).overflowY})),
      }));
      expect(bottom.y + bottom.height,
        `Last week clipped by nav; geometry ${JSON.stringify(diagnostic)}`).toBeLessThanOrEqual(nav.y + 1);
      expect(diagnostic.max - diagnostic.top).toBeLessThanOrEqual(2);
    });
  }
}
