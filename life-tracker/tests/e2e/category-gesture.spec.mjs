import { expect, test } from '@playwright/test';

const URL = (process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173') +
  '/tests/e2e/category-gesture.html';

test.use({
  ignoreHTTPSErrors: true,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 412, height: 915 },
});

async function center(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing category label bounds');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('mouse: stationary hold opens Edit, then movement lifts category', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  await expect(label).toBeVisible();
  const point = await center(label);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await page.mouse.move(point.x, point.y + 105, { steps: 12 });
  await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByTestId('category-drag-active')).toHaveText('no');
});

test('touch: stationary hold opens Edit, then movement starts pointer-locked drag', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  await expect(label).toBeVisible();
  expect(await label.evaluate(element => getComputedStyle(element).userSelect)).toBe('none');
  const { x, y } = await center(label);
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(650);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  for (let step = 1; step <= 12; step += 1) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + (120 * step) / 12 }],
    });
  }
  await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await expect(page.getByTestId('category-drag-active')).toHaveText('no');
});

test('touch: moving before the hold cancels category dragging and menu', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  await expect(label).toBeVisible();
  const { x, y } = await center(label);
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step += 1) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x, y: y + 45 * step / 8 }],
    });
  }
  await page.waitForTimeout(650);
  await expect(page.getByTestId('category-drag-active')).toHaveText('no');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await expect(page.getByTestId('category-order')).toHaveText('work,home,personal');
});

test('touch: held category label never selects text or opens the native callout', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  await expect(label).toBeVisible();
  const selection = await label.evaluate(element => {
    const pill = element.closest('.mosaic-category-pill');
    const labelStyles = getComputedStyle(element);
    const pillStyles = pill ? getComputedStyle(pill) : null;
    return {
      labelUserSelect: labelStyles.userSelect,
      pillUserSelect: pillStyles?.userSelect,
      touchCallout: pillStyles?.getPropertyValue('-webkit-touch-callout'),
    };
  });
  expect(selection.labelUserSelect).toBe('none');
  expect(selection.pillUserSelect).toBe('none');
  // -webkit-touch-callout is exposed by WebKit; Chromium may omit it.
  if (selection.touchCallout) expect(selection.touchCallout).toBe('none');
  const { x, y } = await center(label);
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(650);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
});

test.describe('desktop category pointer lock and visual lift', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1152, height: 860 } });

  test('dragged pill stays beneath Windows-style mouse pointer through variable-height swaps', async ({ page }) => {
    await page.goto(URL);
    const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
    const button = page.getByRole('button', { name: 'Add a task to Work' });
    await expect(button).toBeVisible();
    const initial = await button.boundingBox();
    if (!initial) throw new Error('No category pill bounds');
    const start = await center(label);
    const pressOffsetY = start.y - initial.y;
    const pressOffsetX = start.x - initial.x;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();

    const assertPointerLocked = async (x, y) => {
      const overlay = page.locator('[data-category-drag-overlay="work"]');
      await expect(overlay).toBeVisible();
      const rect = await overlay.boundingBox();
      if (!rect) throw new Error('Missing live category drag overlay');
      // The offset inside the pill must be invariant even when list rows reorder
      // or their heights differ; this is pointer positioning, not decorative CSS.
      expect(Math.abs(rect.y + pressOffsetY - y)).toBeLessThanOrEqual(2);
      expect(Math.abs(rect.x + pressOffsetX - x)).toBeLessThanOrEqual(2);
      const styles = await overlay.locator('button').evaluate((el) => {
        const css = getComputedStyle(el);
        return { border: css.borderTopWidth, outline: css.outlineStyle, shadow: css.boxShadow };
      });
      expect(styles.border).toBe('0px');
      expect(styles.outline).toBe('none');
      expect(styles.shadow).toBe('none');
    };

    const home = page.getByRole('button', { name: 'Add a task to Home' });
    const target = await home.boundingBox();
    if (!target) throw new Error('Missing destination category bounds');
    const downY = target.y + target.height / 2 + 28;
    await page.mouse.move(start.x, downY, { steps: 10 });
    await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
    // The stable DOM retains its original order until release. Category
    // sections visually trade slots through CSS transforms only.
    await expect.poll(() => page.locator('[data-category-reorder-id]').evaluateAll(
      rows => rows.map(row => row.getAttribute('data-category-reorder-id')).join(',')))
      .toBe('work,home,personal');
    await expect.poll(() => page.locator('[data-category-reorder-id="home"]')
      .evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
    await expect.poll(async () => {
      const [work, home] = await Promise.all([
        page.locator('[data-category-reorder-id="work"]').boundingBox(),
        page.locator('[data-category-reorder-id="home"]').boundingBox(),
      ]);
      return Boolean(work && home && home.y < work.y);
    }).toBe(true);
    await assertPointerLocked(start.x, downY);

    const fartherY = Math.min(710, downY + 145);
    await page.mouse.move(start.x + 15, fartherY, { steps: 8 });
    await assertPointerLocked(start.x + 15, fartherY);

    const backY = Math.max(8, start.y - 30);
    await page.mouse.move(start.x - 12, backY, { steps: 12 });
    await expect.poll(() => page.locator('[data-category-reorder-id="home"]')
      .evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect.poll(() => page.locator('[data-category-reorder-id]').evaluateAll(
      rows => rows.map(row => row.getAttribute('data-category-reorder-id')).join(',')))
      .toBe('work,home,personal');
    await assertPointerLocked(start.x - 12, backY);
    await page.mouse.up();
    await expect(page.locator('[data-category-drag-overlay]')).toHaveCount(0);
    await expect(page.getByTestId('category-drag-active')).toHaveText('no');
  });
});

test('desktop drop saves the projected order only on release', async ({ page }) => {
  await page.goto(URL);
  const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
  const start = await center(label);
  const target = await center(page.locator('[data-category-drag-handle]').filter({ hasText: 'Home' }));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, target.y + 40, { steps: 12 });
  await expect.poll(() => page.locator('[data-category-reorder-id="home"]')
    .evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
  await expect(page.getByTestId('category-order')).toHaveText('work,home,personal');
  await page.mouse.up();
  await expect(page.getByTestId('category-order')).toHaveText('home,work,personal');
  await expect.poll(() => page.locator('[data-category-reorder-id]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-category-reorder-id')).join(',')))
    .toBe('home,work,personal');
});

test.describe('full-width category pill hit area', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1152, height: 860 } });

  test('mouse hold from the stretched blank label opens Edit and then drags; plus remains click-only', async ({ page }) => {
    await page.goto(URL);
    await page.getByTestId('toggle-full-width-category-pills').click();

    const pill = page.getByRole('button', { name: 'Add a task to Work' });
    const label = pill.locator('[data-category-drag-handle]');
    const plus = pill.locator('.mosaic-category-add-icon');
    const [pillBox, labelBox, plusBox] = await Promise.all([
      pill.boundingBox(), label.boundingBox(), plus.boundingBox(),
    ]);
    if (!pillBox || !labelBox || !plusBox) throw new Error('Missing full-width pill bounds');
    expect(labelBox.width).toBeGreaterThan(pillBox.width * 0.65);

    const startX = plusBox.x - 24;
    const startY = labelBox.y + labelBox.height / 2;
    // This point is far beyond the actual word text and not on the plus affordance.
    expect(startX).toBeGreaterThan(labelBox.x + 120);
    expect(startX).toBeLessThan(labelBox.x + labelBox.width);
    expect(await page.evaluate(({ x, y }) => {
      return Boolean(document.elementFromPoint(x, y)?.closest('[data-category-drag-handle]'));
    }, { x: startX, y: startY })).toBe(true);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(625);
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.mouse.move(startX, startY + 115, { steps: 12 });
    await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
    await expect(page.locator('[data-category-drag-overlay="work"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByTestId('category-drag-active')).toHaveText('no');

    const addBounds = await plus.boundingBox();
    if (!addBounds) throw new Error('Missing full-width plus icon bounds');
    const addX = addBounds.x + addBounds.width / 2;
    const addY = addBounds.y + addBounds.height / 2;
    await page.mouse.move(addX, addY);
    await page.mouse.down();
    await page.waitForTimeout(625);
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.mouse.move(addX, addY + 90, { steps: 9 });
    await expect(page.getByTestId('category-drag-active')).toHaveText('no');
    await expect(page.locator('[data-category-drag-overlay]')).toHaveCount(0);
    await page.mouse.up();
  });

  test('compact mode still activates drag from the text label', async ({ page }) => {
    await page.goto(URL);
    const label = page.locator('[data-category-drag-handle]').filter({ hasText: 'Work' });
    const start = await center(label);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.waitForTimeout(625);
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.mouse.move(start.x, start.y + 80, { steps: 8 });
    await expect(page.getByTestId('category-drag-active')).toHaveText('yes');
    await page.mouse.up();
  });
});

test.describe('centered full-width category text', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1152, height: 860 } });

  test('centers text across the whole pill and preserves long-press pointer-locked dragging', async ({ page }) => {
    await page.goto(URL);
    await page.getByTestId('toggle-full-width-category-pills').click();
    await page.getByTestId('toggle-full-width-category-text-alignment').click();

    const pill = page.getByRole('button', { name: 'Add a task to Work' });
    const label = pill.locator('[data-category-drag-handle]');
    await expect(pill).toBeVisible();
    const [pillRect, labelRect] = await Promise.all([pill.boundingBox(), label.boundingBox()]);
    if (!pillRect || !labelRect) throw new Error('Missing centered full-width category geometry');
    // Equal icon rails make the label hit region geometrically centered on
    // the pill rather than only the remaining space next to the plus icon.
    expect(Math.abs((labelRect.x + labelRect.width / 2) -
      (pillRect.x + pillRect.width / 2))).toBeLessThanOrEqual(2);
    expect(await label.evaluate(el => getComputedStyle(el).textAlign)).toBe('center');
    expect(await pill.evaluate(el => getComputedStyle(el).display)).toBe('grid');
    const point = { x: labelRect.x + labelRect.width * 0.82, y: labelRect.y + labelRect.height / 2 };
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(625);
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.mouse.move(point.x + 12, point.y + 100, { steps: 10 });
    await expect(page.getByTestId('category-drag-active')).toHaveText('yes');

    const preview = page.locator('[data-category-drag-overlay="work"]');
    await expect(preview).toBeVisible();
    expect(await preview.locator('button').evaluate(el => getComputedStyle(el).display)).toBe('grid');
    expect(await preview.locator('[data-category-drag-handle]').evaluate(el =>
      getComputedStyle(el).textAlign)).toBe('center');
    const movingRect = await preview.boundingBox();
    if (!movingRect) throw new Error('Missing centered category drag preview');
    const offsetY = point.y - pillRect.y;
    expect(Math.abs(movingRect.y + offsetY - (point.y + 100))).toBeLessThanOrEqual(2);
    await page.mouse.up();
    await expect(page.getByTestId('category-drag-active')).toHaveText('no');
  });

  test('alignment preference has no effect on compact pills', async ({ page }) => {
    await page.goto(URL);
    const pill = page.getByRole('button', { name: 'Add a task to Work' });
    const original = await pill.boundingBox();
    await page.getByTestId('toggle-full-width-category-text-alignment').click();
    const updated = await pill.boundingBox();
    if (!original || !updated) throw new Error('Missing compact category bounds');
    // Compact pills have no centered grid; browser-inherited text-align does
    // not establish a visual difference for a content-sized inline label.
    expect(await pill.evaluate(el => getComputedStyle(el).display)).not.toBe('grid');
    expect(Math.abs(updated.x - original.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(updated.width - original.width)).toBeLessThanOrEqual(1);
  });
});
