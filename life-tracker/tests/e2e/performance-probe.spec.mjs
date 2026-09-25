import { test } from '@playwright/test';

// This probe intentionally reports measurements instead of asserting a performance budget.\n// Thresholds should be added only after CI baselines are stable across runners.\nconst BASE_URL =
  process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

async function measureInteraction(page, name, action) {
  await page.evaluate(() => {
    window.__mosaicPerf = {
      frames: [],
      longTasks: [],
    };

    const perf = window.__mosaicPerf;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            perf.longTasks.push(entry.duration);
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
        perf.observer = observer;
      } catch {
        // Long-task entries are optional; frame timing remains useful.
      }
    }
  });

  const startedAt = await page.evaluate(() => performance.now());
  await page.evaluate(() => {
    const perf = window.__mosaicPerf;
    const start = performance.now();
    const sample = (now) => {
      perf.frames.push(now - start);
      if (now - start < 1200) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });

  await action();

  await page.waitForTimeout(1200);

  return page.evaluate(({ name, startedAt }) => {
    const perf = window.__mosaicPerf;
    perf.observer?.disconnect();

    const deltas = [];
    for (let i = 1; i < perf.frames.length; i += 1) {
      deltas.push(perf.frames[i] - perf.frames[i - 1]);
    }

    const sorted = [...deltas].sort((a, b) => a - b);
    const percentile = (p) => {
      if (!sorted.length) return null;
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    };

    const result = {
      name,
      startedAt,
      frameCount: deltas.length,
      avgFrameMs: deltas.length
        ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
        : null,
      p95FrameMs: percentile(0.95),
      droppedFrameRatio: deltas.length
        ? deltas.filter((value) => value > 20).length / deltas.length
        : null,
      longTaskCount: perf.longTasks.length,
      maxLongTaskMs: perf.longTasks.length
        ? Math.max(...perf.longTasks)
        : 0,
    };

    console.log(`MOSAIC_PERF ${JSON.stringify(result)}`);
    return result;
  }, { name, startedAt });
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
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  await page.waitForLoadState('networkidle');

  await measureInteraction(page, 'bottom-sheet-open', async () => {
    await page.getByTestId('open-full-sheet').click();
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  await measureInteraction(page, 'calendar-month-swipe', async () => {
    await swipe(page, '[data-testid="calendar-region"]');
  });

  await measureInteraction(page, 'day-content-render', async () => {
    await page.locator('[data-testid="todo-day-content"]').scrollIntoViewIfNeeded();
  });
});
