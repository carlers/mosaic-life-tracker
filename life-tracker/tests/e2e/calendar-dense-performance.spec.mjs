import { test, expect } from '@playwright/test';

// Synthetic cached tasks/images only; an isolated browser context and no live
// Appwrite records. Browser source and frame outcomes are not real-device FPS.
const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

async function seedPhotos(page) {
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mosaic_image_cache', 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('blobs')) database.createObjectStore('blobs');
        if (!database.objectStoreNames.contains('metadata')) database.createObjectStore('metadata');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 768;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Synthetic canvas is unavailable');
    const blobs = [];
    for (let i = 0; i < 12; i++) {
      const imageData = ctx.createImageData(768, 768);
      let state = 0x391724 + i * 73;
      for (let j = 0; j < imageData.data.length; j += 4) {
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        imageData.data[j] = (state >>> 12) & 255;
        imageData.data[j + 1] = (state >>> 3) & 255;
        imageData.data[j + 2] = (state >>> 20) & 255;
        imageData.data[j + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Synthetic image encoding failed');
      blobs.push(blob);
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['blobs', 'metadata'], 'readwrite');
      for (let i = 0; i < blobs.length; i++) {
        const key = `perf_photo_${i}`;
        tx.objectStore('blobs').put(blobs[i], key);
        tx.objectStore('metadata').put({ fileId: key, size: blobs[i].size, lastAccessedAt: Date.now() }, key);
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
}

async function capture(page, pointerType, label, minimumTasks = 120) {
  const locator = page.locator('[data-calendar-slide-index="30"] [role="grid"]').first();
  await expect(locator).toBeVisible();
  const initialCount = await page.locator('[title^="Calendar month"]').count();
  if (initialCount < minimumTasks) throw new Error(`Dense fixture is not mounted: ${initialCount} tasks`);
  const before = await page.evaluate(() => {
    const container = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
    return {
      active: container?.querySelector('[role="region"]')?.getAttribute('data-calendar-slide-index') ?? null,
      cells: container?.querySelectorAll('[role="gridcell"]').length ?? 0,
      images: container?.querySelectorAll('img').length ?? 0,
      tasks: container?.querySelectorAll('[title^="Calendar month"]').length ?? 0,
      dom: document.querySelectorAll('*').length,
    };
  });
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Dense calendar box is missing');
  const fromX = rect.x + rect.width * 0.78;
  const toX = rect.x + rect.width * 0.18;
  const y = rect.y + Math.min(135, rect.height * 0.35);
  await page.evaluate(() => {
    const trace = { frames: [], loaf: [], longTasks: [], mutations: 0, endAt: null };
    window.__denseCalendarTrace = trace;
    const observer = new MutationObserver(entries => { trace.mutations += entries.length; });
    observer.observe(document.querySelector('[data-route-swipe-horizontal-owner="true"]'), { childList: true, subtree: true });
    trace.observer = observer;
    if ('PerformanceObserver' in window) {
      for (const [kind, property] of [['long-animation-frame', 'loaf'], ['longtask', 'longTasks']]) {
        try {
          const watcher = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) trace[property].push({
              start: entry.startTime, duration: entry.duration,
              renderStart: entry.renderStart ?? null,
              styleStart: entry.styleAndLayoutStart ?? null,
              scriptCount: entry.scripts?.length ?? 0,
            });
          });
          watcher.observe({ type: kind });
          (trace.watchers ??= []).push(watcher);
        } catch { /* unsupported browser entry type */ }
      }
    }
    let previous = null;
    const sample = now => {
      if (previous !== null) trace.frames.push({ now, ms: now - previous });
      previous = now;
      if (trace.endAt === null || now < trace.endAt) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const startedAt = await page.evaluate(() => performance.now());
  if (pointerType === 'touch') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y, id: 1 }] });
    for (let i = 1; i <= 24; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: fromX + (toX - fromX) * i / 24, y, id: 1 }],
      });
      await page.waitForTimeout(10);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) {
      await page.mouse.move(fromX + (toX - fromX) * i / 24, y);
      await page.waitForTimeout(10);
    }
    await page.mouse.up();
  }
  const releasedAt = await page.evaluate(() => performance.now());
  await page.evaluate(() => { window.__denseCalendarTrace.endAt = performance.now() + 550; });
  await page.waitForTimeout(800);
  const result = await page.evaluate(({ startedAt, releasedAt }) => {
    const trace = window.__denseCalendarTrace;
    trace.observer.disconnect();
    trace.watchers?.forEach(item => item.disconnect());
    const times = trace.frames.filter(x => x.now >= startedAt && x.now < trace.endAt).map(x => x.ms);
    const sorted = [...times].sort((a, b) => a - b);
    const q = fraction => sorted.length ? Number(sorted[Math.floor((sorted.length - 1) * fraction)].toFixed(2)) : null;
    const held = trace.frames.filter(x => x.now >= startedAt && x.now <= releasedAt).map(x => x.ms);
    const released = trace.frames.filter(x => x.now > releasedAt && x.now < trace.endAt).map(x => x.ms);
    const container = document.querySelector('[data-route-swipe-horizontal-owner="true"]');
    const longAnimation = trace.loaf.filter(x => x.start >= startedAt && x.start < trace.endAt);
    const longTasks = trace.longTasks.filter(x => x.start >= startedAt && x.start < trace.endAt);
    return {
      frameCount: sorted.length,
      p50FrameMs: q(0.5), p95FrameMs: q(0.95),
      maxFrameMs: q(1),
      heldMaxFrameMs: Number(Math.max(0, ...held).toFixed(2)),
      releasedMaxFrameMs: Number(Math.max(0, ...released).toFixed(2)),
      heldOver25ms: held.filter(x => x > 25).length,
      releasedOver25ms: released.filter(x => x > 25).length,
      over25ms: sorted.filter(x => x > 25).length,
      over50ms: sorted.filter(x => x > 50).length,
      longAnimation: longAnimation.length,
      longTaskCount: longTasks.length,
      longestLoafMs: Math.max(0, ...longAnimation.map(x => x.duration)),
      longestTaskMs: Math.max(0, ...longTasks.map(x => x.duration)),
      mutations: trace.mutations,
      after: {
        active: container?.querySelector('[role="region"]')?.getAttribute('data-calendar-slide-index') ?? null,
        cells: container?.querySelectorAll('[role="gridcell"]').length ?? 0,
        images: container?.querySelectorAll('img').length ?? 0,
        tasks: container?.querySelectorAll('[title^="Calendar month"]').length ?? 0,
        dom: document.querySelectorAll('*').length,
      },
    };
  }, { startedAt, releasedAt });
  if (result.frameCount < 8) throw new Error('Incomplete animation frame capture');
  console.log('MOSAIC_DENSE_FRAME ' + JSON.stringify({ label, pointerType, before, ...result }));
  await expect(page.locator('[data-calendar-slide-index="31"] [role="grid"]').first()).toBeVisible();
  if (result.after.tasks < minimumTasks) throw new Error('Destination month lost populated content');
}

for (const fixture of [
  { label: 'phone-mouse-empty', width: 412, height: 915, mobile: true, touch: true, photos: false, pointer: 'mouse', warm: false, count: 0 },
  { label: 'phone-mouse-text', width: 412, height: 915, mobile: true, touch: true, photos: false, pointer: 'mouse', warm: false },
  { label: 'phone-mouse-photos-cold', width: 412, height: 915, mobile: true, touch: true, photos: true, pointer: 'mouse', warm: false },
  { label: 'phone-touch-photos-warm', width: 412, height: 915, mobile: true, touch: true, photos: true, pointer: 'touch', warm: true },
  { label: 'desktop-mouse-photos-warm', width: 1152, height: 810, mobile: false, touch: false, photos: true, pointer: 'mouse', warm: true },
]) {
  test('@performance dense Calendar ' + fixture.label, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: fixture.width, height: fixture.height },
      isMobile: fixture.mobile, hasTouch: fixture.touch,
      deviceScaleFactor: 1, ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    try {
      const path = `${BASE}/tests/e2e/calendar-home-scroll.html?scenario=dense-performance&photos=${fixture.photos ? 1 : 0}&count=${fixture.count ?? 126}`;
      await page.goto(path);
      await expect(page.locator('[data-calendar-slide-index="30"] [role="grid"]').first()).toBeVisible();
      if (fixture.photos) {
        await seedPhotos(page);
        await page.reload();
        await expect(page.locator('[data-calendar-slide-index="30"] [role="grid"]').first()).toBeVisible();
        if (fixture.warm) {
          await page.waitForFunction(() => document.querySelectorAll('[data-calendar-slide-index="30"] img').length > 10 &&
            [...document.querySelectorAll('[data-calendar-slide-index="30"] img')].every(img => img.complete), null, { timeout: 20000 });
        }
      }
      await capture(page, fixture.pointer, fixture.label, fixture.count === 0 ? 0 : 120);
    } finally {
      await context.close();
    }
  });
}
