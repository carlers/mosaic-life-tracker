import { test } from '@playwright/test';

const BASE_URL =
  process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({
  ignoreHTTPSErrors: true,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 412, height: 915 },
});

async function measureInteraction(page, name, action) {
  const startedAt = await page.evaluate(() => {
    window.__mosaicPerf = {
      frames: [],
      longTasks: [],
      mutations: 0,
      actionStartedAt: performance.now(),
      actionFinishedAt: null,
    };

    const perf = window.__mosaicPerf;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            perf.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
              containerType: entry.attribution?.[0]?.containerType ?? '',
              containerName: entry.attribution?.[0]?.containerName ?? '',
            });
          }
        });
        observer.observe({ type: 'longtask', buffered: false });
        perf.observer = observer;
      } catch {
        // Long-task entries are optional; frame timing remains useful.
      }
    }

    try {
      perf.mutationObserver = new MutationObserver((records) => {
        perf.mutations += records.length;
      });
      perf.mutationObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    } catch {
      // Mutation timing is diagnostic only.
    }

    const start = performance.now();
    perf.actionStartedAt = start;
    const sample = (now) => {
      if (now - start < 700) {
        perf.frames.push(now);
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
    return start;
  });

  await action();

  const actionFinishedAt = await page.evaluate(() => {
    window.__mosaicPerf.actionFinishedAt = performance.now();
    return window.__mosaicPerf.actionFinishedAt;
  });

  const reactProfile = await page.evaluate(
    () => (window.__mosaicReactProfile ?? []).slice(),
  );

  await page.waitForTimeout(750);

  return page.evaluate(({ name, startedAt, actionFinishedAt, reactProfile }) => {
    const perf = window.__mosaicPerf;
    perf.observer?.disconnect();
    perf.mutationObserver?.disconnect();

    const deltas = [];
    for (let i = 1; i < perf.frames.length; i += 1) {
      deltas.push(perf.frames[i] - perf.frames[i - 1]);
    }

    const sorted = [...deltas].sort((a, b) => a - b);
    const percentile = (p) => {
      if (!sorted.length) return null;
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    };

    const actionLongTasks = perf.longTasks.filter(
      (entry) =>
        entry.startTime < actionFinishedAt &&
        entry.startTime + entry.duration > startedAt
    );

    const result = {
      name,
      startedAt,
      actionDurationMs: actionFinishedAt - startedAt,
      frameCount: deltas.length,
      avgFrameMs: deltas.length
        ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
        : null,
      p95FrameMs: percentile(0.95),
      maxFrameMs: deltas.length ? Math.max(...deltas) : null,
      droppedFrameRatio: deltas.length
        ? deltas.filter((value) => value > 20).length / deltas.length
        : null,
      longTaskCount: perf.longTasks.length,
      actionLongTaskCount: actionLongTasks.length,
      maxLongTaskMs: perf.longTasks.length
        ? Math.max(...perf.longTasks.map((entry) => entry.duration))
        : 0,
      actionMaxLongTaskMs: actionLongTasks.length
        ? Math.max(...actionLongTasks.map((entry) => entry.duration))
        : 0,
      actionLongTasks: actionLongTasks.map((entry) => ({
        duration: Number(entry.duration.toFixed(2)),
        startOffsetMs: Number((entry.startTime - startedAt).toFixed(2)),
        containerType: entry.containerType,
        containerName: entry.containerName,
      })),
      mutationRecords: perf.mutations,
      elementCount: document.querySelectorAll('*').length,
      reactProfile,
    };

    console.log(`MOSAIC_PERF ${JSON.stringify(result)}`);
    return result;
  }, { name, startedAt, actionFinishedAt, reactProfile });
}

async function swipe(page, selector, fromX = 620, toX = 180, y = 420) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing swipe target: ${selector}`);

  const startX = box.x + Math.min(box.width - 20, Math.max(20, fromX - 100));
  const endX = box.x + Math.min(box.width - 20, Math.max(20, toX - 100));
  const startY = box.y + Math.min(box.height - 20, Math.max(20, y - 300));

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, startY, { steps: 20 });
  await page.mouse.up();
}

test('interaction performance probe', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.waitForLoadState('domcontentloaded');

  const probeError = page.getByTestId('day-view-probe-error');
  if (await probeError.count()) {
    throw new Error(`DayView probe render failed: ${await probeError.textContent()}`);
  }

  const results = [];

  results.push(
    await measureInteraction(page, 'bottom-sheet-open', async () => {
      await page.getByTestId('open-day-view-sheet').click();
    })
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  results.push(
    await measureInteraction(page, 'calendar-month-swipe', async () => {
      await swipe(page, '[data-testid="calendar-region"]');
    })
  );

  results.push(
    await measureInteraction(page, 'day-swipe', async () => {
      await swipe(page, '[data-testid="todo-region"]', 140, 40, 450);
    })
  );

  results.push(
    await measureInteraction(page, 'day-content-scroll', async () => {
      await page.locator('[data-testid="todo-day-content"]').scrollIntoViewIfNeeded();
    })
  );

  for (const result of results) {
    console.log(`MOSAIC_PERF ${JSON.stringify(result)}`);
  }
});
