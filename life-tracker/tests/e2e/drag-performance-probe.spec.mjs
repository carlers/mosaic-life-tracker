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
    const root = document.querySelector('[data-testid="day-slide"]');
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
  expect(report.schema).toBe(2);
  expect(report.gestures.map(gesture => gesture.kind))
    .toEqual(['category', 'task', 'note', 'group']);
  expect(report.gestures.every(gesture => gesture.moves > 0)).toBe(true);
  expect(report.pointerStartsByKind).toEqual({ category: 1, task: 1, note: 1, group: 1 });
  expect(report.detectedStructuralBoundaries.length).toBeGreaterThan(0);
  expect(report.frameIntervals.samples).toBeGreaterThan(0);
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
