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

test('Calendar fits fixed navigation after reported 841px viewport height with a crowded middle week', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 841 });
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=reported`);

  const slide = page.locator('[data-calendar-slide-index="30"]');
  const lastTask = slide.locator('[title="Final sparse week task"]');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const main = page.locator('[data-mosaic-main-scroll="true"]');
  await expect(lastTask).toHaveCount(1);

  const geometry = await slide.evaluate(el => {
    const grid = el.querySelector('[role="grid"]');
    const nav = document.querySelector('nav[aria-label="Main"]');
    return {
      slideBottom: el.getBoundingClientRect().bottom,
      navTop: nav?.getBoundingClientRect().top,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      gridHeight: grid?.getBoundingClientRect().height,
    };
  });
  expect(geometry.slideBottom,
    `Calendar viewport extends behind fixed navigation: ${JSON.stringify(geometry)}`)
    .toBeLessThanOrEqual(geometry.navTop + 1);
  expect(await main.evaluate(el => el.scrollTop)).toBe(0);
  expect(geometry.scrollHeight - geometry.clientHeight,
    `Crowded middle week must scroll within slide: ${JSON.stringify(geometry)}`)
    .toBeGreaterThan(20);

  const box = await slide.boundingBox();
  if (!box) throw Error('Missing calendar scroll viewport');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(160, box.height / 3));
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 420);
  await expect.poll(() => slide.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
  const last = await lastTask.boundingBox();
  const bar = await nav.boundingBox();
  if (!last || !bar) throw Error('Missing final week or navigation');
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y + 1);
  expect(await main.evaluate(el => el.scrollTop)).toBe(0);
});

test('Calendar reclaims native scroll when its route-height ancestor exceeds the visible area by 140px', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 841 });
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=reported`);

  const slide = page.locator('[data-calendar-slide-index="30"]');
  const lastTask = slide.locator('[title="Final sparse week task"]');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(lastTask).toHaveCount(1);

  // Recreate the actual owner's broken geometry: a 690px month slide ends
  // 140px behind a nav starting at 777px. The DOM otherwise has a normal
  // calendar with a crowded middle week and a sparse final week.
  await page.locator('[data-testid="primary-route-content"]').evaluate(node => {
    const height = node.getBoundingClientRect().height;
    node.style.height = `${height + 140}px`;
  });

  await expect.poll(() => slide.evaluate(node => {
    const nav = document.querySelector('nav[aria-label="Main"]');
    return node.getBoundingClientRect().bottom -
      (nav?.getBoundingClientRect().top ?? 0);
  })).toBeLessThanOrEqual(1);

  await expect.poll(() => slide.evaluate(node => node.scrollHeight - node.clientHeight))
    .toBeGreaterThan(20);

  const box = await slide.boundingBox();
  if (!box) throw new Error('Missing native calendar scroller');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(120, box.height / 3));
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 470);
  await expect.poll(() => slide.evaluate(node => node.scrollTop)).toBeGreaterThan(20);

  const last = await lastTask.boundingBox();
  const bar = await nav.boundingBox();
  if (!last || !bar) throw new Error('Missing final week or nav');
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y + 1);
});
