import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 850 }, isMobile: false, hasTouch: false });

async function alignment(page, focusIndex) {
  return page.evaluate((index) => {
    const viewport = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
    const focused = document.querySelector(`[data-calendar-slide-index="${index}"]`);
    if (!(viewport instanceof HTMLElement) || !(focused instanceof HTMLElement)) return 999;
    return Math.abs(focused.getBoundingClientRect().left - viewport.getBoundingClientRect().left);
  }, focusIndex);
}

async function startFrameCapture(page, focusIndex) {
  await page.evaluate((index) => {
    window.__splitFrames = [];
    window.__splitCapture = true;
    window.__splitObserver?.disconnect();
    const viewport = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
    if (!(viewport instanceof HTMLElement)) throw Error('Missing carousel viewport');
    const capture = () => {
      if (!window.__splitCapture) return;
      const selected = document.querySelector(`[data-calendar-slide-index="${index}"]`);
      const panel = document.querySelector('[data-testid="day-panel-motion-host"]');
      if (!(selected instanceof HTMLElement)) return;
      window.__splitFrames.push({
        offset: Math.abs(selected.getBoundingClientRect().left - viewport.getBoundingClientRect().left),
        viewportWidth: viewport.getBoundingClientRect().width,
        slideWidth: selected.getBoundingClientRect().width,
        nativeScrollLeft: viewport.scrollLeft,
        panelWidth: panel instanceof HTMLElement ? panel.getBoundingClientRect().width : 0,
      });
    };
    // Layout resize notifications run after animation-frame callbacks and before
    // paint. A microtask at the end of the notification batch observes the
    // corrected geometry that actually reaches the screen, not stale pre-RO
    // geometry sampled in rAF (a false positive in the previous test).
    window.__splitObserver = new ResizeObserver(() => queueMicrotask(capture));
    window.__splitObserver.observe(viewport);
  }, focusIndex);
}

async function endFrameCapture(page) {
  return page.evaluate(() => {
    window.__splitCapture = false;
    window.__splitObserver?.disconnect();
    window.__splitObserver = null;
    return window.__splitFrames ?? [];
  });
}

function assertNoShaking(frames, phase) {
  expect(frames.length, phase + ': not enough observed paint frames').toBeGreaterThan(6);
  const max = Math.max(...frames.map(frame => frame.offset));
  // Assert actual rendered alignment *during* motion, not only eventual
  // reInit after the 300ms width transition or pointer-up.
  expect(max, phase + ': maximum focused-month offset across paints; samples=' +
    JSON.stringify(frames.filter((_, index) => index % 4 === 0).slice(0, 14)))
    .toBeLessThan(2);
  expect(Math.max(...frames.map(frame => Math.abs(frame.nativeScrollLeft))),
    phase + ': carousel viewport must not natively scroll horizontally').toBe(0);
  // No amount of left-edge resnapping compensates for a clipped or stretched
  // month: require the selected full seven-column slide to fit every frame.
  expect(Math.max(...frames.map(frame => Math.abs(frame.slideWidth - frame.viewportWidth))),
    phase + ': month slide width must match visible grid width').toBeLessThan(2);
}

// A swipe after a panel has fully opened must use the current calendar width,
// not stale global offsets from Embla's pre-panel measurements.
async function swipeMonth(page, direction, expectedIndex) {
  const viewport = page.locator('[data-route-swipe-horizontal-owner="true"]');
  const box = await viewport.boundingBox();
  if (!box) throw Error('Missing calendar for swipe');
  const title = await page.getByTestId('split-focused-title').textContent();
  const y = box.y + Math.min(130, box.height / 3);
  const fromX = box.x + box.width * (direction === 'next' ? .82 : .18);
  const toX = box.x + box.width * (direction === 'next' ? .18 : .82);
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('split-focused-title')).not.toHaveText(title ?? '');
  // Tests the *next* selected slide after genuine user dragging; a stale
  // Embla snap gives a persistent +panelWidth offset on left placement.
  await expect.poll(() => alignment(page, expectedIndex)).toBeLessThan(2);
  await expect(viewport).toHaveJSProperty('scrollLeft', 0);
}

for (const height of ['grid', 'screen']) {
  for (const side of ['left', 'right']) {
    test(`${side} panel retains focused month through live ${height} resize and reaches bottom`, async ({ page }) => {
      await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?splitPanelProbe=${height}&side=${side}`);
      const viewport = page.locator('[data-route-swipe-horizontal-owner="true"]');
      await expect(viewport).toBeVisible();
      await expect.poll(() => alignment(page, 30)).toBeLessThan(2);

      // Previous tests always selected slide 30, although a real user may
      // navigate to month 31 before opening a left-side inspector.
      const initialTitle = await page.getByTestId('split-focused-title').textContent();
      await page.getByTestId('split-next-month').click();
      await expect(page.getByTestId('split-focused-title')).not.toHaveText(initialTitle ?? '');
      await expect.poll(() => alignment(page, 31)).toBeLessThan(2);
      // Native viewport scrolling must remain impossible even after resizing stops.
      await expect(viewport).toHaveJSProperty('scrollLeft', 0);

      const first = page.locator('[data-calendar-slide-index="31"] [data-calendar-day]').first();
      await startFrameCapture(page, 31);
      await first.click();
      const inspector = page.getByRole('complementary', { name: 'Day details' });
      await expect(inspector).toBeVisible();
      await page.waitForTimeout(370);
      const opening = await endFrameCapture(page);
      assertNoShaking(opening, 'open ' + height + ' ' + side);
      expect(opening.some(frame => frame.panelWidth > 25 && frame.panelWidth < 350),
        'panel must expand through intermediate widths').toBe(true);
      await expect.poll(() => alignment(page, 31)).toBeLessThan(2);
      // Native viewport scrolling must remain impossible even after resizing stops.
      await expect(viewport).toHaveJSProperty('scrollLeft', 0);

      // The previous regression never navigated while the panel was open.
      await swipeMonth(page, 'next', 32);
      await swipeMonth(page, 'prev', 31);

      const bounds = await page.evaluate((mode) => {
        const host = document.querySelector('[data-testid="day-panel-motion-host"]');
        const workspace = document.querySelector('[data-testid="split-workspace"]');
        const frame = document.querySelector('[data-testid="split-calendar-frame"]');
        if (!(host instanceof HTMLElement) || !(workspace instanceof HTMLElement)
          || !(frame instanceof HTMLElement)) return null;
        return {
          panel: host.getBoundingClientRect().toJSON(),
          workspace: workspace.getBoundingClientRect().toJSON(),
          calendarFrame: frame.getBoundingClientRect().toJSON(),
          mode,
        };
      }, height);
      if (!bounds) throw Error('Missing panel or workspace geometry');
      expect(Math.abs(bounds.panel.bottom - bounds.workspace.bottom)).toBeLessThan(4);
      expect(Math.abs(bounds.panel.top - (height === 'screen'
        ? bounds.workspace.top : bounds.calendarFrame.top))).toBeLessThan(4);
      // Deliberately make the calendar grid shorter than the workspace.
      expect(bounds.workspace.bottom - bounds.calendarFrame.bottom).toBeGreaterThan(100);
      const motion = page.getByTestId('day-panel-motion-host');
      await expect(motion).toHaveCSS('opacity', '1');

      const divider = page.getByRole('separator', { name: 'Resize day details panel' });
      const box = await divider.boundingBox();
      if (!box) throw Error('Missing split divider');
      const dir = side === 'left' ? 1 : -1;
      await startFrameCapture(page, 31);
      await page.mouse.move(box.x + box.width / 2, box.y + 50);
      await page.mouse.down();
      // Direct manipulation must not inherit the 300ms open/close easing.
      await expect(motion).toHaveCSS('transition-duration', '0s');
      for (let step = 1; step <= 8; step++) {
        await page.mouse.move(box.x + box.width / 2 + dir * step * 8, box.y + 50);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(65);
      const dragging = await endFrameCapture(page);
      assertNoShaking(dragging, 'divider drag ' + height + ' ' + side);
      const resizeWidths = dragging.map(frame => frame.panelWidth);
      expect(Math.max(...resizeWidths) - Math.min(...resizeWidths)).toBeGreaterThan(35);
      await expect.poll(() => alignment(page, 31)).toBeLessThan(2);
      // Native viewport scrolling must remain impossible even after resizing stops.
      await expect(viewport).toHaveJSProperty('scrollLeft', 0);

      // Resizing must not be the only action that restores the correct snap.
      await swipeMonth(page, 'next', 32);
      await swipeMonth(page, 'prev', 31);
      // Horizontal trackpad/wheel follows Embla's measured snaps as well.
      const wheelBox = await viewport.boundingBox();
      if (!wheelBox) throw Error('Missing calendar viewport for wheel');
      await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + Math.min(130, wheelBox.height / 3));
      const wheelMonth = await page.getByTestId('split-focused-title').textContent();
      await page.mouse.wheel(750, 0);
      await expect(page.getByTestId('split-focused-title')).not.toHaveText(wheelMonth ?? '');
      await expect.poll(() => alignment(page, 32)).toBeLessThan(2);
      await page.mouse.wheel(-750, 0);
      await expect(page.getByTestId('split-focused-title')).toHaveText(wheelMonth ?? '');
      await expect.poll(() => alignment(page, 31)).toBeLessThan(2);


      await startFrameCapture(page, 31);
      await page.getByRole('button', { name: 'Close day details' }).click();
      await expect(motion).toHaveCount(0);
      const closing = await endFrameCapture(page);
      assertNoShaking(closing, 'close ' + height + ' ' + side);
      await expect.poll(() => alignment(page, 31)).toBeLessThan(2);
      // Native viewport scrolling must remain impossible even after resizing stops.
      await expect(viewport).toHaveJSProperty('scrollLeft', 0);
    });
  }
}

for (const side of ['left', 'right']) {
  test(`switching the ${side} panel from full screen to calendar height does not retain excess height`, async ({ page }) => {
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?splitPanelProbe=screen&side=${side}`);
    const viewport = page.locator('[data-route-swipe-horizontal-owner="true"]');
    await expect(viewport).toBeVisible();
    await page.locator('[data-calendar-slide-index="30"] [data-calendar-day]').first().click();
    const panel = page.getByTestId('day-panel-motion-host');
    await expect(panel).toBeVisible();
    const geometry = async () => page.evaluate(() => {
      const panel = document.querySelector('[data-testid="day-panel-motion-host"]');
      const workspace = document.querySelector('[data-testid="split-workspace"]');
      const frame = document.querySelector('[data-testid="split-calendar-frame"]');
      if (!(panel instanceof HTMLElement) || !(workspace instanceof HTMLElement) || !(frame instanceof HTMLElement))
        throw Error('Missing split layout');
      return {
        top: panel.getBoundingClientRect().top,
        bottom: panel.getBoundingClientRect().bottom,
        workspaceTop: workspace.getBoundingClientRect().top,
        workspaceBottom: workspace.getBoundingClientRect().bottom,
        frameTop: frame.getBoundingClientRect().top,
      };
    });
    await expect.poll(async () => Math.abs((await geometry()).bottom - (await geometry()).workspaceBottom)).toBeLessThan(3);
    const toggle = page.getByTestId('split-toggle-height');
    for (let step = 0; step < 4; step++) {
      await toggle.click();
      const expectedTop = step % 2 === 0 ? 'frameTop' : 'workspaceTop';
      await expect.poll(async () => {
        const current = await geometry();
        return Math.abs(current.top - current[expectedTop]) +
          Math.abs(current.bottom - current.workspaceBottom);
      }).toBeLessThan(4);
      await expect.poll(() => alignment(page, 30)).toBeLessThan(2);
    }
  });
}

test('task and category rows stay in phase with divider motion rather than easing after each width update', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?splitPanelProbe=grid&side=right&splitRows=1`);
  await page.locator('[data-calendar-slide-index="30"] [data-calendar-day]').first().click();
  const panel = page.getByTestId('day-panel-motion-host');
  const task = panel.locator('.swiper-slide-active [data-task-id]').first();
  await expect(task).toBeVisible({ timeout: 12000 });
  // Wait for the panel's independent 300ms opening transition before
  // measuring and grabbing its moving separator.
  await page.waitForTimeout(380);
  const divider = page.getByRole('separator', { name: 'Resize day details panel' });
  const box = await divider.boundingBox();
  if (!box) throw Error('Missing divider');
  await page.mouse.move(box.x + box.width / 2, box.y + 50);
  await page.mouse.down();
  await expect(panel).toHaveAttribute('data-day-panel-resizing', 'true');
  const frames = [];
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(box.x + box.width / 2 - step * 9, box.y + 50);
    await page.waitForTimeout(16);
    frames.push(await page.evaluate(() => {
      const host = document.querySelector('[data-testid="day-panel-motion-host"]');
      // Only the active Day View slide occupies the inspector. Virtualized
      // offscreen day slides can remain DOM-visible but far outside its bounds.
      const activeSlide = host?.querySelector('.swiper-slide-active');
      const row = activeSlide?.querySelector('[data-task-id]')?.closest('[data-panel-reorder-row]');
      const category = activeSlide?.querySelector('[data-panel-reorder-row]');
      const aside = host?.querySelector('[data-testid="calendar-day-side-panel"]');
      if (!(host instanceof HTMLElement) || !(row instanceof HTMLElement) ||
          !(category instanceof HTMLElement) || !(aside instanceof HTMLElement))
        throw Error('Missing real reorderable rows in inspector');
      const taskBounds = row.getBoundingClientRect();
      const panelBounds = aside.getBoundingClientRect();
      return {
        width: host.getBoundingClientRect().width,
        taskTransform: getComputedStyle(row).transform,
        categoryTransform: getComputedStyle(category).transform,
        withinPanel: taskBounds.left >= panelBounds.left - 2 && taskBounds.right <= panelBounds.right + 2,
      };
    }));
  }
  await page.mouse.up();
  expect(Math.max(...frames.map(frame => frame.width)) - Math.min(...frames.map(frame => frame.width))).toBeGreaterThan(40);
  const badFrames = frames.map((frame, index) => ({ index, ...frame }))
    .filter(frame => frame.taskTransform !== 'none' || frame.categoryTransform !== 'none' || !frame.withinPanel);
  expect(badFrames, 'Each live frame must keep task/category rows aligned: ' + JSON.stringify(frames)).toEqual([]);
  await expect(panel).not.toHaveAttribute('data-day-panel-resizing', 'true');
});
