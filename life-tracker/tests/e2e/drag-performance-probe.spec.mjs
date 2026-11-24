import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({ ignoreHTTPSErrors: true, viewport: { width: 412, height: 915 } });

test('diagnostic remains entirely absent without explicit opt-in', async ({ page }) => {
  await page.goto(BASE_URL + '/tests/e2e/drag-performance-fixture.html');
  await expect(page.locator('[data-mosaic-drag-probe]')).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelectorAll('[data-testid="day-slide"]').length))
    .toBe(1);
});

test('opt-in drag probe captures boundary-correlated frame metrics without user content', async ({ page }) => {
  const requests = [];
  page.on('request', request => { requests.push(request.url()); });
  await page.goto(BASE_URL + '/tests/e2e/drag-performance-fixture.html?mosaicDragProbe=1');
  const panel = page.locator('[data-mosaic-drag-probe]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Start drag test' })).toBeVisible();
  await page.evaluate(() => {
    // Reproduce the multi-slide production scenario: the first visible date
    // slide can be empty, but gestures happen in a second populated one.
    const actual = document.querySelector('[data-testid="day-slide"]');
    const empty = document.createElement('main');
    empty.setAttribute('data-testid', 'day-slide');
    empty.style.cssText = 'height:700px;width:100%';
    actual.parentElement.insertBefore(empty, actual);
    // Owner Diary uses a capture-phase window listener that stops propagation
    // so document-level pointerup handlers never receive this gesture.
    window.addEventListener('pointerup', event => {
      if (event.target instanceof Element &&
          event.target.closest('[data-diary-note-row]')) event.stopPropagation();
    }, { capture: true });
  });
  await panel.getByRole('button', { name: 'Start drag test' }).click();
  await page.evaluate(async () => {
    // Select the actual populated slide; intentionally skip the empty first
    // slide used to reproduce Mosaic's virtual-day root-selection issue.
    const root = document.querySelector('[data-category-drag-handle]')
      .closest('[data-testid="day-slide"]');
    const selectors = [
      '[data-category-drag-handle]', '[data-panel-reorder-row]',
      '[data-diary-note-row]', '[data-diary-drag-group]',
    ];
    for (let i = 0; i < selectors.length; i++) {
      const el = root.querySelector(selectors[i]);
      const pointerId = i + 51;
      const send = (type, y) => el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId, pointerType: 'mouse', isPrimary: true,
        button: 0, clientX: 100, clientY: y,
      }));
      send('pointerdown', 140);
      send('pointermove', 180);
      // The browser's MutationObserver must see a real in-day DOM reorder.
      root.appendChild(el.closest('.row'));
      await new Promise(resolve => setTimeout(resolve, 55));
      send('pointerup', 190);
    }
  });
  await panel.getByRole('button', { name: 'Stop' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {
        writeText: async text => { window.__dragProbeCopied = text; },
      },
    });
  });
  await panel.getByRole('button', { name: 'Copy JSON' }).click();
  await expect.poll(() => page.evaluate(() => !!window.__dragProbeCopied)).toBe(true);
  const copied = await page.evaluate(() => window.__dragProbeCopied);
  const report = JSON.parse(copied);
  expect(report.schema).toBe(3);
  expect(report.geometryProfile.enabled).toBe(true);
  expect(report.geometryProfile.installed).toContain('getBoundingClientRect');
  expect(report.experiment.mode).toBe('normal');
  expect(report.allLongAnimationFrameCount).toBeGreaterThanOrEqual(report.longAnimationFrames.length);
  expect(report.byKind.note.gestureFrames.samples).toBeGreaterThan(0);
  expect(report.gestures.map(gesture => gesture.kind))
    .toEqual(['category', 'task', 'note', 'group']);
  expect(report.gestures.every(gesture => gesture.moves > 0)).toBe(true);
  expect(report.pointerStartsByKind).toEqual({ category: 1, task: 1, note: 1, group: 1 });
  expect(report.detectedStructuralBoundaries.length).toBeGreaterThan(0);
  expect(report.frameIntervals.samples).toBeGreaterThan(0);
  expect(report.before.presentation).toBe('inline-or-other');
  expect(report.before.panelLayoutIsolation).toBe(false);
  expect(report.before.mountedDaySlides).toBe(2);
  expect(report.before.mountedCategoryRows).toBe(1);
  expect(report.before.dayViewWidthPx).toBeGreaterThan(100);
  expect(report.before.rendered.categoryHeaders).toBe(1);
  expect(report.observedPopulatedRoot).toBe(false); // fixture has no category-reorder root
  expect(report.gestures.some(gesture => gesture.kind === 'note' &&
    gesture.moves > 0 && !gesture.canceled)).toBe(true);
  expect(report.gestures.every(gesture => gesture.likelyDrag)).toBe(true);
  for (const secret of ['secret-abc-123', 'secret-def-456', 'secret-ghi-789',
    'private-diary-identifier', 'account-secret-xyz', 'Category name secret']) {
    expect(copied).not.toContain(secret);
  }
  // The same-origin diagnostic script is the only optional resource.
  expect(requests.some(url => url.includes('/diagnostics/drag-performance.js'))).toBe(true);
  expect(requests.every(url => new URL(url).origin === new URL(BASE_URL).origin)).toBe(true);
});

test('report distinguishes isolated side panel from ordinary Day View without identifiers', async ({ page }) => {
  await page.goto(BASE_URL + '/tests/e2e/drag-performance-fixture.html?mosaicDragProbe=1');
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="day-slide"]');
    const sidePanel = document.createElement('aside');
    sidePanel.dataset.testid = 'calendar-day-side-panel';
    sidePanel.dataset.panelLayoutIsolation = 'true';
    root.parentElement.insertBefore(sidePanel, root);
    sidePanel.appendChild(root);
  });
  const controls = page.locator('[data-mosaic-drag-probe]');
  await controls.getByRole('button', { name: 'Start drag test' }).click();
  await controls.getByRole('button', { name: 'Stop' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__dragProbeCopied = text; } },
    });
  });
  await controls.getByRole('button', { name: 'Copy JSON' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__dragProbeCopied))).toBe(true);
  const copied = await page.evaluate(() => window.__dragProbeCopied);
  const report = JSON.parse(copied);
  expect(report.before.presentation).toBe('side-panel');
  expect(report.after.presentation).toBe('side-panel');
  expect(report.before.panelLayoutIsolation).toBe(true);
  expect(report.after.panelLayoutIsolation).toBe(true);
  expect(report.before.mountedDaySlides).toBe(1);
  expect(report.before.mountedCategoryRows).toBe(1);
  expect(report.before.dayViewWidthPx).toBeGreaterThan(100);
  expect(copied).not.toContain('secret-abc-123');
});

test('comparison modes preserve panel geometry and restore native methods and Calendar after every recording', async ({ page }) => {
  await page.goto(BASE_URL + '/tests/e2e/drag-performance-fixture.html?mosaicDragProbe=1');
  const controls = page.locator('[data-mosaic-drag-probe]');
  await expect(controls).toBeVisible();
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="day-slide"]');
    const host = document.createElement('div');
    host.dataset.testid = 'day-panel-motion-host';
    host.style.cssText = 'width:100%;height:700px';
    const inner = document.createElement('div');
    inner.style.transform = 'translate3d(0,0,0)';
    const side = document.createElement('aside');
    side.dataset.testid = 'calendar-day-side-panel';
    root.before(host); host.append(inner); inner.append(side); side.append(root);
    const calendar = document.createElement('div');
    calendar.dataset.calendarKeyboardOwned = 'true';
    calendar.dataset.calendarPrimaryActive = 'true';
    calendar.style.cssText = 'width:100px;height:100px;content-visibility:visible';
    host.after(calendar);
    // Synthetic slow geometry call, independent of runner CPU variance.
    // The test installs this before Start and expects that exact method back.
    const original = Element.prototype.getBoundingClientRect;
    const synthetic = function (...args) {
      if (this.hasAttribute('data-panel-reorder-row')) {
        const t = performance.now();
        while (performance.now() - t < 12) { /* bounded test-only delay */ }
      }
      return original.apply(this, args);
    };
    Element.prototype.getBoundingClientRect = synthetic;
    window.__syntheticRect = synthetic;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async text => { window.__dragProbeCopied = text; } },
    });
  });
  const mode = controls.getByRole('combobox', { name: 'Performance test mode' });
  const start = controls.getByRole('button', { name: 'Start drag test' });
  const stop = controls.getByRole('button', { name: 'Stop', exact: true });
  await mode.selectOption('calendar-hidden');
  await start.click();
  await expect(mode).toBeDisabled();
  expect(await page.evaluate(() => {
    const c = document.querySelector('[data-calendar-keyboard-owned]');
    return c.inert && getComputedStyle(c).contentVisibility === 'hidden';
  })).toBe(true);
  await page.evaluate(async () => {
    const el = document.querySelector('[data-panel-reorder-row]');
    const send = (type, y) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, isPrimary: true, pointerId: 21, pointerType: 'mouse',
      button: 0, clientX: 100, clientY: y,
    }));
    send('pointerdown', 100); send('pointermove', 160);
    el.getBoundingClientRect();
    await new Promise(resolve => setTimeout(resolve, 60));
    send('pointerup', 180);
  });
  await stop.click();
  await expect(mode).toBeEnabled();
  expect(await page.evaluate(() => {
    const c = document.querySelector('[data-calendar-keyboard-owned]');
    return !c.inert && c.style.contentVisibility === 'visible' &&
      Element.prototype.getBoundingClientRect === window.__syntheticRect;
  })).toBe(true);
  await mode.selectOption('panel-transform-off');
  await start.click();
  await expect(mode).toBeDisabled();
  expect(await page.locator('[data-testid="day-panel-motion-host"] > div').evaluate(
    el => getComputedStyle(el).transform)).toBe('none');
  await stop.click();
  expect(await page.locator('[data-testid="day-panel-motion-host"] > div').evaluate(
    el => el.style.transform)).toBe('translate3d(0px, 0px, 0px)');
  await controls.getByRole('button', { name: 'Copy all tests' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__dragProbeCopied))).toBe(true);
  const copied = await page.evaluate(() => window.__dragProbeCopied);
  const set = JSON.parse(copied);
  expect(set.schema).toBe(3);
  expect(set.reports.map(r => r.experiment.mode)).toEqual(['calendar-hidden', 'panel-transform-off']);
  expect(set.reports.every(r => r.experiment.applied && r.experiment.retainedAtEnd)).toBe(true);
  expect(set.reports[0].before.calendarRenderState[0]).toMatchObject({
    inert: true, contentVisibility: 'hidden',
  });
  expect(set.reports[0].after.calendarRenderState[0]).toMatchObject({
    inert: true, contentVisibility: 'hidden',
  });
  expect(set.reports[0].geometryProfile.slowSites.some(s =>
    s.method === 'getBoundingClientRect' && s.scope === 'day-row-or-category' && s.kind === 'task'
  )).toBe(true);
  expect(set.reports[1].before.panelTransform).toBe('none');
  expect(copied).not.toContain('private-diary-identifier');
  expect(copied).not.toContain('secret-abc-123');
});

test('refuses an unavailable experiment without installing geometry wrappers', async ({ page }) => {
  await page.goto(BASE_URL + '/tests/e2e/drag-performance-fixture.html?mosaicDragProbe=1');
  const controls = page.locator('[data-mosaic-drag-probe]');
  await controls.getByRole('combobox').selectOption('calendar-hidden');
  await page.evaluate(() => { window.__beforeRect = Element.prototype.getBoundingClientRect; });
  await controls.getByRole('button', { name: 'Start drag test' }).click();
  await expect(controls.getByRole('status')).toHaveText('Open the side panel first.');
  expect(await page.evaluate(() => Element.prototype.getBoundingClientRect === window.__beforeRect)).toBe(true);
});
