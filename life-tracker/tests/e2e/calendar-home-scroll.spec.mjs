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


test('six-month Home heatmap keeps the last row visible on wide panes and scroll-reachable on short phones', async ({ page }) => {
  const cases = [
    { width: 1728, height: 841, fitsWithoutScroll: true },
    { width: 1920, height: 1080, fitsWithoutScroll: true },
    { width: 375, height: 640, fitsWithoutScroll: false },
  ];
  for (const viewport of cases) {
    await page.setViewportSize(viewport);
    await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=compact`);
    const scroll = page.getByTestId('compact-home-scroll');
    const months = page.getByRole('group', { name: 'Six-month activity overview' });
    const lastMonth = page.getByRole('button', { name: 'Open December 2026, 0 tasks' });
    await expect(months.getByRole('button')).toHaveCount(6);
    await expect(scroll).toBeVisible();

    if (viewport.fitsWithoutScroll) {
      const last = await lastMonth.boundingBox();
      const visible = await scroll.boundingBox();
      if (!last || !visible) throw Error('Missing heatmap layout geometry');
      expect(last.y + last.height,
        'The sixth mini month should fit the allocated Home viewport without clipping')
        .toBeLessThanOrEqual(visible.y + visible.height + 1);
    }

    const box = await scroll.boundingBox();
    if (!box) throw Error('Missing heatmap scroll viewport');
    await page.mouse.move(box.x + Math.min(box.width / 2, 175), box.y + Math.min(box.height / 2, 140));
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 380);

    const last = await lastMonth.boundingBox();
    const visible = await scroll.boundingBox();
    const navigation = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    if (!last || !visible || !navigation) throw Error('Missing scroll/nav geometry');
    expect(last.y + last.height, 'The final mini month must be reachable above the bottom navigation')
      .toBeLessThanOrEqual(Math.min(visible.y + visible.height, navigation.y) + 1);
    expect(await scroll.evaluate(el => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1);
    
    // The owner's 6-month mode must actually provide larger cells than year
    // mode at the same viewport, not just omit six of the month cards.
    const sixMonth = page.getByTestId('compact-heatmap-month-2026-08');
    const sixCard = await sixMonth.boundingBox();
    const sixTile = await sixMonth.locator('[title="Aug 15: 0"]').boundingBox();
    await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=compact&mode=year`);
    const yearOverview = page.getByRole('group', { name: 'Year activity overview' });
    await expect(yearOverview.getByRole('button')).toHaveCount(12);
    const yearMonth = page.getByTestId('compact-heatmap-month-2026-08');
    const yearCard = await yearMonth.boundingBox();
    const yearTile = await yearMonth.locator('[title="Aug 15: 0"]').boundingBox();
    if (!sixCard || !sixTile || !yearCard || !yearTile)
      throw Error('Missing six-month/year comparison geometry');
    expect(sixTile.width, 'Six-month daily heatmap cells must be noticeably larger')
      .toBeGreaterThan(yearTile.width * 1.14);
    if (viewport.width >= 1700) {
      expect(sixTile.width, 'Desktop day cells must exceed the old 192px month-card cap')
        .toBeGreaterThan(viewport.height >= 1000 ? 40 : 30);
    }
    expect(sixCard.height, 'Six-month cards must be taller than full-year cards')
      .toBeGreaterThan(yearCard.height * 1.12);
  }
});

test('compact heatmap month cards opt into wallpaper-responsive glass with opaque fallback', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 841 });
  const base = `${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=compact`;
  await page.goto(base);
  const card = page.getByTestId('compact-heatmap-month-2026-08');
  await expect(card).toBeVisible();
  const solid = await card.evaluate(el => ({
    bg: getComputedStyle(el).backgroundColor,
    blur: getComputedStyle(el).backdropFilter,
  }));
  expect(solid.bg).toMatch(/^rgb\(/);
  expect(solid.blur).toBe('none');

  await page.goto(base + '&glass=soft');
  const frosted = await card.evaluate(el => ({
    bg: getComputedStyle(el).backgroundColor,
    blur: getComputedStyle(el).backdropFilter,
  }));
  expect(frosted.bg).toMatch(/^rgba\(/);
  expect(frosted.blur).toContain('blur(');

  await page.emulateMedia({ forcedColors: 'active' });
  await expect.poll(async () => card.evaluate(el => getComputedStyle(el).backdropFilter))
    .toBe('none');
});

test('compact six-month swipes navigate one period without selecting a month or stealing vertical scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=compact`);
  const overview = page.getByTestId('compact-activity-overview');
  const scroll = page.getByTestId('compact-home-scroll');
  const openedMonth = page.getByTestId('compact-month-opened');
  const swipe = async direction => {
    const b = await overview.boundingBox();
    if (!b) throw Error('Missing compact overview');
    const y = b.y + 70;
    const from = direction === 'next' ? b.x + b.width * 0.78 : b.x + b.width * 0.22;
    const to = direction === 'next' ? b.x + b.width * 0.22 : b.x + b.width * 0.78;
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 10 });
    await page.mouse.up();
  };

  await expect(overview.getByRole('button')).toHaveCount(6);
  await expect(overview.getByRole('button', { name: 'Open July 2026, 0 tasks' })).toBeVisible();
  await swipe('next');
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await expect(openedMonth).toHaveText('');
  await swipe('prev');
  await expect(overview.getByRole('button', { name: 'Open July 2026, 0 tasks' })).toBeVisible();
  await expect(openedMonth).toHaveText('');

  // A vertical wheel should keep the native Home scroll region, never change periods.
  const beforeScroll = await scroll.evaluate(el => el.scrollTop);
  const box = await overview.boundingBox();
  if (!box) throw Error('Missing compact overview');
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(beforeScroll);
  await expect(overview.getByRole('button', { name: 'Open July 2026, 0 tasks' })).toBeVisible();

  // Horizontal trackpad deltas navigate exactly one period.
  await scroll.evaluate(el => { el.scrollTop = 0; });
  const wheelBox = await overview.boundingBox();
  if (!wheelBox) throw Error('Missing compact overview for trackpad');
  await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + 75);
  await page.mouse.wheel(150, 0);
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await overview.getByRole('button', { name: 'Open January 2027, 0 tasks' }).click();
  await expect(openedMonth).toHaveText('2027-01');
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
});

test('compact year trackpad changes by one full year', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 841 });
  await page.goto(`${BASE_URL}/tests/e2e/calendar-home-scroll.html?scenario=compact&mode=year`);
  const overview = page.getByTestId('compact-activity-overview');
  const box = await overview.boundingBox();
  if (!box) throw Error('Missing full-year overview');
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.wheel(150, 0);
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await expect(overview.getByRole('button')).toHaveCount(12);
});

test('compact six-month drag follows the pointer with a visible adjacent period, settles and springs back', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 780 });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact');
  const overview = page.getByTestId('compact-activity-overview');
  const current = overview.getByRole('button', { name: 'Open July 2026, 0 tasks' });
  await expect(current).toBeVisible();
  const initial = await current.boundingBox();
  const bounds = await overview.boundingBox();
  if (!initial || !bounds) throw Error('Missing compact grid layout');
  const startX = bounds.x + bounds.width * 0.8;
  const y = bounds.y + 58;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 160, y + 3, { steps: 8 });
  await expect.poll(async () => (await current.boundingBox())?.x ?? 9999).toBeLessThan(initial.x - 105);
  const next = page.getByTestId('compact-activity-next');
  await expect(next).toHaveCount(1);
  await expect(next.getByTestId('compact-heatmap-month-2027-01')).toHaveCount(1);
  await expect.poll(async () => next.evaluate(node =>
    node.getBoundingClientRect().left < (node.parentElement?.getBoundingClientRect().right ?? 0)
  )).toBe(true);
  await page.mouse.up();
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await expect(next).toHaveCount(1);
  await expect(page.getByTestId('compact-month-opened')).toHaveText('');

  // A slow, undersized drag must return to the original position and date.
  const january = overview.getByRole('button', { name: 'Open January 2027, 0 tasks' });
  const resting = await january.boundingBox();
  const newBounds = await overview.boundingBox();
  if (!resting || !newBounds) throw Error('Missing settled grid');
  await page.mouse.move(newBounds.x + newBounds.width * 0.6, newBounds.y + 55);
  await page.mouse.down();
  await page.mouse.move(newBounds.x + newBounds.width * 0.6 + 32, newBounds.y + 55, { steps: 5 });
  await page.waitForTimeout(240);
  await page.mouse.up();
  await expect(next).toHaveCount(1);
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  // Wait for the actual compositor spring-back to finish before reversing.
  // Prewarmed neighbors no longer unmount as a settle-completion signal.
  await expect.poll(async () => january.evaluate(el => {
    const layer = el.closest('[data-testid="compact-activity-current"]');
    return Math.abs(new DOMMatrix(getComputedStyle(layer).transform).m41);
  })).toBeLessThan(1);
  await expect.poll(async () => Math.abs(((await january.boundingBox())?.x ?? 0) - resting.x)).toBeLessThan(2);

  // Drag the other way, then use an ordinary month click.
  // Regression: repeated desktop drags must not be lost to pointercancel.
  await overview.evaluate(el => {
    window.__compactMouseCancelCount = 0;
    el.addEventListener('pointercancel', event => {
      if (event.pointerType === 'mouse') window.__compactMouseCancelCount += 1;
    }, true);
  });
  await page.mouse.move(newBounds.x + newBounds.width * 0.2, newBounds.y + 58);
  await page.mouse.down();
  await page.mouse.move(newBounds.x + newBounds.width * 0.2 + 165, newBounds.y + 55, { steps: 9 });
  expect(await page.evaluate(() => window.__compactMouseCancelCount)).toBe(0);
  await expect.poll(async () => (await january.boundingBox())?.x ?? -9999).toBeGreaterThan(resting.x + 100);
  await page.mouse.up();
  await expect(next).toHaveCount(1);
  await expect(current).toBeVisible();
  await current.click();
  await expect(page.getByTestId('compact-month-opened')).toHaveText('2026-07');
});

test('full-year drag follows the finger and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact&mode=year');
  const overview = page.getByTestId('compact-activity-overview');
  const year = page.getByTestId('compact-heatmap-month-2026-01');
  const bounds = await overview.boundingBox();
  const before = await year.boundingBox();
  if (!bounds || !before) throw Error('Missing year overview');
  await page.mouse.move(bounds.x + bounds.width * 0.76, bounds.y + 60);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.51, bounds.y + 60, { steps: 10 });
  await expect.poll(async () => (await year.boundingBox())?.x ?? 9999).toBeLessThan(before.x - 100);
  await page.mouse.up();
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await expect(overview.getByRole('button')).toHaveCount(12);
  await expect(page.getByTestId('compact-activity-next')).toHaveCount(1);
});

test('touchscreen compact six-month paging follows a finger without treating a pinch as a swipe', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact');
  const overview = page.getByTestId('compact-activity-overview');
  const july = overview.getByRole('button', { name: 'Open July 2026, 0 tasks' });
  await expect(july).toBeVisible();
  const initial = await july.boundingBox();
  const box = await overview.boundingBox();
  if (!initial || !box) throw Error('Missing compact touch surface');
  const x = box.x + box.width * 0.8, y = box.y + 72;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x - 145 * step / 10, y }],
    });
  }
  await expect.poll(async () => (await july.boundingBox())?.x ?? 9999).toBeLessThan(initial.x - 85);
  await expect(page.getByTestId('compact-activity-next')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await expect(page.getByTestId('compact-activity-next')).toHaveCount(1);

  // Two active contacts are a zoom gesture, not a period swipe.
  const first = { id: 1, x: x - 95, y };
  const second = { id: 2, x: x - 45, y };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
    { id: 1, x: first.x - 80, y }, { id: 2, x: second.x + 80, y },
  ] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
  await expect(page.getByTestId('compact-activity-next')).toHaveCount(1);
});

test('both neighboring year grids are fully prepared before pointerdown and do not mount during dense glass swipes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact&mode=year&dense=true&glass=soft');
  const overview = page.getByTestId('compact-activity-overview');
  const current = page.getByTestId('compact-activity-current');
  const previous = page.getByTestId('compact-activity-previous');
  const next = page.getByTestId('compact-activity-next');
  await expect(overview.getByRole('button')).toHaveCount(12);
  await expect(previous.getByTestId('compact-heatmap-month-2025-01')).toHaveCount(1);
  await expect(next.getByTestId('compact-heatmap-month-2027-01')).toHaveCount(1);
  await expect(previous).toHaveAttribute('inert', '');
  await expect(next).toHaveAttribute('inert', '');

  await overview.evaluate(el => {
    window.__compactChildrenAdded = 0;
    window.__compactObserver?.disconnect();
    window.__compactObserver = new MutationObserver(changes => {
      window.__compactChildrenAdded += changes
        .filter(change => change.type === 'childList').reduce((sum, change) => sum + change.addedNodes.length, 0);
    });
    window.__compactObserver.observe(el, { childList: true, subtree: true });
  });
  const origin = await current.boundingBox();
  const area = await overview.boundingBox();
  if (!area || !origin) throw Error('Missing prewarmed grid geometry');
  const x = area.x + area.width * 0.78, y = area.y + 65;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 210, y + 1, { steps: 12 });
  await expect.poll(async () => (await current.boundingBox())?.x ?? 9999).toBeLessThan(origin.x - 130);
  await expect.poll(async () => next.evaluate(el =>
    el.getBoundingClientRect().left < (el.parentElement?.getBoundingClientRect().right ?? 0)
  )).toBe(true);
  expect(await page.evaluate(() => window.__compactChildrenAdded)).toBe(0);
  await page.mouse.up();
  await expect(overview.getByRole('button', { name: /Open January 2027/ })).toBeVisible();
  await expect(previous).toHaveCount(1);
  await expect(next).toHaveCount(1);
  await page.evaluate(() => window.__compactObserver?.disconnect());
});

test('six-month and year header arrows animate the prepared grids instead of teleporting', async ({ page }) => {
  for (const mode of ['half-year', 'year']) {
    await page.setViewportSize({ width: 1200, height: 780 });
    await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact' +
      (mode === 'year' ? '&mode=year' : ''));
    const overview = page.getByTestId('compact-activity-overview');
    const current = page.getByTestId('compact-activity-current');
    await expect(overview.getByRole('button')).toHaveCount(mode === 'year' ? 12 : 6);
    await current.evaluate(el => {
      window.__compactArrowFrames = [];
      window.__compactArrowObserver?.disconnect();
      window.__compactArrowObserver = new MutationObserver(() => {
        window.__compactArrowFrames.push({
          transform: el.style.transform,
          transition: el.style.transition,
        });
      });
      window.__compactArrowObserver.observe(el, { attributes: true, attributeFilter: ['style'] });
    });

    await page.getByTestId('compact-next-arrow').click();
    await expect.poll(() => page.evaluate(() => window.__compactArrowFrames.some(
      frame => frame.transition.includes('transform 145ms') && frame.transform.includes('translate3d(-')
    ))).toBe(true);
    await expect(overview.getByRole('button', { name: 'Open January 2027, 0 tasks' })).toBeVisible();
    await expect(overview.getByRole('button')).toHaveCount(mode === 'year' ? 12 : 6);
    await page.getByTestId('compact-prev-arrow').click();
    await expect(overview.getByRole('button', { name: mode === 'year'
      ? 'Open January 2026, 0 tasks' : 'Open July 2026, 0 tasks' })).toBeVisible();
    // Two quick arrow taps must queue adjacent transitions rather than jump.
    await page.getByTestId('compact-next-arrow').click();
    await page.getByTestId('compact-next-arrow').click();
    await expect(overview.getByRole('button', { name: mode === 'year'
      ? 'Open January 2028, 0 tasks' : 'Open July 2027, 0 tasks' })).toBeVisible();
    await page.evaluate(() => window.__compactArrowObserver?.disconnect());
  }
});

test('Home person Swiper remains viewport-positioned when its own CSS loads after Tailwind', async ({ page }) => {
  // Real Brave #2300 diagnostic: the Swiper resolved to position:relative,
  // grew past the Home viewport, and its Todo child had zero native scroll
  // range despite the final six-month card sitting behind fixed navigation.
  // Mimic late Swiper CSS in Chromium to prevent a false positive from the
  // fixture's different CSS import order.
  await page.setViewportSize({ width: 1600, height: 640 });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact&panel=true');
  const swiper = page.locator('[data-mosaic-tour="calendar"] > .swiper');
  const host = page.locator('[data-mosaic-tour="calendar"]');
  const scroll = page.getByTestId('compact-home-scroll');
  const last = page.getByTestId('compact-heatmap-month-2026-12');
  await expect(last).toBeVisible();
  await page.addStyleTag({ content: '.swiper { position: relative; }' });
  const position = await swiper.evaluate(el => getComputedStyle(el).position);
  expect(position, 'Late Swiper CSS must not override the bounded Home viewport').toBe('absolute');
  const pane = await swiper.boundingBox();
  const bounds = await host.boundingBox();
  if (!pane || !bounds) throw Error('Missing Home Swiper/viewport bounds');
  expect(pane.height, 'Home Swiper must fit its containing viewport').toBeCloseTo(bounds.height, 0);
  expect(pane.y + pane.height, 'Home Swiper may not extend beyond its viewport')
    .toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  const extent = await scroll.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(extent, 'Actual heatmap rows must produce native scroll range').toBeGreaterThan(30);
  const box = await scroll.boundingBox();
  if (!box) throw Error('Missing inner Todo scroll viewport');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 160));
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 300);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(30);
  const month = await last.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  if (!month || !nav) throw Error('Missing final month / fixed navigation');
  expect(month.y + month.height, 'Final month must clear bottom navigation after wheel scroll')
    .toBeLessThanOrEqual(nav.y - 1);
  expect(await page.locator('[data-mosaic-main-scroll="true"]').evaluate(el => el.scrollTop))
    .toBe(0);
});

test('split-screen Home heatmap can reach all six months without the outer page scrolling behind navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 841 });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact&panel=true');
  const main = page.locator('[data-mosaic-main-scroll="true"]');
  const scroll = page.getByTestId('compact-home-scroll');
  const viewport = page.locator('[data-mosaic-tour="calendar"]');
  const lastMonth = page.getByTestId('compact-heatmap-month-2026-12');
  await expect(lastMonth).toBeVisible();
  await expect(page.getByRole('group', { name: 'Six-month activity overview' }).getByRole('button')).toHaveCount(6);

  // Production's Home previously allowed two scroll owners, unlike the Calendar
  // probe. A page-level scroll could shift the compact grid under the fixed nav.
  expect(await main.evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden');
  const viewportHeight = await viewport.evaluate(el => el.getBoundingClientRect().height);
  const sizes = await scroll.evaluate(el => ({
    client: el.clientHeight,
    scroll: el.scrollHeight,
    max: el.scrollHeight - el.clientHeight,
  }));
  // This wrapper is a block, not a flex item. Without a real height its
  // absolute Swiper (and Todo viewport) collapses to zero in production.
  expect(viewportHeight, 'Home swiper must have a bounded containing block')
    .toBeGreaterThan(200);
  expect(sizes.client, 'Todo viewport must not collapse to a zero-height scroller')
    .toBeGreaterThan(120);
  expect(sizes.max, 'Large mini-months must create native inner scroll range')
    .toBeGreaterThan(20);
  const box = await scroll.boundingBox();
  if (!box) throw Error('Missing scroll viewport');
  await page.mouse.move(box.x + Math.min(box.width / 2, 250), box.y + box.height / 2);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 350);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
  const last = await lastMonth.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  if (!last || !nav) throw Error('Missing last month or fixed navigation');
  expect(last.y + last.height, 'Bottom six-month row remains above fixed bottom navigation')
    .toBeLessThanOrEqual(nav.y - 8);
  expect(await main.evaluate(el => el.scrollTop), 'Home must not be a second scroll owner').toBe(0);
});

test('phone Home swiper has a bounded internal scroll area with outer page locked', async ({ page }) => {
  const url = BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact';
  // A full-height phone may fit its three mini-month rows with no scroll
  // distance at all. A shorter phone must scroll the same rows above the nav.
  for (const height of [640, 420]) {
    await page.setViewportSize({ width: 375, height });
    await page.goto(url);
    const viewport = page.locator('[data-mosaic-tour="calendar"]');
    const scroll = page.getByTestId('compact-home-scroll');
    const navBounds = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    const bounds = await viewport.boundingBox();
    if (!bounds || !navBounds) throw Error('Missing Home viewport/nav');
    expect(bounds.height, 'Home swiper must not collapse').toBeGreaterThan(120);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(navBounds.y + 1);
    // The pager is lazy; the Suspense fallback can fit with zero scroll range.
    // Measure both viewport and last-month geometry after its real mount.
    const lastMonth = page.getByTestId('compact-heatmap-month-2026-12');
    await expect(lastMonth).toBeVisible();
    const sizes = await scroll.evaluate(el => ({
      client: el.clientHeight, max: el.scrollHeight - el.clientHeight,
    }));
    expect(sizes.client, 'Todo must own a nonzero scroll viewport').toBeGreaterThan(100);
    if (height === 420) {
      expect(sizes.max, 'Short phones must be able to scroll tall six-month grids')
        .toBeGreaterThan(40);
    }
    if (sizes.max > 1) {
      const box = await scroll.boundingBox();
      if (!box) throw Error('Missing compact scroller');
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 120));
      for (let i = 0; i < 8; i += 1) await page.mouse.wheel(0, 350);
      await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    }
    const last = await lastMonth.boundingBox();
    if (!last) throw Error('Missing last mini-month');
    expect(last.y + last.height, 'Final mini-month must clear the fixed nav on mobile')
      .toBeLessThanOrEqual(navBounds.y + 1);
    expect(await page.locator('[data-mosaic-main-scroll="true"]').evaluate(el => el.scrollTop))
      .toBe(0);
  }
});

test('six-month months remain large and scroll to the last row on a short desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto(BASE_URL + '/tests/e2e/calendar-home-scroll.html?scenario=compact');
  const scroll = page.getByTestId('compact-home-scroll');
  const overview = page.getByTestId('compact-activity-overview');
  const december = overview.getByRole('button', { name: 'Open December 2026, 0 tasks' });
  await expect(december).toBeVisible();
  const day = december.locator('[title="Dec 15: 0"]');
  const before = await day.boundingBox();
  if (!before) throw Error('Missing six-month day tile');
  const extent = await scroll.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(extent, 'Tall six-month cards must expand native scroll height').toBeGreaterThan(30);
  const bounds = await scroll.boundingBox();
  if (!bounds) throw Error('Missing native scroller');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 380);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(30);
  const last = await december.boundingBox();
  const after = await day.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  if (!last || !after || !nav) throw Error('Missing bottom scroll geometry');
  expect(last.y + last.height, 'Last six-month row must be visible above the bottom navigation')
    .toBeLessThanOrEqual(nav.y + 1);
  expect(after.width, 'Scrolling must not shrink large heatmap cells').toBeCloseTo(before.width, 1);
  expect(await scroll.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});
