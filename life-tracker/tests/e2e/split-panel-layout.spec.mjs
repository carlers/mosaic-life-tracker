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
    .toBeLessThan(12);
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

      await startFrameCapture(page, 31);
      await page.getByRole('button', { name: 'Close day details' }).click();
      await expect(motion).toHaveCount(0);
      const closing = await endFrameCapture(page);
      assertNoShaking(closing, 'close ' + height + ' ' + side);
      await expect.poll(() => alignment(page, 31)).toBeLessThan(2);
    });
  }
}
