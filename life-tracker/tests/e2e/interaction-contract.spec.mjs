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

// Regression: PROJECT_REFERENCE.md §2 — primary page swipes visibly track the finger,
// Home only starts from its hamburger layer, non-Home owns the full page, and Me left-swipe opens Settings.
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
});

// Regression: PROJECT_REFERENCE.md §2 — phone-sized Me owns horizontal gestures
// throughout its content and Settings swipes right back to Me.
test('phone route deck supports lower-page Me swipe and Settings right-back', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const routeHarness = page.getByTestId('primary-route-harness');
  await routeHarness.scrollIntoViewIfNeeded();
  await page.getByTestId('set-primary-account').click();

  const lowerZone = page.getByTestId('primary-page-lower-swipe-zone');
  await lowerZone.scrollIntoViewIfNeeded();
  await drag(page, lowerZone, -220);
  await expect(page.getByTestId('primary-route')).toHaveText('settings');

  await drag(page, page.getByTestId('primary-page-lower-swipe-zone'), 220);
  await expect(page.getByTestId('primary-route')).toHaveText('account');
});

// Regression: PROJECT_REFERENCE.md §2 — Todo active month is centered/natural-height
// and selection is a numeral-only white circle.
test('todo compact calendar centers the active month and rings only the selected numeral', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const region = page.getByTestId('todo-calendar-region');
  const grid = region.getByRole('grid', { name: 'September 2026 todo calendar' });
  expect(await grid.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)'
  );
  expect(await grid.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
    '0px'
  );
  await expect(grid.getByRole('gridcell')).toHaveCount(35);

  const regionBox = await region.boundingBox();
  const gridBox = await grid.boundingBox();
  if (!regionBox || !gridBox) throw new Error('Missing Todo calendar bounds');

  const regionCenter = regionBox.x + regionBox.width / 2;
  const gridCenter = gridBox.x + gridBox.width / 2;
  expect(Math.abs(regionCenter - gridCenter)).toBeLessThanOrEqual(1);

  const selectedCell = grid.getByRole('gridcell', {
    name: 'Tuesday, September 15, 2026, 0 tasks',
  });
  const selectedNumber = selectedCell.getByTestId(
    'todo-day-number-2026-09-15'
  );
  expect(
    await selectedCell.evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe('rgba(0, 0, 0, 0)');
  expect(
    await selectedNumber.evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe('rgb(255, 255, 255)');
});

// Regression: PROJECT_REFERENCE.md §2 — Light and Black change the actual rendered palette
// while semantic colored controls retain their contrast treatment.
test('appearance modes update computed app surfaces without changing semantic fills', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  await page.getByTestId('set-appearance-light').click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.theme)
    )
    .toBe('light');

  const sample = page.getByTestId('appearance-sample');
  const surface = page.getByTestId('appearance-surface-sample');
  const semantic = page.getByTestId('appearance-semantic-sample');
  expect(
    await sample.evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe('rgb(247, 247, 248)');
  expect(
    await sample.evaluate((element) => getComputedStyle(element).color)
  ).toBe('rgb(17, 24, 39)');
  expect(
    await surface.evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe('rgb(255, 255, 255)');
  expect(
    await semantic.evaluate((element) => getComputedStyle(element).color)
  ).toBe('rgb(255, 255, 255)');

  await page.getByTestId('set-appearance-black').click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.theme)
    )
    .toBe('black');
  expect(
    await sample.evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe('rgb(0, 0, 0)');
  expect(
    await surface.evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe('rgb(9, 9, 9)');
});

test('calendar swipe moves the calendar without advancing the friend carousel', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const friendIndex = page.getByTestId('friend-index');
  const calendarTitle = page.getByTestId('calendar-title');
  const calendarRegion = page.getByTestId('calendar-region');

  // PROJECT_REFERENCE.md §16 / calendar accessibility: cold mount stays at
  // three grids (unit-covered), while the active calendar may idle-prewarm to
  // five so rapid repeat swipes have real neighboring content ready.
  expect(await calendarRegion.getByRole('grid').count()).toBeLessThanOrEqual(5);
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
});

// Regression: PROJECT_REFERENCE.md §16 — rapid Calendar selections must never outrun mounted grids.
test('rapid calendar swipes keep every newly selected month mounted', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const calendarTitle = page.getByTestId('calendar-title');
  const calendarRegion = page.getByTestId('calendar-region');

  for (let swipe = 0; swipe < 3; swipe += 1) {
    const before = await calendarTitle.textContent();
    await drag(page, calendarRegion, -260);
    await expect.poll(async () => calendarTitle.textContent()).not.toBe(before);

    const selectedTitle = (await calendarTitle.textContent())?.trim();
    expect(selectedTitle).toBeTruthy();
    await expect(
      calendarRegion.getByRole('grid', { name: `${selectedTitle} calendar` })
    ).toBeVisible();
  }
});

test('swiping outside the calendar still advances the friend carousel', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  await drag(page, page.getByTestId('friend-swipe-zone'), -260);

  await expect(page.getByTestId('friend-index')).toHaveText('1');
});

// Regression: PROJECT_REFERENCE.md §2 — Todo calendar is direct-manipulation, tappable, and owns its gesture.
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

// Regression: PROJECT_REFERENCE.md §21 — a Send tap must not blur the active textarea.
test('message send keeps composer focus without an intermediate blur', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);

  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill('keep keyboard open');
  await composer.focus();
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(composer).toBeFocused();
  await expect(page.getByTestId('composer-blur-count')).toHaveText('0');
});

// Regression: PROJECT_REFERENCE.md §2 — Home task search stays mounted beneath
// Day View so native Back restores the exact query/filter state. The existing
// Day View browser contract below separately verifies downward drag-to-close.
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

// Regression: PROJECT_REFERENCE.md §2 — real DaySlide exposes memo text and owner multi-tap shortcuts.
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

// Regression: PROJECT_REFERENCE.md §2 — Day View can close fully and reopen
// without invoking the destroyed Swiper from the previous sheet lifecycle.
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
});

// Regression: PROJECT_REFERENCE.md §2 — the shared Day View date row is direct-manipulation horizontally while remaining a vertical close handle.
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

// Regression: PROJECT_REFERENCE.md §2 — blank lower Day View sheet space remains part of the native horizontal day surface.
test('blank lower sheet area swipes to the adjacent day', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('open-full-sheet').click();

  const dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  await waitForStableVerticalPosition(dialog);
  await drag(page, page.getByTestId('sheet-blank-swipe-zone-1'), -220);

  await expect(page.getByTestId('sheet-day-index')).toHaveText('1');
});

// Regression: PROJECT_REFERENCE.md §2 — phones expose backdrop dismissal; tablet full sheets use full height.
test('full sheet leaves a phone backdrop, closes from it, and fills tablet height', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.getByTestId('open-full-sheet').click();

  let dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  let box = await dialog.boundingBox();
  if (!box) throw new Error('Missing phone sheet bounds');
  expect(box.height).toBeGreaterThan(830);
  expect(box.height).toBeLessThan(850);
  expect(box.y).toBeGreaterThan(50);

  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId('open-full-sheet').click();
  dialog = page.getByRole('dialog', { name: 'Responsive test sheet' });
  box = await dialog.boundingBox();
  if (!box) throw new Error('Missing tablet sheet bounds');
  expect(box.height).toBeGreaterThanOrEqual(767);
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

// Regression: PROJECT_REFERENCE.md §2 — Todo owns one vertical page scroll.
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

// Regression: PROJECT_REFERENCE.md §2 — full compact month remains visible above task content.
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
