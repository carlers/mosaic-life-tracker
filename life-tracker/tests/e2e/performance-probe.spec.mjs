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
  const profileStart = await page.evaluate(
    () => (window.__mosaicReactProfile ?? []).length,
  );

  const startedAt = await page.evaluate(() => {
    window.__mosaicPerf = {
      frames: [],
      longTasks: [],
      longAnimationFrames: [],
      eventTimings: [],
      intersectionObserverCreations: 0,
      mutations: 0,
      layoutReads: {},
      layoutReadStacks: [],
      actionStartedAt: performance.now(),
      actionFinishedAt: null,
    };

    const recordLayoutRead = (kind) => {
      const metrics = window.__mosaicPerf;
      metrics.layoutReads[kind] = (metrics.layoutReads[kind] ?? 0) + 1;
      if (metrics.layoutReadStacks.length < 40) {
        metrics.layoutReadStacks.push({
          kind,
          stack: new Error().stack?.split('\n').slice(2, 8).join('\n') ?? '',
        });
      }
    };

    const OriginalIntersectionObserver = window.IntersectionObserver;
    if (OriginalIntersectionObserver) {
      const ProbeIntersectionObserver = function (...args) {
        window.__mosaicPerf.intersectionObserverCreations += 1;
        return new OriginalIntersectionObserver(...args);
      };
      ProbeIntersectionObserver.prototype = OriginalIntersectionObserver.prototype;
      window.IntersectionObserver = ProbeIntersectionObserver;
      window.__mosaicPerf.restoreIntersectionObserver = () => {
        window.IntersectionObserver = OriginalIntersectionObserver;
      };
    }

    const rect = Element.prototype.getBoundingClientRect;
    const rectWrapper = function (...args) {
      recordLayoutRead('getBoundingClientRect');
      return rect.apply(this, args);
    };
    Element.prototype.getBoundingClientRect = rectWrapper;

    const descriptors = [
      ['offsetParent', Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')],
      ['offsetWidth', Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')],
      ['offsetHeight', Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')],
      ['clientWidth', Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')],
      ['clientHeight', Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')],
      ['scrollWidth', Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')],
      ['scrollHeight', Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')],
    ];

    const restoredDescriptors = [];
    for (const [kind, descriptor] of descriptors) {
      if (!descriptor?.get) continue;
      const getter = descriptor.get;
      const wrapper = {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get() {
          recordLayoutRead(kind);
          return getter.call(this);
        },
        set: descriptor.set,
      };
      Object.defineProperty(
        kind === 'offsetParent' || kind === 'offsetWidth' || kind === 'offsetHeight'
          ? HTMLElement.prototype
          : Element.prototype,
        kind,
        wrapper,
      );
      restoredDescriptors.push([
        kind === 'offsetParent' || kind === 'offsetWidth' || kind === 'offsetHeight'
          ? HTMLElement.prototype
          : Element.prototype,
        kind,
        descriptor,
      ]);
    }

    window.__mosaicPerf.restoreLayoutProbe = () => {
      Element.prototype.getBoundingClientRect = rect;
      for (const [prototype, kind, descriptor] of restoredDescriptors) {
        Object.defineProperty(prototype, kind, descriptor);
      }
    };

    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__mosaicPerf.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
              containerType: entry.attribution?.[0]?.containerType ?? '',
              containerName: entry.attribution?.[0]?.containerName ?? '',
            });
          }
        });
        observer.observe({ type: 'longtask', buffered: false });
        window.__mosaicPerf.observer = observer;
      } catch {
        // Optional diagnostic.
      }

      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__mosaicPerf.longAnimationFrames.push({
              duration: entry.duration,
              startTime: entry.startTime,
              renderStart: entry.renderStart ?? null,
              styleAndLayoutStart: entry.styleAndLayoutStart ?? null,
              blockingDuration: entry.blockingDuration ?? null,
              firstUIEventTimestamp: entry.firstUIEventTimestamp ?? null,
              scripts: Array.isArray(entry.scripts)
                ? entry.scripts.map((script) => ({
                    duration: script.duration ?? null,
                    sourceURL: script.sourceURL ?? '',
                    functionName: script.functionName ?? '',
                    invoker: script.invoker ?? '',
                    invokerType: script.invokerType ?? '',
                  }))
                : [],
            });
          }
        });
        observer.observe({ type: 'long-animation-frame', buffered: false });
        window.__mosaicPerf.longAnimationFrameObserver = observer;
      } catch {
        // Optional diagnostic.
      }
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__mosaicPerf.eventTimings.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              processingStart: entry.processingStart ?? null,
              processingEnd: entry.processingEnd ?? null,
              interactionId: entry.interactionId ?? null,
            });
          }
        });
        observer.observe({ type: 'event', durationThreshold: 16, buffered: false });
        window.__mosaicPerf.eventTimingObserver = observer;
      } catch {
        // Optional diagnostic.
      }
    }

    try {
      window.__mosaicPerf.mutationObserver = new MutationObserver((records) => {
        window.__mosaicPerf.mutations += records.length;
      });
      window.__mosaicPerf.mutationObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    } catch {
      // Optional diagnostic.
    }

    const start = performance.now();
    window.__mosaicPerf.actionStartedAt = start;
    const sample = (now) => {
      if (now - start < 700) {
        window.__mosaicPerf.frames.push(now);
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
    (start) => (window.__mosaicReactProfile ?? []).slice(start),
    profileStart,
  );

  await page.waitForTimeout(750);

  return page.evaluate(({ name, startedAt, actionFinishedAt, reactProfile }) => {
    const perf = window.__mosaicPerf;
    perf.observer?.disconnect();
    perf.longAnimationFrameObserver?.disconnect();
    perf.mutationObserver?.disconnect();
    perf.eventTimingObserver?.disconnect();
    perf.restoreLayoutProbe?.();
    perf.restoreIntersectionObserver?.();

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

    const actionEventTimings = perf.eventTimings.filter(
      (entry) =>
        entry.startTime < actionFinishedAt &&
        entry.startTime + entry.duration > startedAt
    );

    const actionLongAnimationFrames = perf.longAnimationFrames.filter(
      (entry) =>
        entry.startTime < actionFinishedAt &&
        entry.startTime + entry.duration > startedAt
    );

    const loafMetrics = actionLongAnimationFrames.flatMap((entry) => {
      const scriptDuration = entry.scripts.reduce(
        (sum, script) => sum + (script.duration ?? 0),
        0
      );
      const styleAndLayoutDelay =
        entry.styleAndLayoutStart == null
          ? null
          : entry.styleAndLayoutStart - entry.startTime;
      const renderDelay =
        entry.renderStart == null
          ? null
          : entry.renderStart - entry.startTime;
      return [{
        duration: entry.duration,
        blockingDuration: entry.blockingDuration,
        styleAndLayoutDelay,
        renderDelay,
        scriptDuration,
      }];
    });

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
      actionEventTimings: actionEventTimings.map((entry) => ({
        name: entry.name,
        duration: Number(entry.duration.toFixed(2)),
        inputDelay: entry.processingStart == null
          ? null
          : Number((entry.processingStart - entry.startTime).toFixed(2)),
        processingDuration: entry.processingStart == null || entry.processingEnd == null
          ? null
          : Number((entry.processingEnd - entry.processingStart).toFixed(2)),
        interactionId: entry.interactionId,
      })),
      intersectionObserverCreations: perf.intersectionObserverCreations,
      actionLongTasks: actionLongTasks.map((entry) => ({
        duration: Number(entry.duration.toFixed(2)),
        startOffsetMs: Number((entry.startTime - startedAt).toFixed(2)),
        containerType: entry.containerType,
        containerName: entry.containerName,
      })),
      longAnimationFrameCount: perf.longAnimationFrames.length,
      actionLongAnimationFrameCount: actionLongAnimationFrames.length,
      maxLongAnimationFrameMs: actionLongAnimationFrames.length
        ? Math.max(...actionLongAnimationFrames.map((entry) => entry.duration))
        : 0,
      maxStyleAndLayoutDelayMs: loafMetrics.some((entry) => entry.styleAndLayoutDelay != null)
        ? Math.max(...loafMetrics.map((entry) => entry.styleAndLayoutDelay ?? 0))
        : 0,
      maxRenderDelayMs: loafMetrics.some((entry) => entry.renderDelay != null)
        ? Math.max(...loafMetrics.map((entry) => entry.renderDelay ?? 0))
        : 0,
      maxLoafScriptDurationMs: loafMetrics.length
        ? Math.max(...loafMetrics.map((entry) => entry.scriptDuration))
        : 0,
      actionLongAnimationFrames: actionLongAnimationFrames.map((entry, index) => ({
        duration: Number(entry.duration.toFixed(2)),
        startOffsetMs: Number((entry.startTime - startedAt).toFixed(2)),
        blockingDuration: entry.blockingDuration == null
          ? null
          : Number(entry.blockingDuration.toFixed(2)),
        styleAndLayoutDelay: loafMetrics[index].styleAndLayoutDelay == null
          ? null
          : Number(loafMetrics[index].styleAndLayoutDelay.toFixed(2)),
        renderDelay: loafMetrics[index].renderDelay == null
          ? null
          : Number(loafMetrics[index].renderDelay.toFixed(2)),
        scriptDuration: Number(loafMetrics[index].scriptDuration.toFixed(2)),
        scripts: entry.scripts,
      })),
      layoutReads: perf.layoutReads,
      layoutReadStacks: perf.layoutReadStacks,
      mutationRecords: perf.mutations,
      elementCount: document.querySelectorAll('*').length,
      swiperSlideCount: document.querySelectorAll('[data-testid="day-swiper"] .swiper-slide').length,
      renderedDaySlideCount: document.querySelectorAll('[data-testid="day-swiper"] [data-day-view-navigation="true"]').length,
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
