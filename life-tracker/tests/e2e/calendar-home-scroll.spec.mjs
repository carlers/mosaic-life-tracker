import { expect, test } from '@playwright/test';

test.use({ ignoreHTTPSErrors: true });

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
      const mainScroller = page.locator('[data-mosaic-main-scroll="true"]');
      const homeHeader = await page.getByTestId('home-identity-header').boundingBox();
      if (!homeHeader) throw new Error('Missing Home header');
      await page.mouse.move(homeHeader.x + 20, homeHeader.y + 20);
      await page.mouse.wheel(0, 450);
      expect(await mainScroller.evaluate(el => el.scrollTop))
        .toBe(0);

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

test('observed October density with real header heights can scroll past middle task stack', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1068 });
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?fixture=observed`);
  const slide = page.locator('[data-calendar-slide-index="30"]');
  const lastTask = slide.locator('[title="Final sparse week task"]');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(lastTask).toHaveCount(1);
  const report = () => page.evaluate(() => {
    const slide = document.querySelector('[data-calendar-slide-index="30"]');
    const grid = slide?.querySelector('[role="grid"]');
    const nav = document.querySelector('nav[aria-label="Main"]');
    const main = document.querySelector('[data-mosaic-main-scroll="true"]');
    if (!(slide instanceof HTMLElement) || !(grid instanceof HTMLElement)) return { error: 'slide or grid missing' };
    const box = (el) => el?.getBoundingClientRect().toJSON();
    return {
      slide: { client: slide.clientHeight, scroll: slide.scrollHeight, top: slide.scrollTop,
        overflow: getComputedStyle(slide).overflowY, box: box(slide) },
      grid: { client: grid.clientHeight, scroll: grid.scrollHeight, box: box(grid) },
      nav: box(nav), main: main && { client: main.clientHeight, scroll: main.scrollHeight,
        top: main.scrollTop, overflow: getComputedStyle(main).overflowY },
      last: box(slide.querySelector('[title="Final sparse week task"]')),
      activeSlides: Array.from(document.querySelectorAll('[role="region"][aria-label="Month calendar scroll"]')).map(el => ({
        index: el.dataset.calendarSlideIndex, height: el.clientHeight, scroll: el.scrollHeight
      })),
    };
  });
  const start = await report();
  console.log('CALENDAR_REAL_DENSITY_START', JSON.stringify(start));
  expect(start.slide.scroll - start.slide.client,
    `Last calendar week extends beyond native scroller: ${JSON.stringify(start)}`).toBeGreaterThan(20);

  const mid = slide.locator('[data-calendar-day="2026-10-15"]');
  const target = await mid.boundingBox();
  const viewport = await slide.boundingBox();
  if (!target || !viewport) throw Error('Missing calendar task stack or slide bounds');
  await page.mouse.move(
    target.x + Math.min(target.width / 2, 25),
    Math.max(viewport.y + 20, Math.min(target.y + Math.min(target.height / 2, 60), viewport.y + viewport.height - 25)),
  );
  for (let n = 0; n < 8; n++) await page.mouse.wheel(0, 470);
  const end = await report();
  console.log('CALENDAR_REAL_DENSITY_END', JSON.stringify(end));
  expect(end.slide.top, `Native calendar never scrolled: ${JSON.stringify(end)}`).toBeGreaterThan(20);
  const last = await lastTask.boundingBox();
  const bounds = await nav.boundingBox();
  if (!last || !bounds) throw Error('Missing final week/nav bounds');
  expect(last.y).toBeGreaterThanOrEqual(viewport.y - 1);
  expect(last.y + last.height).toBeLessThanOrEqual(bounds.y + 1);
});
