import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({ ignoreHTTPSErrors: true, hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

test('Nested action exit restores parent without a second late scale animation', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?nestedSheetProbe=1&nestedBlur=1`);
  await page.getByTestId('nested-parent-open').click();

  const parent = page.locator('[role="dialog"]').filter({
    has: page.getByTestId('nested-parent-content'),
  });
  const child = page.locator('[role="dialog"]').filter({
    has: page.getByTestId('nested-detail-content'),
  });
  await expect(parent).toBeVisible();
  const width = () => parent.evaluate(element => element.getBoundingClientRect().width);
  await expect.poll(width).toBeGreaterThan(410);
  const fullWidth = await width();

  // The upper sheet still gives the background visible depth while open.
  await page.getByTestId('nested-detail-open').click();
  await expect(child).toBeVisible();
  await expect.poll(width).toBeLessThan(fullWidth - 3);

  await page.getByTestId('nested-detail-close').click();
  // Closing still owns the inert stack and prevents premature interaction.
  await expect(parent).toHaveAttribute('inert');
  await expect(child).toHaveCount(0);

  // Previously the parent began its 320ms scale-back only *after* the child
  // disappeared. It must now be fully restored when the exit is finished.
  const samples = await parent.evaluate(async element => {
    const values = [];
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      values.push(element.getBoundingClientRect().width);
    }
    return values;
  });
  expect(Math.min(...samples)).toBeGreaterThan(fullWidth - 1.5);
  expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(1.25);
  await expect(parent).not.toHaveAttribute('inert');

  // Reopen and dismiss via Escape; modal ownership must not get stuck.
  await page.getByTestId('nested-detail-open').click();
  await expect(child).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(parent).not.toHaveAttribute('inert');
  await page.getByTestId('nested-parent-close').click();
  await expect(parent).toHaveCount(0);
});

test('Memo opens without remounting background Day View category and task rows', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();

  const dayView = page.locator('[role="dialog"]').filter({ has: page.getByTestId('day-swiper') });
  const slide = dayView.locator('[data-testid="day-slide"][data-date-str="2026-09-15"]').first();
  const category = slide.locator('[data-task-category-id="cat_0"]');
  const task = slide.locator('[data-task-dnd-registered="true"]').first();
  await expect(category).toBeVisible();
  await expect(task).toHaveCount(1);

  // Preserve the actual visual row elements across the background-lock
  // transition. Previously this replaced Reorder.Group with fragments,
  // and registered task-row wrappers with plain rows on every Memo open.
  await page.evaluate(() => {
    const slide = document.querySelector('[role="dialog"] [data-testid="day-swiper"] [data-testid="day-slide"][data-date-str="2026-09-15"]');
    const category = slide?.querySelector('[data-task-category-id="cat_0"]');
    const task = slide?.querySelector('[data-task-dnd-registered="true"]');
    if (!category || !task) throw new Error('Expected mounted category and task row');
    (window).__memoBackgroundRows = { category, task };
  });

  // Keyboard activation avoids the intentional touch single/double-tap
  // disambiguation delay, while invoking the real Memo callback.
  const openMemo = slide.getByRole('button', { name: 'Open memo' }).first();
  await openMemo.focus();
  await page.keyboard.press('Enter');
  const memo = page.getByRole('dialog').filter({
    has: page.getByRole('button', { name: 'Edit memo' }),
  });
  await expect(memo).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const saved = (window).__memoBackgroundRows;
    return Boolean(saved?.category?.isConnected && saved?.task?.isConnected);
  })).toBe(true);
  expect(await page.evaluate(() => {
    const saved = (window).__memoBackgroundRows;
    const slide = document.querySelector('[role="dialog"] [data-testid="day-swiper"] [data-testid="day-slide"][data-date-str="2026-09-15"]');
    return slide?.querySelector('[data-task-category-id="cat_0"]') === saved?.category &&
      slide?.querySelector('[data-task-dnd-registered="true"]') === saved?.task;
  })).toBe(true);
  await expect(category).toBeVisible();
  // Day View stays inert and inaccessible under the Memo.
  await expect(dayView).toHaveAttribute('inert');
  await page.keyboard.press('Escape');
  await expect(memo).toHaveCount(0);
  await expect(category).toBeVisible();
  expect(await page.evaluate(() => {
    const saved = (window).__memoBackgroundRows;
    return Boolean(saved?.category?.isConnected && saved?.task?.isConnected);
  })).toBe(true);
});

test('Nested Memo entrance does not move Day View task and category rows', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.getByTestId('open-day-view-sheet').click();
  const dayView = page.locator('[role="dialog"]').filter({ has: page.getByTestId('day-swiper') });
  const slide = dayView.locator('[data-testid="day-slide"][data-date-str="2026-09-15"]').first();
  const memoTrigger = slide.getByRole('button', { name: 'Open memo' }).first();
  await expect(memoTrigger).toBeVisible();
  // Wait for the original Day View entrance to settle; only nested motion
  // should be sampled, not the unrelated first-open slide animation.
  await page.waitForTimeout(450);
  await memoTrigger.focus();

  await page.evaluate(() => {
    const dayView = document.querySelector('[role="dialog"] [data-testid="day-swiper"]');
    const slide = dayView?.querySelector('[data-testid="day-slide"][data-date-str="2026-09-15"]');
    const category = slide?.querySelector('[data-task-category-id="cat_0"]');
    const task = slide?.querySelector('[data-task-dnd-registered="true"]')?.parentElement;
    if (!category || !task) throw new Error('Nested-sheet row geometry probe is missing a row');
    const rect = (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    window.__memoRowFrames = [];
    window.__memoFrameCaptureDone = false;
    let frames = 0;
    function sample() {
      window.__memoRowFrames.push({ category: rect(category), task: rect(task) });
      if (++frames < 36) requestAnimationFrame(sample);
      else window.__memoFrameCaptureDone = true;
    }
    sample();
  });

  await page.keyboard.press('Enter');
  const memo = page.getByRole('dialog').filter({
    has: page.getByRole('button', { name: 'Edit memo' }),
  });
  await expect(memo).toBeVisible();
  await expect(dayView).toHaveAttribute('inert');
  await page.waitForFunction(() => window.__memoFrameCaptureDone);
  const frames = await page.evaluate(() => window.__memoRowFrames);
  expect(frames.length).toBe(36);
  // Motion layout projection used to misinterpret the ancestor's animated
  // scale as task/category movement, causing visible jitter beneath Memo.
  // With the parent geometry fixed, both rows remain stationary.
  for (const kind of ['category', 'task']) {
    for (const axis of ['x', 'y', 'width', 'height']) {
      const values = frames.map(frame => frame[kind][axis]);
      expect(Math.max(...values) - Math.min(...values),
        `${kind} ${axis} moved during nested Memo animation`).toBeLessThan(1.5);
    }
  }
  await page.keyboard.press('Escape');
  await expect(memo).toHaveCount(0);
  await expect(dayView).not.toHaveAttribute('inert');
});

test('Diary preserves its portal through an animated close and releases on completion', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?diaryExitProbe=1`);
  const open = page.getByTestId('diary-exit-open');
  const dialog = page.locator('[role="dialog"][aria-label="Diary"], [role="dialog"][aria-labelledby]');
  const exits = page.getByTestId('diary-exit-count');

  await open.click();
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  const nestedReply = page.getByText('Reply privately about the diary from 2026-09-15.');
  await expect(nestedReply).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nestedReply).toHaveCount(0);
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await expect(exits).toHaveText('0');

  await page.getByRole('button', { name: 'Close diary' }).click();
  // Closing sheets are inert, but their portals remain until Framer exits.
  await expect(page.getByTestId('diary-entry-sheet')).toHaveCount(1);
  await expect(exits).toHaveText('1');
  await expect(page.getByTestId('diary-entry-sheet')).toHaveCount(0);

  await open.click();
  await expect(page.getByTestId('diary-entry-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(exits).toHaveText('2');
  await expect(page.getByTestId('diary-entry-sheet')).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
});
