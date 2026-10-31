import AxeBuilder from '@axe-core/playwright';
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

async function drag(page, locator, deltaX) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing drag target bounds');
  const startX = deltaX < 0 ? box.x + box.width * 0.82 : box.x + box.width * 0.18;
  const startY = box.y + Math.min(box.height * 0.35, 180);
  const session = await page.context().newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let step = 1; step <= 12; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: startX + (deltaX * step) / 12,
          y: startY,
        },
      ],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function dragWithMouse(page, locator, deltaX, deltaY = 0) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing mouse drag target bounds');
  const startX = box.x + box.width * 0.5;
  const startY = box.y + Math.min(box.height * 0.5, 24);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(
      startX + (deltaX * step) / 10,
      startY + (deltaY * step) / 10
    );
  }
  await page.mouse.up();
}

async function dragVertical(page, locator, deltaY) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing vertical drag target bounds');
  const startX = box.x + box.width * 0.5;
  const startY = box.y + Math.min(box.height * 0.35, 24);
  const session = await page.context().newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let step = 1; step <= 12; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: startX,
          y: startY + (deltaY * step) / 12,
        },
      ],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function startTaskLongPress(page, locator, holdMs = 550) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing task long-press target bounds');
  const session = await page.context().newCDPSession(page);
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;
  let currentX = startX;
  let currentY = startY;

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  await page.waitForTimeout(holdMs);

  return {
    session,
    startX,
    startY,
    moveTo: async (x, y) => {
      // A held finger continues from its LAST location. Restarting every
      // segment at touchStart made reversals artificially jump across days.
      const fromX = currentX;
      const fromY = currentY;
      for (let step = 1; step <= 5; step += 1) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{
            x: fromX + ((x - fromX) * step) / 5,
            y: fromY + ((y - fromY) * step) / 5,
          }],
        });
      }
      currentX = x;
      currentY = y;
    },
    finish: () => session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    }),
    cancel: () => session.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    }),
  };
}

async function waitForStableVerticalPosition(locator) {
  let previousY = null;
  let stableSamples = 0;

  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) {
          previousY = null;
          stableSamples = 0;
          return stableSamples;
        }

        if (previousY !== null && Math.abs(box.y - previousY) <= 0.5) {
          stableSamples += 1;
        } else {
          stableSamples = 0;
        }
        previousY = box.y;
        return stableSamples;
      },
      { timeout: 2500, intervals: [50, 50, 75, 100, 100, 150] }
    )
    .toBeGreaterThanOrEqual(2);
}

async function startDrag(page, locator, deltaX) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing drag target bounds');
  const startX = deltaX < 0 ? box.x + box.width * 0.82 : box.x + box.width * 0.18;
  const startY = box.y + Math.min(box.height * 0.35, 180);
  const session = await page.context().newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let step = 1; step <= 6; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: startX + (deltaX * step) / 12,
          y: startY,
        },
      ],
    });
  }

  return {
    session,
    finish: async () => {
      for (let step = 7; step <= 12; step += 1) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: startX + (deltaX * step) / 12,
              y: startY,
            },
          ],
        });
      }
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    },
  };
}

// Regression: #471 chat shell must never reflow during the route slide.
test('chat entering and leaving keeps the outgoing viewport geometry stable', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?chatMotion=1`);
  await expect(page.getByTestId('open-chat-motion')).toBeVisible();

  async function sample(buttonId, exitingId) {
    return page.evaluate(async ({ buttonId, exitingId }) => {
      const outgoing = document.querySelector(`[data-testid="${exitingId}"]`);
      const button = document.querySelector(`[data-testid="${buttonId}"]`);
      if (!(outgoing instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
        throw new Error('Missing chat viewport test surface');
      }
      const before = outgoing.getBoundingClientRect();
      button.click();
      const measurements = [];
      for (let i = 0; i < 8; i += 1) {
        await new Promise(requestAnimationFrame);
        if (!outgoing.isConnected) break;
        const rect = outgoing.getBoundingClientRect();
        measurements.push({
          height: rect.height, top: rect.top, left: rect.left,
          exiting: outgoing.closest('[data-viewport-mode]')?.getAttribute('aria-hidden'),
        });
      }
      return { height: before.height, top: before.top, left: before.left, measurements };
    }, { buttonId, exitingId });
  }

  const opening = await sample('open-chat-motion', 'motion-messages-screen');
  expect(opening.measurements.length).toBeGreaterThan(2);
  for (const rect of opening.measurements) {
    expect(Math.abs(rect.height - opening.height)).toBeLessThan(2);
    expect(Math.abs(rect.top - opening.top)).toBeLessThan(2);
    expect(rect.exiting).toBe('true');
  }
  // Entering chat moves its outgoing standard page gently LEFT.
  expect(opening.measurements.some((rect) => rect.left < opening.left - 2)).toBe(true);
  const chat = page.getByTestId('motion-chat-screen');
  await expect(chat).toBeVisible();
  await expect(page.getByTestId('motion-chat-dock')).toBeVisible();
  await expect(page.getByTestId('route-viewport-panel')).toHaveCount(1);

  const closing = await sample('close-chat-motion', 'motion-chat-screen');
  expect(closing.measurements.length).toBeGreaterThan(2);
  for (const rect of closing.measurements) {
    expect(Math.abs(rect.height - closing.height)).toBeLessThan(2);
    expect(Math.abs(rect.top - closing.top)).toBeLessThan(2);
    expect(rect.exiting).toBe('true');
  }
  // Back from chat must move the OLD chat RIGHT, not treat it as a standard page.
  expect(closing.measurements.some((rect) => rect.left > closing.left + 2)).toBe(true);
  await expect(page.getByTestId('motion-messages-screen')).toBeVisible();
});

// Regression: §2/§7 (primary-route swipe ownership and direct manipulation).
test('primary route swipe is direct-manipulation with Home and Me ownership rules', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const routeHarness = page.getByTestId('primary-route-harness');
  await routeHarness.scrollIntoViewIfNeeded();

  await drag(page, page.getByTestId('primary-page-body'), -220);
  await expect(page.getByTestId('primary-route')).toHaveText('home');

  const menuLayer = page.getByTestId('primary-home-menu-layer');
  const before = await menuLayer.boundingBox();
  if (!before) throw new Error('Missing primary route menu-layer bounds');

  const gesture = await startDrag(page, menuLayer, -220);
  await expect
    .poll(async () => {
      const during = await menuLayer.boundingBox();
      return during?.x ?? before.x;
    })
    .toBeLessThan(before.x - 20);
  await expect(page.getByTestId('primary-left-preview')).toBeVisible();
  const previewBox = await page.getByTestId('primary-left-preview').boundingBox();
  const harnessBox = await routeHarness.boundingBox();
  if (!previewBox || !harnessBox) throw new Error('Missing adjacent route preview bounds');
  expect(previewBox.x).toBeLessThan(harnessBox.x + harnessBox.width);
  expect(previewBox.x + previewBox.width).toBeGreaterThan(harnessBox.x);
  await gesture.finish();
  await expect(page.getByTestId('primary-route')).toHaveText('explore');

  await page.getByTestId('set-primary-explore').click();
  const lowerZone = page.getByTestId('primary-page-lower-swipe-zone');
  await lowerZone.scrollIntoViewIfNeeded();
  const surface = page.getByTestId('primary-route-swipe-surface');
  const surfaceBox = await surface.boundingBox();
  const lowerBox = await lowerZone.boundingBox();
  if (!surfaceBox || !lowerBox) throw new Error('Missing full-page route swipe bounds');
  expect(surfaceBox.y + surfaceBox.height).toBeGreaterThanOrEqual(
    lowerBox.y + lowerBox.height
  );
  await drag(page, lowerZone, -220);
  await expect(page.getByTestId('primary-route')).toHaveText('account');

  await drag(page, page.getByTestId('primary-page-lower-swipe-zone'), -220);
  await expect(page.getByTestId('primary-route')).toHaveText('settings');

  await drag(page, page.getByTestId('primary-page-lower-swipe-zone'), 220);
  await expect(page.getByTestId('primary-route')).toHaveText('account');

  await page.getByTestId('set-primary-friend-detail').click();
  await expect(page.getByTestId('primary-route')).toHaveText('friend-detail');

  // Parent-aware details with nested horizontal content ignore non-edge route drags.
  await drag(page, page.getByTestId('primary-page-body'), 180);
  await expect(page.getByTestId('primary-route')).toHaveText('friend-detail');

  const detailSurface = page.getByTestId('primary-route-swipe-surface');
  const detailBox = await detailSurface.boundingBox();
  if (!detailBox) throw new Error('Missing friend-detail route surface bounds');
  const edgeStartX = detailBox.x + 24;
  const edgeY = detailBox.y + 70;
  const pointerId = 77;
  await detailSurface.dispatchEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: edgeStartX,
    clientY: edgeY,
    pointerId,
    pointerType: 'touch',
  });
  for (let step = 1; step <= 8; step += 1) {
    await detailSurface.dispatchEvent('pointermove', {
      bubbles: true,
      button: 0,
      clientX: edgeStartX + (170 * step) / 8,
      clientY: edgeY,
      pointerId,
      pointerType: 'touch',
    });
  }
  await detailSurface.dispatchEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: edgeStartX + 170,
    clientY: edgeY,
    pointerId,
    pointerType: 'touch',
  });
  await expect(page.getByTestId('primary-route')).toHaveText('explore');
});

// Regression: §2/§7 (desktop horizontal wheel reuses route gesture ownership).
test('horizontal trackpad wheel follows the route compositor and detail edge rules', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('set-primary-explore').click();

  const surface = page.getByTestId('primary-route-swipe-surface');
  await surface.scrollIntoViewIfNeeded();
  let box = await surface.boundingBox();
  if (!box) throw new Error('Missing wheel route surface');
  await page.mouse.move(box.x + box.width / 2, box.y + 32);
  await page.mouse.wheel(0, 140);
  await expect(page.getByTestId('primary-route')).toHaveText('explore');

  await surface.scrollIntoViewIfNeeded();
  box = await surface.boundingBox();
  if (!box) throw new Error('Missing wheel route surface after scroll');
  await page.mouse.move(box.x + box.width / 2, box.y + 32);
  await page.mouse.wheel(150, 0);
  await expect(page.getByTestId('primary-route')).toHaveText('account');

  await page.getByTestId('set-primary-friend-detail').click();
  await page.waitForTimeout(850); // the previous wheel's momentum cooldown
  await surface.scrollIntoViewIfNeeded();
  box = await surface.boundingBox();
  if (!box) throw new Error('Missing detail route surface');
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.wheel(-150, 0);
  await page.waitForTimeout(350);
  await expect(page.getByTestId('primary-route')).toHaveText('friend-detail');

  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.wheel(-150, 0);
  await expect(page.getByTestId('primary-route')).toHaveText('explore');
});

// Regression: §24.17 (switch thumb remains inside its usable track).
test('settings switches keep the thumb bounded and move it from left to right', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const off = page.getByRole('switch', { name: 'Switch off' });
  const on = page.getByRole('switch', { name: 'Switch on' });
  const offTrack = off.getByTestId('settings-switch-track');
  const offThumb = off.getByTestId('settings-switch-thumb');
  const onTrack = on.getByTestId('settings-switch-track');
  const onThumb = on.getByTestId('settings-switch-thumb');

  const [offTrackBox, offThumbBox, onTrackBox, onThumbBox] = await Promise.all([
    offTrack.boundingBox(),
    offThumb.boundingBox(),
    onTrack.boundingBox(),
    onThumb.boundingBox(),
  ]);
  if (!offTrackBox || !offThumbBox || !onTrackBox || !onThumbBox) {
    throw new Error('Missing settings switch bounds');
  }

  expect(offThumbBox.x).toBeGreaterThanOrEqual(offTrackBox.x);
  expect(offThumbBox.x + offThumbBox.width).toBeLessThanOrEqual(
    offTrackBox.x + offTrackBox.width
  );
  expect(onThumbBox.x).toBeGreaterThanOrEqual(onTrackBox.x);
  expect(onThumbBox.x + onThumbBox.width).toBeLessThanOrEqual(
    onTrackBox.x + onTrackBox.width
  );
  expect(offThumbBox.x).toBeLessThan(onThumbBox.x);
});

test('calendar swipe moves the calendar without advancing the friend carousel', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const friendIndex = page.getByTestId('friend-index');
  const calendarTitle = page.getByTestId('calendar-title');
  const calendarRegion = page.getByTestId('calendar-region');

  // §16 / calendar accessibility: check initial rendering
  // before the swipe moves away from the month containing today's marker.
  expect(await calendarRegion.getByRole('grid').count()).toBeLessThanOrEqual(3);
  const title = (await calendarTitle.textContent())?.trim();
  expect(title).toBeTruthy();
  const grid = page.getByRole('grid', { name: `${title} calendar` });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('columnheader')).toHaveCount(7);
  expect(await grid.getByRole('gridcell').count()).toBeGreaterThanOrEqual(28);
  await expect(grid.locator('[aria-current="date"]')).toHaveCount(1);

  await expect(friendIndex).toHaveText('0');
  const before = await calendarTitle.textContent();

  await drag(page, calendarRegion, -260);

  await expect.poll(async () => calendarTitle.textContent()).not.toBe(before);
  await expect(friendIndex).toHaveText('0');

  await drag(page, page.getByTestId('friend-swipe-zone'), -260);
  await expect(friendIndex).toHaveText('1');
});

// Geometry regression for optional pinned headings: CSS sticky alone fails
// when the weekday row is nested inside the horizontal zoom scroller.
test('sticky Calendar weekdays stay pinned and aligned at 3-day zoom', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?stickyCalendar=3&perf=heavy`);
  const region = page.getByTestId('calendar-region');
  const activeSlide = region.locator('[data-calendar-slide-index="30"]');
  const grid = activeSlide.getByRole('grid');
  const heading = grid.getByRole('columnheader', { name: 'Tuesday' });
  const lane = activeSlide.getByRole('region', { name: 'Scrollable calendar weekdays' });
  await expect(heading).toBeVisible();
  const before = await heading.boundingBox();
  if (!before) throw new Error('Missing sticky weekday heading');
  await activeSlide.evaluate(node => { node.scrollTop = 150; });
  expect(await activeSlide.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const after = await heading.boundingBox();
  if (!after) throw new Error('Pinned heading disappeared after vertical scroll');
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);

  await lane.evaluate(node => { node.scrollLeft = 100; });
  const firstWeekTuesday = grid.getByRole('gridcell').nth(2);
  await expect.poll(async () => {
    const label = await heading.boundingBox();
    const day = await firstWeekTuesday.boundingBox();
    if (!label || !day) return Infinity;
    return Math.abs(label.x + label.width / 2 - day.x - day.width / 2);
  }).toBeLessThanOrEqual(3);
});

// Regression #1388: the real month grid must keep its last task reachable
// when a single date makes the grid substantially taller than its viewport.
// Check both the default week fit and the zoomed sticky-header layout.
for (const zoom of ['7-day', '3-day sticky']) {
  test(`Calendar ${zoom} scroll reaches the final preview of a task-heavy month`, async ({ page }) => {
    const mode = zoom === '3-day sticky' ? '&stickyCalendar=3' : '';
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&perfTaskCount=100&calendarScrollProbe=1${mode}`);
    const slide = page.getByTestId('calendar-region').locator('[data-calendar-slide-index="30"]');
    const lastTask = slide.locator('[title="Task 5.20"]');
    await expect(lastTask).toHaveCount(1);

    await expect.poll(() => slide.evaluate(node => node.scrollHeight - node.clientHeight))
      .toBeGreaterThan(100);
    await slide.evaluate(node => { node.scrollTop = node.scrollHeight; });
    const reachability = await slide.evaluate(node => {
      const task = node.querySelector('[title="Task 5.20"]');
      if (!task) throw new Error('Missing final task preview');
      const viewport = node.getBoundingClientRect();
      const taskBounds = task.getBoundingClientRect();
      return {
        remaining: node.scrollHeight - node.clientHeight - node.scrollTop,
        scrolled: node.scrollTop,
        taskTop: taskBounds.top,
        taskBottom: taskBounds.bottom,
        viewportTop: viewport.top,
        viewportBottom: viewport.bottom,
      };
    });
    expect(reachability.scrolled).toBeGreaterThan(100);
    expect(reachability.remaining).toBeLessThanOrEqual(1);
    expect(reachability.taskTop).toBeGreaterThanOrEqual(reachability.viewportTop - 1);
    expect(reachability.taskBottom).toBeLessThanOrEqual(reachability.viewportBottom + 1);
  });
}

test('Calendar and Todo carousels own horizontal trackpad scrolling without moving friends', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  const friendIndex = page.getByTestId('friend-index');
  const calendarTitle = page.getByTestId('calendar-title');
  const calendarRegion = page.getByTestId('calendar-region');
  await expect(friendIndex).toHaveText('0');
  const calendarBefore = await calendarTitle.textContent();
  const calendarBox = await calendarRegion.boundingBox();
  if (!calendarBox) throw new Error('Missing calendar wheel viewport');
  await page.mouse.move(calendarBox.x + calendarBox.width / 2, calendarBox.y + 80);
  await page.mouse.wheel(0, 130);
  await expect(calendarTitle).toHaveText(calendarBefore);
  await page.mouse.wheel(90, 0);
  await expect.poll(() => calendarTitle.textContent()).not.toBe(calendarBefore);
  await expect(friendIndex).toHaveText('0');

  const todo = page.getByTestId('todo-calendar-region');
  const todoBox = await todo.boundingBox();
  if (!todoBox) throw new Error('Missing Todo wheel viewport');
  await page.mouse.move(todoBox.x + todoBox.width / 2, todoBox.y + 70);
  await expect(page.getByTestId('todo-month')).toHaveText('September 2026');
  await page.mouse.wheel(90, 0);
  await expect(page.getByTestId('todo-month')).toHaveText('October 2026');
  await expect(friendIndex).toHaveText('0');
});

// Regression #858: the compact Todo and Diary carousel must always render
// the programmatically selected month, even on a distant Today jump or after
// more month-arrow requests than the original finite 61-slide range.
for (const markerMode of ['todo', 'diary']) {
  test(`${markerMode} compact grid survives future Today reset and fast month arrows`, async ({ page }) => {
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html${markerMode === 'diary' ? '?compactDiary=1' : ''}`);
    const region = page.getByTestId('todo-calendar-region');
    const month = page.getByTestId('todo-month');
    const gridFor = (name) => region.getByRole('grid', {
      name: `${name} todo calendar`,
    });
    await expect(month).toHaveText('September 2026');
    await expect(gridFor('September 2026')).toBeVisible();

    // Jump forward 72 months (beyond original 61 snaps), then reset.
    await page.getByTestId('compact-jump-future').click();
    await expect(month).toHaveText('September 2032');
    await expect(gridFor('September 2032')).toBeVisible();
    await expect(gridFor('September 2032').getByRole('gridcell').first()).toBeVisible();
    await page.getByTestId('compact-reset-today').click();
    await expect(month).toHaveText('September 2026');
    await expect(gridFor('September 2026').getByRole('gridcell').first()).toBeVisible();

    // Rapid header-arrow actions queue parent updates before Embla settles.
    // The last month must win, with a real grid rather than blank placeholders.
    await page.evaluate(() => {
      const next = document.querySelector('[data-testid="compact-next-month"]');
      if (!(next instanceof HTMLButtonElement)) throw Error('missing month arrow');
      for (let i = 0; i < 68; i++) next.click();
    });
    await expect(month).toHaveText('May 2032');
    await expect(gridFor('May 2032')).toBeVisible();
    await expect(gridFor('May 2032').getByRole('gridcell').first()).toBeVisible();
    await expect(region.getByRole('grid')).toHaveCount(1);
    await page.getByTestId('compact-reset-today').click();
    await expect(gridFor('September 2026').getByRole('gridcell').first()).toBeVisible();
  });
}

// Regression: §2/§7 (Todo calendar owns direct-manipulation swipes).
test('todo calendar follows the finger before snapping months', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await expect(page.getByTestId('friend-index')).toHaveText('0');
  await expect(page.getByTestId('todo-month')).toHaveText('September 2026');

  const region = page.getByTestId('todo-calendar-region');
  const day = page.getByRole('gridcell', {
    name: 'Tuesday, September 15, 2026, 0 tasks',
  });
  const before = await day.boundingBox();
  if (!before) throw new Error('Missing Todo day bounds');

  const gesture = await startDrag(page, region, -260);
  const during = await day.boundingBox();
  if (!during) throw new Error('Missing Todo day bounds during drag');

  expect(during.x).toBeLessThan(before.x - 20);
  await gesture.finish();

  await expect(page.getByTestId('todo-month')).toHaveText('October 2026');
  await expect(page.getByTestId('friend-index')).toHaveText('0');
});

// Regression: §21 (Send preserves composer focus).
test('message send keeps composer focus without an intermediate blur', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill('keep keyboard open');
  await composer.focus();
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(composer).toBeFocused();
  await expect(page.getByTestId('composer-blur-count')).toHaveText('0');
});


// Regression: §2 category text must beat legacy !important theme foreground mappings.
test('incomplete Calendar TaskBlock category text uses unchanged category hue in every theme', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await expect(page.getByTestId('taskblock-color-probe')).toBeVisible();

  for (const theme of ['dark', 'light', 'black']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const colors = await page.evaluate(() => {
      const probe = document.querySelector('[data-testid="taskblock-color-probe"]');
      const unchangedColorSample = document.createElement('span');
      unchangedColorSample.style.color = probe?.getAttribute('data-category-color') ?? '';
      document.body.appendChild(unchangedColorSample);
      const sourceCategoryColor = getComputedStyle(unchangedColorSample).color;
      unchangedColorSample.remove();

      const color = (state, mode) => {
        const target = document.querySelector(`[data-testid="${state}-taskblock-${mode}"] [title]`);
        if (!target) throw new Error('Missing real TaskBlock color probe');
        return getComputedStyle(target).color;
      };
      return {
        sourceCategoryColor,
        defaultIncomplete: color('incomplete', 'default'),
        categoryText: color('incomplete', 'text'),
        categoryBorder: color('incomplete', 'border'),
        defaultCompleted: color('completed', 'default'),
        categoryTextCompleted: color('completed', 'text'),
      };
    });

    expect(colors.categoryText, theme).toBe(colors.sourceCategoryColor);
    expect(colors.categoryText, theme).not.toBe(colors.defaultIncomplete);
    expect(colors.categoryBorder, theme).toBe(colors.defaultIncomplete);
    expect(colors.categoryTextCompleted, theme).toBe(colors.defaultCompleted);
  }
});

test('Light appearance keeps selected tasks, selection toolbar, and Search readable', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('set-appearance-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Compute foreground/surface contrast from browser-rendered CSS, not class names.
  const panelHost = page.getByTestId('home-search-harness');
  await panelHost.scrollIntoViewIfNeeded();
  await panelHost.getByRole('button', { name: 'Search tasks' }).click();
  const searchContrast = await panelHost.locator('.home-search-panel-enter > div').evaluate((panel) => {
    const heading = [...panel.querySelectorAll('span')].find((node) => node.textContent?.trim() === 'Categories');
    if (!heading) throw new Error('Missing search heading');
    const parse = (css) => css.match(/[0-9.]+/g)?.slice(0, 3).map(Number) ?? [];
    const lum = (css) => parse(css).reduce((sum, v, i) => {
      const n = v / 255;
      const c = n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      return sum + c * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    const [a, b] = [lum(getComputedStyle(heading).color), lum(getComputedStyle(panel).backgroundColor)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
  expect(searchContrast).toBeGreaterThanOrEqual(4.5);
  await panelHost.getByRole('searchbox', { name: 'Search my tasks' }).press('Escape');

  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog', { name: 'Tuesday, September 15, 2026' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Select tasks' }).click();
  await dialog.getByRole('button', { name: 'Task 1.1', exact: true }).click();

  const selected = dialog.getByRole('checkbox', { name: 'Task 1.1, selected' });
  await expect(selected).toHaveAttribute('aria-checked', 'true');
  const contrastSamples = await dialog.evaluate((root) => {
    const row = root.querySelector('[role="checkbox"][aria-checked="true"]');
    const toolbar = root.querySelector('[role="toolbar"]');
    const title = row?.querySelector('button[aria-label="Task 1.1"] span');
    const label = toolbar?.querySelector('span');
    if (!title || !toolbar || !label) throw new Error('Missing selection visual elements');
    const luminance = (value) => {
      const rgb = value.match(/[0-9.]+/g)?.slice(0, 3).map(Number);
      if (!rgb || rgb.length !== 3) throw new Error('Invalid computed RGB color');
      return rgb.reduce((sum, channel, i) => {
        const c = channel / 255;
        return sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
          * [0.2126, 0.7152, 0.0722][i];
      }, 0);
    };
    const ratio = (text, surface) => {
      const [bright, dark] = [luminance(text), luminance(surface)].sort((x, y) => y - x);
      return (bright + 0.05) / (dark + 0.05);
    };
    // Selected row has a translucent category tint over the Light canvas.
    const canvas = getComputedStyle(document.body).backgroundColor;
    const titleColor = getComputedStyle(title).color;
    const toolbarBg = getComputedStyle(toolbar).backgroundColor;
    const toolbarColor = getComputedStyle(label).color;
    return { selectedText: ratio(titleColor, canvas), toolbarText: ratio(toolbarColor, toolbarBg) };
  });
  expect(contrastSamples.selectedText).toBeGreaterThanOrEqual(4.5);
  expect(contrastSamples.toolbarText).toBeGreaterThanOrEqual(4.5);
});

// Regression: §2/§7 (Home search state survives nested Day View history).
test('home task search survives result-sheet Back with state preserved', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const harness = page.getByTestId('home-search-harness');
  await harness.scrollIntoViewIfNeeded();
  await harness.getByRole('button', { name: 'Search tasks' }).click();

  const input = harness.getByRole('searchbox', { name: 'Search my tasks' });
  await input.fill('Task 1');
  await harness.getByRole('button', { name: 'Category 1' }).click();
  await harness.getByRole('button', { name: 'Today' }).click();

  const result = harness.getByRole('button', { name: 'Open task Task 1.1 on Tue, Sep 15, 2026' });
  await expect(result).toBeVisible();
  await result.click();

  const dialog = page.getByRole('dialog', { name: 'Search result day' });
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(input).toHaveValue('Task 1');
  await expect(
    harness.getByRole('button', { name: 'Category 1' })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    harness.getByRole('button', { name: 'Today' })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(result).toBeVisible();
});

// Regression: a fresh reorder runtime must not turn untouched tasks into drag shells.
test('fresh task reorder runtime keeps legacy RxDocument-backed rows readable before any drag', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?rxdocs=legacy`);

  const region = page.getByTestId('todo-day-content');
  const rows = region.locator('[data-task-id]');
  await expect(rows).toHaveCount(12);

  for (const title of [
    'Task 1.1',
    'Task 1.2',
    'Task 1.3',
    'Task 2.1',
    'Task 2.2',
    'Task 2.3',
  ]) {
    await expect(
      region.getByRole('button', { name: title, exact: true })
    ).toBeVisible();
  }

  await expect
    .poll(() =>
      rows.evaluateAll((items) =>
        items.every((item) => {
          const title = item.textContent?.trim() ?? '';
          const rect = item.getBoundingClientRect();
          return (
            title.length > 0 &&
            rect.width > 0 &&
            rect.height > 0 &&
            item.getAttribute('data-task-dragging') !== 'true'
          );
        })
      )
    )
    .toBe(true);
});

// #858: offscreen row wrappers may omit inert dnd surfaces and Motion layout.
// On the first scroll into view, the *real* task title must still respond to
// long-press without an extra gesture, and cancellation must restore all rows.
test('Todo distant task activates drag on first touch after scrolling and restores rows', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?rxdocs=legacy`);

  const region = page.getByTestId('todo-day-content');
  const rows = region.locator('[data-task-id]');
  await expect(rows).toHaveCount(12);
  const lastRow = rows.last();
  const taskId = await lastRow.getAttribute('data-task-id');
  if (!taskId) throw new Error('Missing far-row task identity');
  await lastRow.scrollIntoViewIfNeeded();
  const title = lastRow.locator('[data-day-swipe-through="true"]');
  await expect(title).toBeVisible();

  const gesture = await startTaskLongPress(page, title);
  try {
    await expect(page.locator(`[data-task-overlay-id="${taskId}"]`))
      .toBeVisible();
  } finally {
    await gesture.cancel();
  }
  await expect(page.locator(`[data-task-overlay-id="${taskId}"]`))
    .toHaveCount(0);
  await expect(rows).toHaveCount(12);
  await expect(lastRow).toBeVisible();
});

// Regression: owner task reorder is a simple delayed sortable interaction.
test('task long-press stays under the finger while siblings reorder, then persists on release', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const region = page.getByTestId('todo-day-content');
  const source = region.locator('[data-task-id="task_0_0"]');
  const firstSibling = region.locator('[data-task-id="task_0_1"]');
  const secondSibling = region.locator('[data-task-id="task_0_2"]');
  const destination = secondSibling;
  const title = source.getByRole('button', { name: 'Task 1.1', exact: true });
  await source.scrollIntoViewIfNeeded();

  const sourceBefore = await source.boundingBox();
  const firstSiblingBefore = await firstSibling.boundingBox();
  const secondSiblingBefore = await secondSibling.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (!sourceBefore || !firstSiblingBefore || !secondSiblingBefore || !destinationBox) {
    throw new Error('Missing task reorder bounds');
  }

  const gesture = await startTaskLongPress(page, title);
  const dragged = page.locator('[data-task-overlay-id="task_0_0"]');
  await expect(dragged).toHaveAttribute('data-task-dragging', 'true');
  await expect(page.getByTestId('todo-gesture')).toHaveText('sorting');
  await expect(page.locator('[data-dnd-placeholder]')).toHaveCount(0);
  await expect(
    page.locator('[data-task-overlay-id="task_0_0"]')
  ).toBeVisible();
  await expect(
    region.locator('[data-task-source-slot="true"] [data-task-id="task_0_0"]')
  ).toHaveCount(1);

  await gesture.moveTo(
    destinationBox.x + destinationBox.width * 0.5,
    destinationBox.y + destinationBox.height * 0.85
  );

  await expect.poll(async () => (await dragged.boundingBox())?.y ?? sourceBefore.y)
    .toBeGreaterThan(sourceBefore.y + 12);
  await expect.poll(async () => {
    const first = await firstSibling.boundingBox();
    const second = await secondSibling.boundingBox();
    return Math.max(
      Math.abs((first?.y ?? firstSiblingBefore.y) - firstSiblingBefore.y),
      Math.abs((second?.y ?? secondSiblingBefore.y) - secondSiblingBefore.y)
    );
  }).toBeGreaterThan(8);
  await expect(
    region.locator('[data-task-id^="task_0_"]:not([data-dnd-placeholder])')
  ).toHaveCount(3);

  // Measure the released *real* row on animation frames, not the carried
  // overlay. Its former absolute source slot must not FLIP back and overshoot.
  await page.evaluate(() => {
    window.__mosaicTaskReleaseY = [];
    const started = performance.now();
    const sample = () => {
      if (performance.now() - started > 350) return;
      const row = document.querySelector('[data-task-id="task_0_0"]');
      if (row && !row.closest('[data-task-source-slot="true"]')) {
        window.__mosaicTaskReleaseY.push(row.getBoundingClientRect().y);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await gesture.finish();
  await page.waitForTimeout(375);
  const releaseTrajectory = await page.evaluate(() => ({
    samples: window.__mosaicTaskReleaseY ?? [],
    finalY: document.querySelector('[data-task-id="task_0_0"]')?.getBoundingClientRect().y,
  }));
  expect(releaseTrajectory.samples.length, JSON.stringify(releaseTrajectory)).toBeGreaterThan(1);
  expect(releaseTrajectory.samples.every(y =>
    Math.abs(y - releaseTrajectory.finalY) < 30
  ), JSON.stringify(releaseTrajectory)).toBe(true);

  await expect(page.getByTestId('todo-gesture')).toHaveText(
    'reordered:task_0_1,task_0_2,task_0_0'
  );
  await expect
    .poll(() => region.locator(
      '[data-task-id^="task_0_"]:not([data-dnd-placeholder])'
    ).evaluateAll(
      (rows) => rows.map((row) => row.getAttribute('data-task-id'))
    ))
    .toEqual(['task_0_1', 'task_0_2', 'task_0_0']);

  // Regression: releasing or canceling a drag may not strand a hidden source.
  const visibleAtRest = async () => region.locator('[data-task-id^="task_0_"]')
    .evaluateAll((rows) => rows.length === 3 && rows.every((row) => {
      const rect = row.getBoundingClientRect();
      const style = getComputedStyle(row);
      return rect.width > 0 && rect.height > 0 &&
        style.visibility !== 'hidden' && Number(style.opacity) > 0;
    }));
  await expect(region.locator('[data-task-source-slot="true"]')).toHaveCount(0);
  await expect.poll(visibleAtRest).toBe(true);

  const cancelTarget = region.locator('[data-task-id="task_0_1"]')
    .getByRole('button', { name: 'Task 1.2', exact: true });
  const canceled = await startTaskLongPress(page, cancelTarget);
  await expect(region.locator('[data-task-source-slot="true"]')).toHaveCount(1);
  await canceled.cancel();
  await expect(region.locator('[data-task-source-slot="true"]')).toHaveCount(0);
  await expect.poll(visibleAtRest).toBe(true);
});

// Regression: dragging upward from the last task must not leave an extra
// painted task image over the category pill below the source.
test('bottom-to-top task drag renders one overlay and no painted source ghost', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  const region = page.getByTestId('todo-day-content');
  const source = region.locator('[data-task-id="task_0_2"]');
  const title = source.getByRole('button', { name: 'Task 1.3', exact: true });
  const target = region.locator('[data-task-id="task_0_0"]');
  await source.scrollIntoViewIfNeeded();
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error('Missing upward task target');

  const gesture = await startTaskLongPress(page, title);
  const overlay = page.locator('[data-task-overlay-id="task_0_2"]');
  await expect(overlay).toBeVisible();
  await gesture.moveTo(targetBox.x + targetBox.width * 0.5, targetBox.y + targetBox.height * 0.18);
  await expect(region.locator('[data-task-drop-gap="true"]')).toHaveCount(1);
  await expect(page.locator('[data-dnd-placeholder]')).toHaveCount(0);
  await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(1);
  const sourceStatus = await region.locator('[data-task-source-slot="true"]').evaluateAll(slots =>
    slots.map(slot => ({
      visibility: getComputedStyle(slot).visibility,
      inline: slot.style.visibility,
      aria: slot.getAttribute('aria-hidden'),
    }))
  );
  expect(sourceStatus, JSON.stringify(sourceStatus)).toEqual([
    expect.objectContaining({visibility: 'hidden', aria: 'true'}),
  ]);

  await gesture.finish();
  await expect(page.getByTestId('todo-gesture')).toHaveText('reordered:task_0_2,task_0_0,task_0_1');
  await expect(region.locator('[data-task-source-slot="true"]')).toHaveCount(0);
  await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(0);
});

test('diary long press follows held touch on both axes with a single full-card overlay', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?diaryDrag=1`);
  const region = page.getByTestId('todo-day-content');
  const diary = region.locator('[data-diary-drag-source="true"]');
  const button = diary.getByTestId('diary-day-card');
  await button.scrollIntoViewIfNeeded();
  // Drag geometry matters: the in-list Diary card must start on the same
  // horizontal rail as ordinary tasks before the full-card overlay takes over.
  const taskRow = region.locator('[data-task-id="task_0_0"]');
  const [taskBounds, diaryBounds] = await Promise.all([
    taskRow.boundingBox(), button.boundingBox(),
  ]);
  if (!taskBounds || !diaryBounds) throw new Error('Missing task/diary alignment geometry');
  expect(Math.abs(diaryBounds.x - taskBounds.x)).toBeLessThan(2);
  const gesture = await startTaskLongPress(page, button);
  const overlay = page.locator('[data-diary-drag-overlay="true"]');
  await expect(overlay).toBeVisible();
  const start = await overlay.boundingBox();
  if (!start) throw new Error('Missing full diary drag overlay');
  await expect(region.locator('[data-diary-drag-gap="true"]')).toHaveCount(1);
  const diarySourceStatus = await region.locator('[data-diary-source-slot="true"]').evaluateAll(slots =>
    slots.map(slot => ({
      visibility: getComputedStyle(slot).visibility,
      inline: slot.style.visibility,
      aria: slot.getAttribute('aria-hidden'),
    }))
  );
  expect(diarySourceStatus, JSON.stringify(diarySourceStatus)).toEqual([
    expect.objectContaining({visibility: 'hidden', aria: 'true'}),
  ]);
  await expect(page.locator('[data-dnd-placeholder]')).toHaveCount(0);

  await gesture.moveTo(gesture.startX + 14, gesture.startY - 60);
  await expect.poll(async () => (await overlay.boundingBox())?.y ?? start.y)
    .toBeLessThan(start.y - 34);
  const moved = await overlay.boundingBox();
  if (!moved) throw new Error('Diary overlay disappeared during drag');
  expect(Math.abs((moved.x - start.x) - 14)).toBeLessThan(20);
  expect(Math.abs((moved.y - start.y) + 60)).toBeLessThan(20);

  await gesture.moveTo(gesture.startX - 16, gesture.startY - 90);
  const movedAgain = await overlay.boundingBox();
  if (!movedAgain) throw new Error('Diary overlay stopped following touch');
  expect(Math.abs((movedAgain.x - start.x) + 16)).toBeLessThan(20);
  expect(Math.abs((movedAgain.y - start.y) + 90)).toBeLessThan(20);
  await gesture.cancel();
  await expect(overlay).toHaveCount(0);
  await expect(region.locator('[data-diary-drag-gap="true"]')).toHaveCount(0);
  await expect(diary.getByTestId('diary-day-card')).toBeVisible();
});

test('task can move into another populated category at the projected position', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const region = page.getByTestId('todo-day-content');
  const sourceCategory = region.locator('[data-task-category-id="cat_0"]');
  const targetCategory = region.locator('[data-task-category-id="cat_1"]');
  const source = sourceCategory.locator('[data-task-id="task_0_0"]');
  const title = source.getByRole('button', { name: 'Task 1.1', exact: true });
  const destination = targetCategory.locator('[data-task-id="task_1_1"]');
  await source.scrollIntoViewIfNeeded();
  const destinationBox = await destination.boundingBox();
  if (!destinationBox) throw new Error('Missing cross-category destination bounds');

  const gesture = await startTaskLongPress(page, title);
  await gesture.moveTo(
    destinationBox.x + destinationBox.width * 0.5,
    destinationBox.y + destinationBox.height * 0.2
  );
  await gesture.finish();

  await expect(page.getByTestId('todo-gesture')).toHaveText(
    'reordered:cat_0=task_0_1,task_0_2|cat_1=task_1_0,task_0_0,task_1_1,task_1_2'
  );
  await expect
    .poll(() => targetCategory.locator(
      '[data-task-id]:not([data-dnd-placeholder])'
    ).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-task-id'))))
    .toEqual(['task_1_0', 'task_0_0', 'task_1_1', 'task_1_2']);
  await expect
    .poll(() => sourceCategory.locator(
      '[data-task-id]:not([data-dnd-placeholder])'
    ).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-task-id'))))
    .toEqual(['task_0_1', 'task_0_2']);
});

test('category header and first-row boundary share one stable insertion slot', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const region = page.getByTestId('todo-day-content');
  const sourceCategory = region.locator('[data-task-category-id="cat_0"]');
  const targetCategory = region.locator('[data-task-category-id="cat_1"]');
  const source = sourceCategory.locator('[data-task-id="task_0_0"]');
  const title = source.getByRole('button', { name: 'Task 1.1', exact: true });
  const headerTarget = targetCategory.locator(
    '[data-task-category-drop-position="start"]'
  );
  const firstTarget = targetCategory.locator('[data-task-id="task_1_0"]');

  await source.scrollIntoViewIfNeeded();
  const headerBox = await headerTarget.boundingBox();
  if (!headerBox) throw new Error('Missing category header drop bounds');

  const gesture = await startTaskLongPress(page, title);
  await gesture.moveTo(
    headerBox.x + headerBox.width * 0.5,
    headerBox.y + headerBox.height * 0.75
  );

  const gap = targetCategory.locator('[data-task-drop-gap="true"]');
  await expect(gap).toHaveCount(1);
  // Layout projections animate; compare settled insertion geometry rather than
  // sampling in the middle of the previous 200ms layout transition.
  await waitForStableVerticalPosition(gap);
  await waitForStableVerticalPosition(firstTarget);
  const gapAtHeader = await gap.boundingBox();
  const firstAtHeader = await firstTarget.boundingBox();
  if (!gapAtHeader || !firstAtHeader) {
    throw new Error('Missing header insertion geometry');
  }
  expect(gapAtHeader.y).toBeLessThan(firstAtHeader.y);

  await gesture.moveTo(
    firstAtHeader.x + firstAtHeader.width * 0.5,
    firstAtHeader.y + Math.min(4, firstAtHeader.height * 0.1)
  );
  await waitForStableVerticalPosition(gap);
  await waitForStableVerticalPosition(firstTarget);

  const gapAtFirstRow = await gap.boundingBox();
  const firstAtFirstRow = await firstTarget.boundingBox();
  if (!gapAtFirstRow || !firstAtFirstRow) {
    throw new Error('Missing first-row insertion geometry');
  }

  expect(gapAtFirstRow.y).toBeLessThan(firstAtFirstRow.y);
  expect(Math.abs(gapAtFirstRow.y - gapAtHeader.y)).toBeLessThan(2);
  expect(Math.abs(firstAtFirstRow.y - firstAtHeader.y)).toBeLessThan(2);

  await gesture.moveTo(
    gapAtFirstRow.x + gapAtFirstRow.width * 0.5,
    gapAtFirstRow.y + gapAtFirstRow.height * 0.5
  );
  await waitForStableVerticalPosition(gap);
  await waitForStableVerticalPosition(firstTarget);

  const gapUnderFinger = await gap.boundingBox();
  const firstUnderFinger = await firstTarget.boundingBox();
  if (!gapUnderFinger || !firstUnderFinger) {
    throw new Error('Missing projected-gap drop geometry');
  }
  expect(Math.abs(gapUnderFinger.y - gapAtHeader.y)).toBeLessThan(2);
  expect(Math.abs(firstUnderFinger.y - firstAtHeader.y)).toBeLessThan(2);

  await gesture.finish();

  await expect(page.getByTestId('todo-gesture')).toHaveText(
    'reordered:cat_0=task_0_1,task_0_2|cat_1=task_0_0,task_1_0,task_1_1,task_1_2'
  );
});

test('cross-category persistence leaves every task visible and a second drag immediately usable', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?rxdocs=legacy`);

  const region = page.getByTestId('todo-day-content');
  const allRows = region.locator(
    '[data-task-id]:not([data-dnd-placeholder])'
  );
  const initialIds = await allRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-task-id')).filter(Boolean).sort()
  );

  const firstSource = region.locator('[data-task-id="task_0_0"]');
  const firstTitle = firstSource.getByRole('button', {
    name: 'Task 1.1',
    exact: true,
  });
  const firstTarget = region.locator('[data-task-id="task_1_1"]');
  await firstSource.scrollIntoViewIfNeeded();
  const firstTargetBox = await firstTarget.boundingBox();
  if (!firstTargetBox) throw new Error('Missing first cross-category target');

  const firstGesture = await startTaskLongPress(page, firstTitle);
  await firstGesture.moveTo(
    firstTargetBox.x + firstTargetBox.width * 0.5,
    firstTargetBox.y + firstTargetBox.height * 0.2
  );
  await firstGesture.finish();

  await expect(
    region.locator('[data-task-id="task_0_0"]:not([data-dnd-placeholder])')
  ).toBeVisible();
  await expect(region.locator('[data-dnd-placeholder]')).toHaveCount(0);
  await expect(region.locator('[data-dnd-dragging="true"]')).toHaveCount(0);
  await expect
    .poll(() =>
      allRows.evaluateAll((rows) =>
        rows
          .map((row) => row.getAttribute('data-task-id'))
          .filter(Boolean)
          .sort()
      )
    )
    .toEqual(initialIds);
  await expect
    .poll(() =>
      allRows.evaluateAll((rows) =>
        rows.every((row) => {
          const rect = row.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
      )
    )
    .toBe(true);

  const secondSource = region.locator('[data-task-id="task_1_0"]');
  const secondTitle = secondSource.getByRole('button', {
    name: 'Task 2.1',
    exact: true,
  });
  const secondTarget = region.locator('[data-task-id="task_3_1"]');
  await secondSource.scrollIntoViewIfNeeded();
  const secondTargetBox = await secondTarget.boundingBox();
  if (!secondTargetBox) throw new Error('Missing second cross-category target');

  const secondGesture = await startTaskLongPress(page, secondTitle);
  await expect(
    page.locator('[data-task-overlay-id="task_1_0"]')
  ).toHaveAttribute('data-task-dragging', 'true');
  await secondGesture.moveTo(
    secondTargetBox.x + secondTargetBox.width * 0.5,
    secondTargetBox.y + secondTargetBox.height * 0.2
  );
  await secondGesture.finish();

  await expect(region.locator('[data-dnd-placeholder]')).toHaveCount(0);
  await expect(region.locator('[data-dnd-dragging="true"]')).toHaveCount(0);
  await expect
    .poll(() =>
      allRows.evaluateAll((rows) =>
        rows
          .map((row) => row.getAttribute('data-task-id'))
          .filter(Boolean)
          .sort()
      )
    )
    .toEqual(initialIds);

  await region
    .getByRole('button', { name: 'Task 1.1', exact: true })
    .click();
  await expect(page.getByTestId('todo-gesture')).toHaveText('actions');
});

test('task can drop into an empty category from its category surface', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const region = page.getByTestId('todo-day-content');
  const source = region.locator('[data-task-id="task_0_0"]');
  const title = source.getByRole('button', { name: 'Task 1.1', exact: true });
  const emptyCategory = region.locator('[data-task-category-id="cat_2"]');
  const emptyHeader = emptyCategory.getByRole('button', {
    name: 'Add a task to Category 3',
  });
  await source.scrollIntoViewIfNeeded();
  const gesture = await startTaskLongPress(page, title);
  // Starting the drag shifts task/category geometry while the new insertion
  // space animates. Target the visible header *after* it has settled.
  await waitForStableVerticalPosition(emptyHeader);
  const headerBox = await emptyHeader.boundingBox();
  if (!headerBox) throw new Error('Missing empty-category bounds');
  await gesture.moveTo(
    headerBox.x + headerBox.width * 0.5,
    headerBox.y + headerBox.height * 0.5
  );
  // The pointer stays still while Motion animates the projected gap. A nearby
  // category must not steal the target just because its layout box moved.
  await expect(emptyCategory.locator('[data-task-drop-gap="true"]')).toHaveCount(1);
  await page.waitForTimeout(300);
  await expect(emptyCategory.locator('[data-task-drop-gap="true"]')).toHaveCount(1);
  await expect(region.locator('[data-task-category-id="cat_3"] [data-task-drop-gap="true"]')).toHaveCount(0);
  await gesture.finish();

  await expect(page.getByTestId('todo-gesture')).toHaveText(
    'reordered:cat_0=task_0_1,task_0_2|cat_2=task_0_0'
  );
  await expect(
    emptyCategory.locator(
      '[data-task-id="task_0_0"]:not([data-dnd-placeholder])'
    )
  ).toBeVisible();
});

test('moving before the task hold threshold cancels reorder activation', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const region = page.getByTestId('todo-day-content');
  const source = region.locator('[data-task-id="task_0_0"]');
  const title = source.getByRole('button', { name: 'Task 1.1', exact: true });
  await source.scrollIntoViewIfNeeded();

  const gesture = await startTaskLongPress(page, title, 150);
  await gesture.moveTo(gesture.startX, gesture.startY + 50);
  await page.waitForTimeout(450);

  await expect(source).not.toHaveAttribute('data-task-dragging', 'true');
  await expect(page.getByTestId('todo-gesture')).toHaveText('idle');
  await gesture.finish();
});

test('active task sorting keeps the real Day View sheet and day swiper locked in place', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();

  const dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);

  const source = dialog.locator('[data-task-id="task_0_0"]');
  const title = source.getByRole('button', { name: 'Task 1.1', exact: true });
  await source.scrollIntoViewIfNeeded();

  const gesture = await startTaskLongPress(page, title);
  const dragged = page.locator('[data-task-overlay-id="task_0_0"]');
  await expect(dragged).toHaveAttribute('data-task-dragging', 'true');
  await gesture.moveTo(gesture.startX, gesture.startY + 55);

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Tuesday, September 15, 2026')).toBeVisible();

  await gesture.cancel();
  await expect(
    page.locator('[data-task-overlay-id="task_0_0"]')
  ).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByTestId('open-day-view-sheet').click();

  const reopened = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(reopened).toBeVisible();
  await waitForStableVerticalPosition(reopened);
  await expect(
    reopened.getByRole('button', { name: 'Task 1.1', exact: true })
  ).toBeVisible();
});

// Regression: §2 (owner Day View exposes memo content and multi-tap shortcuts).
test('owner task memo is visible and double/triple tap shortcuts reach edit surfaces', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  await expect(page.getByText('Browser memo content')).toBeVisible();
  const title = page.getByRole('button', { name: 'Task 1.1' });
  await title.dblclick();
  await expect(page.getByTestId('todo-gesture')).toHaveText('edit');

  await page.reload();
  const memo = page.getByRole('button', { name: 'Open memo' }).first();
  await memo.dblclick();
  await expect(page.getByTestId('todo-gesture')).toHaveText('memo-edit');

  await page.reload();
  await page.getByRole('button', { name: 'Task 1.1' }).click({ clickCount: 3 });
  await expect(page.getByTestId('todo-gesture')).toHaveText('memo-edit');
});

// Regression: §2 (closed Day View destroys task drag runtime; reopen starts from live tasks).
test('DayView task rows are interactive on first open and after a clean runtime rebuild', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);

  await page.getByTestId('open-day-view-sheet').click();

  let dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);
  await expect(
    dialog.locator('[data-task-reorder-runtime="true"]')
  ).toHaveCount(1);

  let title = dialog.getByRole('button', {
    name: 'Task 1.1',
    exact: true,
  });
  await expect(title).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByTestId('open-day-view-sheet').click();
  dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);
  await expect(
    dialog.locator('[data-task-reorder-runtime="true"]')
  ).toHaveCount(1);

  title = dialog.getByRole('button', {
    name: 'Task 1.1',
    exact: true,
  });
  await expect(title).toBeVisible();
  await title.click();

  await expect(
    page.getByRole('dialog', { name: 'Task 1.1' })
  ).toBeVisible();
});

// Regression: §2 (Day View reopens cleanly after sheet teardown).
test('DayView reopens on another and the same date after teardown', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);

  await page.getByTestId('open-day-view-sheet').click();
  let dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByTestId('open-next-day-view-sheet').click();
  dialog = page.getByRole('dialog', {
    name: 'Wednesday, September 16, 2026',
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('day-view-probe-error')).toHaveCount(0);
  await waitForStableVerticalPosition(dialog);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByTestId('open-day-view-sheet').click();
  dialog = page.getByRole('dialog', {
    name: 'Wednesday, September 16, 2026',
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('day-view-probe-error')).toHaveCount(0);

  // Jump 60 days within the 181-date logical range after Swiper has mounted.
  // A stale virtual DOM window must not hide the selected date or its neighbor.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByTestId('open-far-day-view-sheet').click();
  dialog = page.getByRole('dialog', { name: 'Saturday, November 14, 2026' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.swiper-slide-active'))
    .toContainText('Saturday, November 14, 2026');
  await waitForStableVerticalPosition(dialog);
  await drag(page, dialog.getByTestId('day-swiper'), -260);
  await expect(dialog.locator('.swiper-slide-active'))
    .toContainText('Sunday, November 15, 2026');
});

// Regression: §2/§7 (Day View date row owns horizontal navigation and vertical close).
test('sheet date row follows the finger horizontally and still supports vertical drag-to-close', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('open-full-sheet').click();

  const dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  await waitForStableVerticalPosition(dialog);

  const firstRow = page.getByTestId('sheet-date-row-1');
  const before = await firstRow.boundingBox();
  if (!before) throw new Error('Missing sheet date row bounds');

  const gesture = await startDrag(page, firstRow, -220);
  await expect
    .poll(
      async () => {
        const during = await firstRow.boundingBox();
        return during?.x ?? before.x;
      },
      { timeout: 1500 }
    )
    .toBeLessThan(before.x - 20);
  await gesture.finish();
  await expect(page.getByTestId('sheet-day-index')).toHaveText('1');

  await dragVertical(page, page.getByTestId('sheet-date-row-2'), 180);
  await expect(page.getByRole('dialog', { name: 'Responsive test sheet' })).toHaveCount(0);
});

// Regression: §13 — the surface must actually track the held finger,
// not just dismiss after a release-only swipe.
test('shared sheet drag header tracks held touch before dismissing', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('open-full-sheet').click();
  const dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  await waitForStableVerticalPosition(dialog);
  const handle = page.getByTestId('sheet-live-drag-header');
  const bounds = await handle.boundingBox();
  const initial = await dialog.boundingBox();
  if (!bounds || !initial) throw new Error('Missing sheet bounds');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 7; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x, y: y + step * 13 }],
    });
  }
  await expect.poll(async () => {
    const current = await dialog.boundingBox();
    return current?.y ?? initial.y;
  }, { timeout: 1500 }).toBeGreaterThan(initial.y + 24);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x, y: y + 190 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await expect(dialog).toHaveCount(0);
});

// Regression: §2 (blank Day View sheet space remains part of day navigation).
test('blank lower sheet area swipes to the adjacent day', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('open-full-sheet').click();

  const dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  await waitForStableVerticalPosition(dialog);
  await drag(page, page.getByTestId('sheet-blank-swipe-zone-1'), -220);

  await expect(page.getByTestId('sheet-day-index')).toHaveText('1');
});

// Regression: §2/§13 (phone full sheets preserve backdrop; tablet full sheets fill the viewport).
test('full sheet leaves a phone backdrop, closes from it, and fills tablet height', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('open-full-sheet').click();

  let dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  const phoneViewport = page.viewportSize();
  if (!phoneViewport) throw new Error('Missing phone viewport');

  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    if (!box) return null;
    return {
      leavesBackdrop: box.y > 0 && box.height < phoneViewport.height,
      bottomGap: Math.abs(box.y + box.height - phoneViewport.height),
    };
  }).toEqual({
    leavesBackdrop: true,
    bottomGap: expect.any(Number),
  });

  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return box ? Math.abs(box.y + box.height - phoneViewport.height) : Infinity;
  }).toBeLessThanOrEqual(1);

  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId('open-full-sheet').click();
  dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  const tabletViewport = page.viewportSize();
  if (!tabletViewport) throw new Error('Missing tablet viewport');

  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    if (!box) return false;
    return (
      box.y <= 1 &&
      box.height >= tabletViewport.height - 1
    );
  }).toBe(true);
});

test('todo calendar day tap selects the day without changing friend or month', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  await page.getByRole('gridcell', {
    name: 'Thursday, September 17, 2026, 0 tasks',
  }).tap();

  await expect(page.getByTestId('todo-selected-date')).toHaveText('2026-09-17');
  await expect(page.getByTestId('todo-month')).toHaveText('September 2026');
  await expect(page.getByTestId('friend-index')).toHaveText('0');
});

// Regression: §2/§7 (Todo owns one vertical page scroll).
test('todo selected-day task content does not create a nested vertical scroller', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const nestedScrollOwners = await page.getByTestId('todo-day-content').evaluate((root) =>
    Array.from(root.querySelectorAll('*')).filter((element) => {
      const style = getComputedStyle(element);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    }).length
  );

  expect(nestedScrollOwners).toBe(0);
});

// Regression: §2 (six-week Todo months remain fully visible).
test('todo page keeps every row of a six-week month visible instead of flex-clipping the calendar', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const scroll = page.getByTestId('todo-full-month-scroll');
  const grid = scroll.getByRole('grid', { name: 'August 2026 todo calendar' });
  await expect(grid.getByRole('gridcell')).toHaveCount(42);

  const lastDay = grid.getByRole('gridcell', {
    name: 'Monday, August 31, 2026, 0 tasks',
  });
  const gridBox = await grid.boundingBox();
  const dayBox = await lastDay.boundingBox();
  if (!gridBox || !dayBox) throw new Error('Missing Todo full-month bounds');

  expect(dayBox.y + dayBox.height).toBeLessThanOrEqual(gridBox.y + gridBox.height + 1);
  expect(await scroll.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
    await scroll.evaluate((element) => element.clientHeight)
  );
});

test('todo day swipe advances the nested day view without advancing the friend carousel', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  await expect(page.getByTestId('friend-index')).toHaveText('0');
  await expect(page.getByTestId('todo-day-index')).toHaveText('0');

  await drag(page, page.getByTestId('todo-region'), -260);

  await expect(page.getByTestId('todo-day-index')).toHaveText('1');
  await expect(page.getByTestId('friend-index')).toHaveText('0');
});

// Regression: §2/§24.16 (rapid Day View paging keeps rendered neighbors ahead of the gesture).
test('rapid Day View swipes never outrun the rendered slide buffer', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();

  const dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);

  const swiper = page.getByTestId('day-swiper');
  // 181 logical days must not mean 181 mounted layout nodes.
  await expect.poll(() => swiper.locator('.swiper-slide').count()).toBeLessThan(20);
  await drag(page, swiper, -260);
  await drag(page, swiper, -260);
  await drag(page, swiper, -260);
  await drag(page, swiper, -260);

  const activeSlide = swiper.locator('.swiper-slide-active');
  await expect(
    activeSlide.locator('[data-day-view-navigation="true"]')
  ).toHaveCount(1);
  await expect(activeSlide.locator('[data-task-category-id]')).toHaveCount(5);
});

// Regression: one physical gesture must not fling two dates, regardless of speed,
// and every release must finish on the actual slide rather than between days.
test('Day View single-gesture fling and partial release snap to exactly one day', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-label', 'Tuesday, September 15, 2026');
  await waitForStableVerticalPosition(dialog);
  const swiper = dialog.getByTestId('day-swiper');
  const assertAligned = async () => {
    await expect.poll(() => swiper.evaluate((element) => {
      const active = element.querySelector('.swiper-slide-active');
      if (!active) return Infinity;
      return Math.abs(active.getBoundingClientRect().left - element.getBoundingClientRect().left);
    })).toBeLessThan(8);
  };

  // A fast swipe kept inside the viewport moves at most one calendar day.
  await drag(page, swiper, -260);
  await expect(dialog).toHaveAttribute('aria-label', 'Wednesday, September 16, 2026');
  await assertAligned();

  // A halfway reverse release may settle to either neighbor according to
  // velocity, but must finish fully aligned and commit that exact visible date.
  await drag(page, swiper, 200);
  await assertAligned();
  const partialIndex = await swiper.evaluate((element) => element.swiper.activeIndex);
  expect([90, 91]).toContain(partialIndex);
  await expect.poll(async () => {
    const heading = (await swiper.locator('.swiper-slide-active [data-day-view-navigation="true"] h3').textContent())?.trim();
    return await dialog.getAttribute('aria-label') === heading;
  }).toBe(true);

  // Every new fast gesture advances exactly one date from its own start.
  await drag(page, swiper, -260);
  await expect.poll(() => swiper.evaluate((element) => element.swiper.activeIndex)).toBe(partialIndex + 1);
  await assertAligned();
  await expect.poll(async () => {
    const heading = (await swiper.locator('.swiper-slide-active [data-day-view-navigation="true"] h3').textContent())?.trim();
    return await dialog.getAttribute('aria-label') === heading;
  }).toBe(true);
});

test('inactive adjacent Day View keeps category spacing when it becomes active', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();

  const dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);

  const nextSlide = dialog
    .locator('.swiper-slide')
    .filter({ hasText: 'Wednesday, September 16, 2026' });
  await expect(nextSlide).toHaveCount(1);

  const nextCategories = nextSlide.locator('[data-task-category-id]');
  await expect(nextCategories).toHaveCount(5);

  const firstBefore = await nextCategories.nth(0).boundingBox();
  const secondBefore = await nextCategories.nth(1).boundingBox();
  if (!firstBefore || !secondBefore) {
    throw new Error('Missing inactive next-day category geometry');
  }
  const spacingBefore = secondBefore.y - firstBefore.y;

  const currentSlide = dialog.locator('.swiper-slide-active');
  const currentTitle = currentSlide.getByRole('button', {
    name: 'Task 1.1',
    exact: true,
  });
  await dragWithMouse(page, currentTitle, -240);

  const activeSlide = dialog.locator('.swiper-slide-active');
  await expect(activeSlide).toContainText('Wednesday, September 16, 2026');

  const activeCategories = activeSlide.locator('[data-task-category-id]');
  const firstAfter = await activeCategories.nth(0).boundingBox();
  const secondAfter = await activeCategories.nth(1).boundingBox();
  if (!firstAfter || !secondAfter) {
    throw new Error('Missing active next-day category geometry');
  }
  const spacingAfter = secondAfter.y - firstAfter.y;

  expect(Math.abs(spacingAfter - spacingBefore)).toBeLessThanOrEqual(1);
});

// #856: a held task must advance days instead of merely reordering inside
// its source day. Pure edge detection tests cannot catch missing sensor wiring.
test('long-held task at Day View edge advances repeatedly without releasing or showing blank days', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch gestures require Chromium');
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);
  const swiper = dialog.getByTestId('day-swiper');
  const bounds = await swiper.boundingBox();
  if (!bounds) throw new Error('Missing Day View viewport');
  const title = swiper.locator('.swiper-slide-active').getByRole('button', {
    name: 'Task 1.1', exact: true,
  });
  await expect(title).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') (window).__mosaicHeldTouchPointerId = event.pointerId;
    }, { once: true, capture: true });
  });
  const gesture = await startTaskLongPress(page, title);
  const rightEdge = bounds.x + bounds.width - 6;
  const leftEdge = bounds.x + 6;
  const middle = bounds.x + bounds.width / 2;
  try {
    await gesture.moveTo(rightEdge, gesture.startY);
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Wednesday, September 16, 2026', { timeout: 6500 },
    );
    const carried = page.locator('[data-cross-day-drag-overlay="true"]');
    await expect(carried).toBeVisible();
    // Some phones cancel the PointerEvent stream when Swiper replaces the
    // original touched row. The same Touch identifier remains physically held
    // and must keep the carried task alive through that pointercancel.
    const liveTouchId = await page.evaluate(() => {
      const touch = (window).__mosaicHeldTouchPointerId;
      return typeof touch === 'number' ? touch : null;
    });
    if (liveTouchId !== null) {
      await page.evaluate(id => {
        window.dispatchEvent(new PointerEvent('pointercancel', {
          pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true,
        }));
      }, liveTouchId);
      await expect(carried).toBeVisible();
    }
    // The visual task must follow touch movement DURING a Swiper transition.
    // Previously this position froze until settling, losing the finger.
    const before = await carried.boundingBox();
    if (!before) throw new Error('No carried task bounds');
    await gesture.moveTo(rightEdge - 12, gesture.startY + 38);
    await expect.poll(async () => (await carried.boundingBox())?.y ?? before.y)
      .toBeGreaterThan(before.y + 22);
    await expect(page.locator('[data-cross-day-insertion-gap="true"]')).toHaveCount(0);
    await expect(page.getByTestId('cross-day-drag-status')).toHaveCount(0);
    // Stationary finger must trigger another day after the cooldown.
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Thursday, September 17, 2026', { timeout: 6500 },
    );
    await gesture.moveTo(middle, gesture.startY + 38);
    await page.waitForTimeout(1100);
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Thursday, September 17, 2026',
    );
    await gesture.moveTo(leftEdge, gesture.startY + 38);
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Wednesday, September 16, 2026', { timeout: 6500 },
    );
    await expect(dialog.locator('.swiper-slide-active [data-task-category-id]')).toHaveCount(5);
  } finally {
    await gesture.cancel();
  }
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
});

// #856: near-edge release must never leave the floating source alive or
// let delayed edge timers swipe further. Test both release on the edge and
// after moving inward into a populated category drop target.
test('released touch task stops edge navigation and clears the overlay in both drop zones', async ({page, browserName}) => {
  test.skip(browserName !== 'chromium', 'CDP touch requires Chromium');
  for (const landing of ['edge', 'category']) {
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&crossDayDestinations=1`);
    await page.getByTestId('open-day-view-sheet').click();
    const dialog = page.getByRole('dialog');
    await waitForStableVerticalPosition(dialog);
    const swiper = dialog.getByTestId('day-swiper');
    const bounds = await swiper.boundingBox();
    if (!bounds) throw new Error('Missing Day View geometry');
    const title = swiper.locator('.swiper-slide-active').getByRole('button', {name:'Task 1.1', exact:true});
    const gesture = await startTaskLongPress(page, title);
    const edge = bounds.x + bounds.width - 6;
    await gesture.moveTo(edge, gesture.startY);
    await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toBeVisible();
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Wednesday, September 16, 2026', {timeout:6500});
    if (landing === 'category') {
      const row = dialog.locator('.swiper-slide-active [data-task-category-id="cat_0"] [data-task-id]').first();
      const box = await row.boundingBox();
      if (!box) throw new Error('Missing destination category task');
      await gesture.moveTo(bounds.x + bounds.width / 2, box.y + box.height / 2);
      await expect(dialog.locator('.swiper-slide-active [data-cross-day-reorder-slot="true"]')).toHaveCount(1);
      // Keep the DOM nodes of existing destination rows and categories
      // through the handoff. Remounting them creates the visible flicker
      // even when final row geometry does not overlap.
      await page.evaluate(() => {
        const active = document.querySelector('.swiper-slide-active');
        window.__crossDayDropStableNodes = {
          category: active?.querySelector('[data-task-category-id="cat_0"]'),
          task: active?.querySelector('[data-task-category-id="cat_0"] [data-task-id]'),
        };
      });
    }
    await gesture.finish();
    await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
    // The first release may interrupt an in-flight transition and snap back
    // to its last settled day. Whichever date wins, it must stay stable.
    const activeDate = await dialog.locator('.swiper-slide-active [data-date-str]').getAttribute('data-date-str');
    await page.waitForTimeout(1250);
    await expect(dialog.locator('.swiper-slide-active [data-date-str]')).toHaveAttribute('data-date-str', activeDate);
    await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
    if (landing === 'category') {
      await expect.poll(() => page.evaluate(() => {
        const nodes = window.__crossDayDropStableNodes;
        const active = document.querySelector('.swiper-slide-active');
        return Boolean(nodes?.category && nodes?.task && nodes.category.isConnected &&
          nodes.task.isConnected &&
          nodes.category === active?.querySelector('[data-task-category-id="cat_0"]') &&
          nodes.task === active?.querySelector('[data-task-category-id="cat_0"] [data-task-id]'));
      })).toBe(true);
    }
    // Settled sibling rows must not overlap each other after the neutral
    // insertion space is traded for the persisted row.
    const boxes = await dialog.locator('.swiper-slide-active [data-task-category-id="cat_0"] [data-task-id]')
      .evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return {top:rect.top,bottom:rect.bottom};
      }));
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
    }
  }
});

// #856: the original touchend can fail to bubble after virtual slide
// replacement, but the physical pointerup is still a definitive release.
test('pointerup during held touch clears the cross-day drag even without touchend', async ({page,browserName}) => {
  test.skip(browserName !== 'chromium', 'CDP touch requires Chromium');
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog');
  await waitForStableVerticalPosition(dialog);
  const swiper = dialog.getByTestId('day-swiper');
  const bounds = await swiper.boundingBox();
  if (!bounds) throw new Error('Missing Day View geometry');
  await page.evaluate(() => window.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') window.__mosaicReleasePointer = event.pointerId;
  },{capture:true,once:true}));
  const title = swiper.locator('.swiper-slide-active').getByRole('button',{name:'Task 1.1',exact:true});
  const gesture = await startTaskLongPress(page,title);
  await gesture.moveTo(bounds.x + bounds.width - 6,gesture.startY);
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toBeVisible();
  const id = await page.evaluate(() => window.__mosaicReleasePointer);
  await page.evaluate(pointerId => window.dispatchEvent(new PointerEvent('pointerup', {
    pointerId,pointerType:'touch',button:0,buttons:0,isPrimary:true,bubbles:true,
  })), id);
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
  const activeDate = await dialog.locator('.swiper-slide-active [data-date-str]').getAttribute('data-date-str');
  await page.waitForTimeout(1150);
  await expect(dialog.locator('.swiper-slide-active [data-date-str]')).toHaveAttribute('data-date-str', activeDate);
  await gesture.cancel();
});

// #856: the destination day must respond to the carried task just like the
// original day's animated reorder, with a neutral reserved slot and no writes
// until release. Populate the NEXT day (normal probe days are empty).
test('held touch drag animates insertion through populated next-day rows and categories', async ({page, browserName}) => {
  test.skip(browserName !== 'chromium', 'CDP touch requires Chromium');
  const fixtureErrors = [];
  page.on('pageerror', error => fixtureErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') fixtureErrors.push(message.text());
  });
  const loaded = await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&crossDayDestinations=1`);
  await page.waitForTimeout(750);
  console.log('CROSS_DAY_FIXTURE_DIAGNOSTICS', JSON.stringify({
    status: loaded?.status(), url: page.url(), errors: fixtureErrors.slice(0, 8),
    text: (await page.locator('body').innerText().catch(() => 'NO BODY')).slice(0, 350),
  }));
  await expect(page.getByTestId('open-day-view-sheet')).toBeVisible({timeout:12000});
  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);
  const swiper = dialog.getByTestId('day-swiper');
  const bounds = await swiper.boundingBox();
  if (!bounds) throw new Error('Missing Day View');
  const title = swiper.locator('.swiper-slide-active').getByRole('button', { name: 'Task 1.1', exact: true });
  const gesture = await startTaskLongPress(page, title);
  const middle = bounds.x + bounds.width / 2;
  const edge = bounds.x + bounds.width - 6;
  try {
    await gesture.moveTo(edge, gesture.startY);
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Wednesday, September 16, 2026', { timeout: 6500 });
    const active = dialog.locator('.swiper-slide-active');
    const firstCategory = active.locator('[data-task-category-id="cat_0"]');
    const secondCategory = active.locator('[data-task-category-id="cat_1"]');
    await expect(firstCategory.locator('[data-task-id]')).toHaveCount(2);
    await expect(secondCategory.locator('[data-task-id]')).toHaveCount(3);
    const firstRow = await firstCategory.locator('[data-task-id]').first().boundingBox();
    if (!firstRow) throw new Error('Missing destination rows');
    const startY = firstRow.y + Math.min(firstRow.height / 4, 8);
    await gesture.moveTo(middle, startY);
    const firstSlot = firstCategory.locator('[data-cross-day-reorder-slot="true"]');
    await expect(firstSlot).toHaveCount(1);
    const topSlot = await firstSlot.boundingBox();
    if (!topSlot) throw new Error('Missing reserved insertion slot');
    // Push siblings down as the held finger crosses their rows.
    const lastRow = await firstCategory.locator('[data-task-id]').last().boundingBox();
    if (!lastRow) throw new Error('Missing final destination task');
    await gesture.moveTo(middle, Math.min(bounds.y + bounds.height - 35, lastRow.y + lastRow.height - 4));
    await expect.poll(async () => (await firstSlot.boundingBox())?.y ?? topSlot.y)
      .toBeGreaterThan(topSlot.y + 12);
    // Move into another category without lifting. Its rows now make room,
    // and the former category collapses its empty slot.
    const secondBox = await secondCategory.boundingBox();
    if (!secondBox) throw new Error('Missing next destination category');
    await gesture.moveTo(middle, Math.min(bounds.y + bounds.height - 30, secondBox.y + 34));
    await expect(secondCategory.locator('[data-cross-day-reorder-slot="true"]')).toHaveCount(1);
    await expect(firstCategory.locator('[data-cross-day-reorder-slot="true"]')).toHaveCount(0);
    await expect(page.locator('[data-cross-day-insertion-gap="true"]')).toHaveCount(0);
  } finally {
    await gesture.cancel();
  }
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
});

test.describe('desktop pointer ownership — no touch emulation', () => {
  test.use({
    isMobile: false,
    hasTouch: false,
    viewport: { width: 1280, height: 840 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  });

// #856: genuine held primary-mouse dragging is distinct from Swiper's
// ordinary mouse swipe. The old touch-only regression missed this failure.
test('held mouse task drag advances Day View at right edge and ends at mouseup', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);
  // Exercise the supported compact-sheet geometry: full-width sheets touch
  // both browser edges, so a cursor cannot physically move beyond them.
  await dialog.evaluate((sheet) => {
    sheet.style.width = 'min(540px, calc(100vw - 2rem))';
    sheet.style.left = '50%';
    sheet.style.right = 'auto';
    sheet.style.translate = '-50% 0';
  });
  const swiper = dialog.getByTestId('day-swiper');
  const bounds = await swiper.boundingBox();
  if (!bounds) throw new Error('Missing Day View viewport');
  const title = swiper.locator('.swiper-slide-active').getByRole('button', {
    name: 'Task 1.1', exact: true,
  });
  const task = await title.boundingBox();
  if (!task) throw new Error('Missing draggable task title');
  const x = task.x + task.width * 0.5;
  const y = task.y + Math.min(task.height * 0.5, 18);
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'left' });
  try {
    await page.waitForTimeout(580);
    await expect(page.locator('[data-task-drag-overlay="true"]')).toBeVisible();
    // Maintain the hold after leaving the Day View boundary horizontally.
    // This is still inside the browser viewport so physical pointer events flow.
    const beyondRight = bounds.x + bounds.width + 30;
    const beyondLeft = bounds.x - 30;
    expect(beyondRight).toBeLessThan(1280);
    expect(beyondLeft).toBeGreaterThan(0);
    await page.mouse.move(beyondRight, y, { steps: 9 });
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Wednesday, September 16, 2026', { timeout: 6500 },
    );
    await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toBeVisible();
    // Crossing outside the other side reverses without lifting.
    await page.mouse.move(beyondLeft, y, { steps: 9 });
    await expect(dialog.locator('.swiper-slide-active')).toContainText(
      'Tuesday, September 15, 2026', { timeout: 6500 },
    );
    await page.mouse.move(bounds.x + bounds.width * 0.5, y, { steps: 5 });
  } finally {
    await page.mouse.up({ button: 'left' });
  }
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
  const releasedDay = await dialog.locator('.swiper-slide-active [data-date-str]').first().getAttribute('data-date-str');
  if (!releasedDay) throw new Error('No settled day after mouse release');
  // Moving to an edge WITHOUT pressing again must not restart any dragged
  // overlay or make the date advance autonomously.
  await page.mouse.move(bounds.x + bounds.width + 30, y, { steps: 10 });
  await page.mouse.move(bounds.x - 30, y, { steps: 10 });
  await page.waitForTimeout(1200);
  await expect(dialog.locator('.swiper-slide-active [data-date-str]').first()).toHaveAttribute('data-date-str', releasedDay);
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
});

test('ordinary mouse Day View swipe stops following cursor when button is released', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);
  const swiper = dialog.getByTestId('day-swiper');
  const bounds = await swiper.boundingBox();
  if (!bounds) throw new Error('Missing Day View viewport');
  const title = swiper.locator('.swiper-slide-active').getByRole('button', {
    name: 'Task 1.1', exact: true,
  });
  await dragWithMouse(page, title, -240);
  await expect(dialog.locator('.swiper-slide-active')).toContainText('Wednesday, September 16, 2026');
  await page.mouse.move(bounds.x + bounds.width - 9, bounds.y + bounds.height / 2, { steps: 12 });
  await page.waitForTimeout(1100);
  await expect(dialog.locator('.swiper-slide-active')).toContainText('Wednesday, September 16, 2026');
  await expect(page.locator('[data-cross-day-drag-overlay="true"]')).toHaveCount(0);
});

}); // desktop pointer ownership

test('mouse drag over a task title swipes the Day View instead of being trapped by the task control', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();

  const dialog = page.getByRole('dialog', {
    name: 'Tuesday, September 15, 2026',
  });
  await expect(dialog).toBeVisible();
  await waitForStableVerticalPosition(dialog);

  const activeSlide = dialog.locator('.swiper-slide-active');
  await expect(activeSlide).toContainText('Tuesday, September 15, 2026');

  const title = activeSlide.getByRole('button', {
    name: 'Task 1.1',
    exact: true,
  });
  await expect(title).toBeVisible();

  await dragWithMouse(page, title, -240);

  await expect(dialog.locator('.swiper-slide-active')).toContainText(
    'Wednesday, September 16, 2026'
  );
  await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(0);
});

test('ArrowLeft and ArrowRight navigate the calendar but preserve text caret keys', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const title = page.getByTestId('calendar-title');
  const keyboardTarget = page.getByTestId('keyboard-target');
  const input = page.getByRole('textbox', { name: 'Editable arrow target' });

  const initialTitle = await title.textContent();
  await keyboardTarget.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => title.textContent()).not.toBe(initialTitle);

  const navigatedTitle = await title.textContent();
  await input.focus();
  await input.evaluate((element) => {
    element.setSelectionRange(1, 1);
  });
  await page.keyboard.press('ArrowRight');

  await expect(title).toHaveText(navigatedTitle ?? '');
  const caret = await input.evaluate((element) => element.selectionStart);
  expect(caret).toBe(2);
});

test('interaction harness reflows without horizontal page overflow at 320 CSS px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('interaction harness has no detectable non-visual WCAG A/AA axe violations', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();

  expect(results.violations).toEqual([]);
});


// #956: keyboard-driven month changes must never scroll the Embla viewport
// through Element.scrollIntoView while focus moves to an incoming period.
test('Calendar keyboard period changes snap to a full-width slide', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'));
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&calendarPath=1`);
  const host = page.getByTestId('real-calendar-cold-probe');
  const start = host.locator('[data-calendar-slide-index="30"] button[data-calendar-day="2026-09-15"]');
  await expect(start).toHaveCount(1);
  await start.evaluate(node => node.focus({ preventScroll: true }));

  // The fixture may have a stable inset from its scroll-gutter and
  // surrounding layout. Compare incoming slides to the initially settled
  // period, rather than assuming the viewport and slide share pixel-zero.
  const snapOffset = async (index) => host.evaluate((root, selected) => {
    const viewport = root.querySelector('[data-route-swipe-horizontal-owner]');
    const slide = root.querySelector(`[data-calendar-slide-index="${selected}"]`);
    if (!(viewport instanceof HTMLElement) || !(slide instanceof HTMLElement)) return 10000;
    return slide.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
  }, index);
  const initialOffset = await snapOffset(30);
  expect(Math.abs(initialOffset)).toBeLessThan(20);

  // Exercise successive keyboard changes while the carousel is animating.
  for (const [key, index, date] of [
    ['PageDown', 31, '2026-10-15'],
    ['PageDown', 32, '2026-11-15'],
    ['PageUp', 31, '2026-10-15'],
    ['PageUp', 30, '2026-09-15'],
  ]) {
    await page.keyboard.press(key);
    await expect(host.locator(`[data-calendar-slide-index="${index}"] button[data-calendar-day="${date}"]`))
      .toBeFocused();
    await expect.poll(async () => Math.abs((await snapOffset(index)) - initialOffset),
      { timeout: 3500, intervals: [70, 100, 130, 170, 250] }).toBeLessThan(2);
  }
});

// #640: actual CalendarBody/DayCell first tap must paint the sheet shell
// before running the expensive DayViewSheet subtree. This is an ordering
// contract, not a machine-dependent millisecond performance budget.
test('Calendar first sheet open commits a shell before Day View slides', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'));
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&calendarPath=1`);
  const calendar = page.getByTestId('real-calendar-cold-probe');
  const day = calendar.locator('button[aria-label*="September 15, 2026"]').first();
  await expect(day).toBeVisible();
  await expect(calendar).toHaveAttribute('data-module-ready', 'true');
  const result = await page.evaluate(async () => {
    const dayCell = document.querySelector(
      '[data-testid="real-calendar-cold-probe"] button[aria-label*="September 15, 2026"]'
    );
    if (!(dayCell instanceof HTMLButtonElement)) throw new Error('Calendar day unavailable');
    let shellBeforeContent = false;
    let sawContent = false;
    const inspect = () => {
      const shell = document.querySelector('[role="dialog"]');
      const content = document.querySelector('[role="dialog"] [data-testid="day-swiper"]');
      if (shell && !content) shellBeforeContent = true;
      if (content) sawContent = true;
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    window.__mosaicFlushCalendarClick(() => dayCell.click());
    const sameCommitShell = Boolean(document.querySelector('[role="dialog"]'));
    const start = performance.now();
    while (!sawContent && performance.now() - start < 5000) {
      await new Promise(requestAnimationFrame);
      inspect();
    }
    observer.disconnect();
    return { shellBeforeContent, sawContent, sameCommitShell };
  });
  expect(result.sameCommitShell).toBe(true);
  expect(result.sawContent).toBe(true);
  expect(result.shellBeforeContent).toBe(true);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await day.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

// Browser geometry regression: animate real height, not reordered sibling transforms.
test('category editors expand and switch without overlapping adjacent categories', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?categoryMotion`);
  const selector = '[data-testid="category-editor-motion-probe"] li[aria-label$=" category"]';
  const rows = page.locator(selector);
  await expect(rows).toHaveCount(3);

  async function sampleTransition(editIndex, interruptIndex = null) {
    return page.evaluate(async ({ editIndex, interruptIndex, selector }) => {
      const items = Array.from(document.querySelectorAll(selector));
      const heightsBefore = items.map(el => el.getBoundingClientRect().height);
      items[editIndex].querySelector('button[aria-label="Edit category"]').click();
      let maximumOverlap = 0;
      let finalHeights = [];
      for (let frame = 0; frame < 28; frame++) {
        await new Promise(requestAnimationFrame);
        if (frame === 5 && interruptIndex !== null) {
          items[interruptIndex].querySelector('button[aria-label="Edit category"]').click();
        }
        const boxes = items.map(el => el.getBoundingClientRect());
        finalHeights = boxes.map(box => box.height);
        for (let index = 0; index + 1 < boxes.length; index++) {
          maximumOverlap = Math.max(maximumOverlap, boxes[index].bottom - boxes[index + 1].top);
        }
      }
      return { heightsBefore, finalHeights, maximumOverlap };
    }, { editIndex, interruptIndex, selector });
  }

  const opening = await sampleTransition(0);
  expect(opening.maximumOverlap).toBeLessThan(1);
  expect(opening.finalHeights[0]).toBeGreaterThan(opening.heightsBefore[0] + 100);

  const switching = await sampleTransition(1);
  expect(switching.maximumOverlap).toBeLessThan(1);
  expect(switching.finalHeights[1]).toBeGreaterThan(switching.heightsBefore[1] + 100);
  expect(switching.finalHeights[0]).toBeLessThan(switching.heightsBefore[0] - 100);

  const interrupted = await sampleTransition(0, 2);
  expect(interrupted.maximumOverlap).toBeLessThan(1);
  await expect(rows.nth(2).getByRole('button', { name: 'Edit category' })).toHaveAttribute('aria-expanded', 'true');
  await expect(rows.nth(0).getByRole('textbox', { name: 'Name' })).toHaveCount(0);
});
