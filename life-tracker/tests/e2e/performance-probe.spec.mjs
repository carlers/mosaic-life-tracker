import { test } from '@playwright/test';

const BASE_URL =
  process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test.use({
  ignoreHTTPSErrors: true,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 412, height: 915 },
});

async function measureInteraction(page, name, action, target = null) {
  const profileStart = await page.evaluate(
    () => (window.__mosaicReactProfile ?? []).length,
  );

  const startedAt = await page.evaluate((target) => {
    window.__mosaicPerf = {
      target: target ? { ...target, firstMatchingFrameMs: null } : null,
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
      if (window.__mosaicPerf.actionFinishedAt !== null &&
          window.__mosaicPerf.target && window.__mosaicPerf.target.firstMatchingFrameMs === null) {
        const { selector, present } = window.__mosaicPerf.target;
        if (Boolean(document.querySelector(selector)) === present) {
          // First observed animation frame, not a guaranteed browser paint.
          window.__mosaicPerf.target.firstMatchingFrameMs = now - start;
        }
      }
      if (now - start < 700) {
        window.__mosaicPerf.frames.push(now);
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
    return start;
  }, target);

  await action();

  const actionFinishedAt = await page.evaluate(() => {
    window.__mosaicPerf.actionFinishedAt = performance.now();
    return window.__mosaicPerf.actionFinishedAt;
  });

  // Include commits during the full 700 ms animation sampling window, not
  // only the synchronous input dispatch that Playwright just completed.
  await page.waitForTimeout(750);

  const reactProfile = await page.evaluate(
    (start) => (window.__mosaicReactProfile ?? []).slice(start),
    profileStart,
  );

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

    // Input-handling long frames and entrance/exit animation long frames are
    // distinct windows; an asynchronous sheet transition can outlive the action.
    const animationLongAnimationFrames = perf.longAnimationFrames.filter(
      (entry) =>
        entry.startTime < startedAt + 700 &&
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
      firstMatchingTargetFrameMs: perf.target?.firstMatchingFrameMs ?? null,
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
      animationLongAnimationFrameCount: animationLongAnimationFrames.length,
      maxAnimationLongAnimationFrameMs: animationLongAnimationFrames.length
        ? Math.max(...animationLongAnimationFrames.map((entry) => entry.duration))
        : 0,
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


test('@performance nested BottomSheet cold/warm and compositor probe', async ({ page }) => {
  // Opt-in diagnostic: alternate backdrop treatment in separate documents.
  // These are descriptive measurements, never pass/fail latency thresholds.
  for (const blur of ['0', '1']) {
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?nestedSheetProbe=1&nestedBlur=${blur}`);
    const label = blur === '1' ? 'blur' : 'plain';
    const cases = [
      ['parent-first-open', 'nested-parent-open', 'nested-parent-content', true],
      ['detail-first-open', 'nested-detail-open', 'nested-detail-content', true],
      ['detail-first-close', 'nested-detail-close', 'nested-detail-content', false],
      ['detail-warm-reopen', 'nested-detail-open', 'nested-detail-content', true],
      ['detail-warm-close', 'nested-detail-close', 'nested-detail-content', false],
      ['parent-close', 'nested-parent-close', 'nested-parent-content', false],
      ['parent-warm-reopen', 'nested-parent-open', 'nested-parent-content', true],
      ['parent-warm-close', 'nested-parent-close', 'nested-parent-content', false],
    ];
    for (const [name, control, target, present] of cases) {
      const outcome = await measureInteraction(
        page,
        `nested-${label}-${name}`,
        async () => { await page.getByTestId(control).click(); },
        { selector: `[data-testid="${target}"]`, present },
      );
      // An absent first-frame observation is useful latency evidence, not a
      // numerical failure threshold on a slow machine. Still verify the
      // requested visible state eventually settles.
      await page.waitForFunction(
        ({ selector, present }) => Boolean(document.querySelector(selector)) === present,
        { selector: `[data-testid="${target}"]`, present },
      );
      if (outcome.firstMatchingTargetFrameMs === null) {
        console.log(`MOSAIC_PERF_LATE_TARGET ${label} ${name}`);
      }
    }
  }
});

test('@performance interaction performance probe', async ({ page }) => {
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

  results.push(
    await measureInteraction(page, 'day-view-sheet-swipe', async () => {
      await swipe(page, '[role="dialog"] [data-testid="day-swiper"]', 620, 180, 520);
      await page.waitForTimeout(420);
    })
  );

  results.push(
    await measureInteraction(page, 'day-view-sheet-rapid-swipes', async () => {
      const selector = '[role="dialog"] [data-testid="day-swiper"]';
      await swipe(page, selector, 620, 180, 520);
      await swipe(page, selector, 620, 180, 520);
      await swipe(page, selector, 620, 180, 520);
      await page.waitForTimeout(420);
    })
  );

  results.push(
    await measureInteraction(page, 'bottom-sheet-close', async () => {
      // Match the documented phone dismissal path: tap the exposed backdrop strip.
      await page.mouse.click(10, 10);
    })
  );

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


async function captureStartupMarks(page, label) {
  await page.waitForFunction(
    () =>
      performance.getEntriesByName('mosaic:home:owner-data-ready').length > 0 &&
      performance.getEntriesByName('mosaic:home:local-data-ready').length > 0,
    null,
    { timeout: 15_000 }
  );

  const result = await page.evaluate((runLabel) => {
    const markNames = [
      'bootstrap:start',
      'react:mounted',
      'database:import-start',
      'database:module-ready',
      'database:create-start',
      'database:create-ready',
      'database:collections-start',
      'database:collections-ready',
      'database:ready',
      'auth:resolved',
      'app-data-shell:mounted',
      'home:mounted',
      'home:tasks-ready',
      'home:categories-ready',
      'home:settings-ready',
      'home:friends-ready',
      'home:owner-data-ready',
      'home:carousel-ready',
      'home:local-data-ready',
    ];

    const marks = Object.fromEntries(
      markNames.map((name) => {
        const entry = performance.getEntriesByName(`mosaic:${name}`, 'mark')[0];
        return [name, entry?.startTime ?? null];
      })
    );
    const start = marks['bootstrap:start'];
    const duration = (from, to) => {
      const a = marks[from];
      const b = marks[to];
      return a == null || b == null ? null : Number((b - a).toFixed(2));
    };
    const sinceStart = (name) => {
      const value = marks[name];
      return start == null || value == null
        ? null
        : Number((value - start).toFixed(2));
    };

    return {
      label: runLabel,
      sinceBootstrapMs: Object.fromEntries(
        markNames.map((name) => [name, sinceStart(name)])
      ),
      phasesMs: {
        databaseModuleImport: duration(
          'database:import-start',
          'database:module-ready'
        ),
        databaseCreate: duration(
          'database:create-start',
          'database:create-ready'
        ),
        databaseCollections: duration(
          'database:collections-start',
          'database:collections-ready'
        ),
        databaseTotal: duration('database:import-start', 'database:ready'),
        databaseReadyToHomeMount: duration('database:ready', 'home:mounted'),
        homeMountToOwnerData: duration(
          'home:mounted',
          'home:owner-data-ready'
        ),
        homeMountToAllLocalData: duration(
          'home:mounted',
          'home:local-data-ready'
        ),
        bootstrapToOwnerData: duration(
          'bootstrap:start',
          'home:owner-data-ready'
        ),
        bootstrapToAllLocalData: duration(
          'bootstrap:start',
          'home:local-data-ready'
        ),
      },
    };
  }, label);

  console.log(`MOSAIC_STARTUP ${JSON.stringify(result)}`);
  return result;
}

test('@performance cached Home startup probe', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    localStorage.setItem(
      'mosaic_last_known_user',
      JSON.stringify({
        $id: 'perf_cached_user',
        email: 'startup-perf@example.invalid',
        prefs: {},
        name: 'Startup Perf',
      })
    );
  });

  await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });
  await captureStartupMarks(page, 'cold-document');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await captureStartupMarks(page, 'warm-reload');
});

/** Simulate the real Calendar lazy-mount path, not a previously mounted closed sheet.
 * Dev-server timings are diagnostic/relative, never production-device budgets. */
test('@performance Day View genuine first-mount timeline', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy`);
  await page.waitForLoadState('domcontentloaded');

  async function measureOpen(name) {
    await page.evaluate(() => {
      const start = performance.now();
      const sample = {
        start,
        shellMs: null,
        swiperMs: null,
        firstHeaderMs: null,
        firstTaskMs: null,
        frames: [],
        longTasks: [],
        profileStart: (window.__mosaicReactProfile ?? []).length,
      };
      window.__dayViewColdProfile = sample;
      if ('PerformanceObserver' in window) {
        try {
          sample.observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              sample.longTasks.push({ start: entry.startTime - start, duration: entry.duration });
            }
          });
          sample.observer.observe({ type: 'longtask' });
        } catch { /* Browser may not support the entry type. */ }
      }
      let lastFrame = null;
      const poll = (now) => {
        if (lastFrame !== null) sample.frames.push(now - lastFrame);
        lastFrame = now;
        if (sample.shellMs === null && document.querySelector('[role="dialog"]'))
          sample.shellMs = now - start;
        if (sample.swiperMs === null && document.querySelector('[role="dialog"] [data-testid="day-swiper"]'))
          sample.swiperMs = now - start;
        if (sample.firstHeaderMs === null && document.querySelector('[role="dialog"] [data-day-view-navigation="true"]'))
          sample.firstHeaderMs = now - start;
        if (sample.firstTaskMs === null && document.querySelector('[role="dialog"] [data-testid="day-swiper"] button[aria-label="Add task"]'))
          sample.firstTaskMs = now - start;
        if (now - start < 1000) requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
    await page.getByTestId('open-day-view-sheet').click();
    await page.waitForTimeout(1120);
    const result = await page.evaluate(() => {
      const s = window.__dayViewColdProfile;
      s.observer?.disconnect();
      const frames = s.frames;
      const longTasks = s.longTasks;
      const profiles = (window.__mosaicReactProfile ?? []).slice(s.profileStart)
        .filter((record) => record.id === 'DayViewSheet');
      return {
        shellMs: s.shellMs === null ? null : Math.round(s.shellMs),
        swiperMs: s.swiperMs === null ? null : Math.round(s.swiperMs),
        firstHeaderMs: s.firstHeaderMs === null ? null : Math.round(s.firstHeaderMs),
        firstTaskMs: s.firstTaskMs === null ? null : Math.round(s.firstTaskMs),
        maxFrameMs: Math.round(Math.max(0, ...frames)),
        missedFrames: frames.filter(n => n > 25).length,
        maxLongTaskMs: Math.round(Math.max(0, ...longTasks.map(x=>x.duration))),
        longTasks: longTasks.map(x=>({start: Math.round(x.start), duration: Math.round(x.duration)})),
        profiles,
        slideCount: document.querySelectorAll('[role="dialog"] .swiper-slide').length,
      };
    });
    console.log(`MOSAIC_FIRST_MOUNT ${name} ${JSON.stringify(result)}`);
  }
  await measureOpen('first');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(520);
  await measureOpen('reopen');

  // Same 181-slide shell with empty task rows; isolate Swiper/browser layout
  // and modal initialization from task rendering.
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&emptyDayTasks=1`);
  await page.waitForLoadState('domcontentloaded');
  await measureOpen('empty-first');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(520);
  await measureOpen('empty-reopen');
});


// Measure the actual Calendar DayCell click → DayViewSheet route (not the isolated probe).
// These numbers remain diagnostic, never correctness thresholds.
test('@performance Calendar path first sheet paint', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'));
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&calendarPath=1`);
  const cell = page.getByTestId('real-calendar-cold-probe').getByRole('button', { name: /September 15, 2026/i }).first();
  await cell.waitFor({ state: 'visible' });
  await page.waitForTimeout(1600); // allow module warmup; isolate first React mount

  async function open(name) {
    const result = await page.evaluate(async () => {
      const button = [...document.querySelectorAll('[data-testid="real-calendar-cold-probe"] button')]
        .find(node => node.getAttribute('aria-label')?.includes('September 15, 2026'));
      if (!button) throw new Error('Cannot locate September 15 calendar cell');
      const start = performance.now();
      let shell = null, header = null, content = null, firstFrame = null;
      const tasks = [];
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) tasks.push({ start: entry.startTime - start, duration: entry.duration });
      });
      try { observer.observe({ type: 'longtask' }); } catch {}
      button.click();
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const now = performance.now();
        firstFrame ??= now - start;
        if (shell === null && document.querySelector('[role="dialog"]')) shell = now - start;
        if (header === null && document.querySelector('[role="dialog"] [data-day-view-navigation="true"]')) header = now - start;
        if (content === null && document.querySelector('[role="dialog"] button[aria-label="Add task"]')) content = now - start;
      }
      observer.disconnect();
      return { shellMs: shell, headerMs: header, contentMs: content, firstFrameMs: firstFrame, tasks, slideCount: document.querySelectorAll('[role="dialog"] .swiper-slide').length };
    });
    console.log(`MOSAIC_CALENDAR_FIRST_PAINT ${name} ${JSON.stringify(result)}`);
  }
  await open('first');
  await page.mouse.click(5, 5);
  await page.waitForTimeout(550);
  await open('reopen');
});


test('@performance real Day View nested Memo, Task Actions and Add Photo', async ({ page }) => {
  // Diagnostic only: exercise Day View's actual drag/layout/Swiper subtree,
  // not the lightweight 50-row synthetic BottomSheet compositor probe.
  for (const count of [50, 200]) {
    await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html?perf=heavy&perfTaskCount=${count}`);
    await page.getByTestId('open-day-view-sheet').click();
    const dayView = page.locator('[role="dialog"]').filter({ has: page.getByTestId('day-swiper') });
    const slide = dayView.locator('[data-testid="day-slide"][data-date-str="2026-09-15"]').first();
    await slide.getByRole('button', { name: 'Open memo' }).first().focus();

    const openActions = async () => {
      await slide.getByRole('button', { name: 'Task 1.1' }).first().focus();
      await page.keyboard.press('Shift+Enter');
    };
    const transitions = [
      ['memo-open', () => page.keyboard.press('Enter')],
      ['memo-close', () => page.keyboard.press('Escape')],
      ['actions-open', openActions],
      // Distinguish the standalone Task Actions exit from the Add Photo
      // handoff, which intentionally combines one sheet's exit with another's entrance.
      ['actions-close', () => page.keyboard.press('Escape')],
      ['actions-reopen', openActions],
      ['photo-open', () => page.getByRole('button', { name: 'Add Photo', exact: true }).click()],
      ['photo-close', () => page.keyboard.press('Escape')],
    ];
    for (const [name, action] of transitions) {
      const result = await measureInteraction(page, `real-day-${count}-${name}`, action);
      console.log('MOSAIC_DAY_VIEW_PERF ' + JSON.stringify({
        name: result.name,
        frameCount: result.frameCount,
        p95FrameMs: result.p95FrameMs,
        maxFrameMs: result.maxFrameMs,
        maxLongAnimationFrameMs: result.maxLongAnimationFrameMs,
        animationLongAnimationFrameCount: result.animationLongAnimationFrameCount,
        maxAnimationLongAnimationFrameMs: result.maxAnimationLongAnimationFrameMs,
        droppedFrameRatio: result.droppedFrameRatio,
        layoutReads: result.layoutReads,
        mutationRecords: result.mutationRecords,
        // Preserve commit timestamps so delayed React work can be aligned
        // with the frame and long-animation-frame sampling window.
        reactRenders: result.reactProfile.map(render => ({
          id: render.id,
          phase: render.phase,
          actualDuration: render.actualDuration,
          commitOffsetMs: typeof render.commitTime === 'number'
            ? Number((render.commitTime - result.startedAt).toFixed(2))
            : null,
        })),
      }));
    }
  }
});
