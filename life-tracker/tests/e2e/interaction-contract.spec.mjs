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

async function startTaskLongPress(page, locator, holdMs = 550) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing task long-press target bounds');
  const session = await page.context().newCDPSession(page);
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;

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
      for (let step = 1; step <= 5; step += 1) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{
            x: startX + ((x - startX) * step) / 5,
            y: startY + ((y - startY) * step) / 5,
          }],
        });
      }
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

  await gesture.finish();

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
  const headerBox = await emptyHeader.boundingBox();
  if (!headerBox) throw new Error('Missing empty-category bounds');

  const gesture = await startTaskLongPress(page, title);
  await gesture.moveTo(
    headerBox.x + headerBox.width * 0.5,
    headerBox.y + headerBox.height * 0.5
  );
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
