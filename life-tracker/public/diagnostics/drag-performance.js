/* Mosaic #2298 opt-in, read-only drag boundary/frame probe.
 * No task/diary text, account IDs, element IDs, or network reporting. */
(() => {
  'use strict';
  if (document.querySelector('[data-mosaic-drag-probe]')) return;
  const round = n => Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  const MAX_MS = 45000;
  const MAX_SAMPLES = 7200;
  const MAX_BOUNDARIES = 140;
  const panel = document.createElement('section');
  panel.dataset.mosaicDragProbe = 'true';
  panel.setAttribute('aria-label', 'Mosaic drag performance diagnostic');
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:8px;left:8px;' +
    'bottom:calc(4.5rem + env(safe-area-inset-bottom));max-width:420px;margin-left:auto;' +
    'padding:8px;border:1px solid #8cb5fa;border-radius:10px;background:#16243bf5;' +
    'color:#fff;box-shadow:0 3px 15px #0009;font:12px/1.4 system-ui,sans-serif';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin-top:5px;line-height:1.35';
  status.textContent = 'Open Day View, then Start → reorder → Stop → Copy JSON.';
  const makeButton = label => {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.style.cssText = 'color:white;background:#335b98;border:1px solid #8cb5fa;' +
      'border-radius:6px;padding:7px 9px;min-height:32px;font:inherit';
    row.append(node);
    return node;
  };
  const startButton = makeButton('Start drag test');
  const stopButton = makeButton('Stop');
  const copyButton = makeButton('Copy JSON');
  const shrinkButton = makeButton('Minimize');
  panel.append(row, status);
  const note = document.createElement('div');
  note.textContent = 'Local only • no personal content or network uploads';
  note.style.cssText = 'opacity:.75;margin-top:3px;font-size:10px';
  panel.append(note);
  let state = null, savedReport = null, raf = 0, lastFrameAt = null;
  let rootObserver = null, perfObservers = [];
  let active = null, lastBoundaryAt = 0;
  const point = event => ({
    x: Number.isFinite(event.clientX) ? event.clientX : 0,
    y: Number.isFinite(event.clientY) ? event.clientY : 0
  });
  const classify = target => {
    const el = target instanceof Element ? target : null;
    if (!el || !el.closest('[data-testid="day-slide"]')) return null;
    if (el.closest('[data-diary-note-row]')) return 'note';
    if (el.closest('[data-diary-drag-source], [data-diary-drag-group]')) return 'group';
    if (el.closest('[data-category-drag-handle], .mosaic-category-pill')) return 'category';
    if (el.closest('[data-panel-reorder-row], [data-task-dnd-registered]')) return 'task';
    return null;
  };
  const percentile = (values, p) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return round(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]);
  };
  const describe = values => ({
    samples: values.length,
    p50Ms: percentile(values, .5), p95Ms: percentile(values, .95),
    p99Ms: percentile(values, .99),
    maxMs: values.length ? round(Math.max(...values)) : null,
    over20Ms: values.filter(v => v > 20).length,
    over33Ms: values.filter(v => v > 33).length,
    over50Ms: values.filter(v => v > 50).length
  });
  const snapshot = () => {
    const root = findRoot();
    let build = null;
    try {
      const raw = document.querySelector('meta[name="mosaic-build-info"]')?.content;
      const info = raw ? JSON.parse(raw) : null;
      if (info) build = { commit: String(info.commit || '').slice(0, 40),
        branch: String(info.branch || '').slice(0, 100) };
    } catch { /* build meta optional */ }
    return {
      build,
      screen: root ? 'day-view' : 'no-day-view',
      viewport: { width: innerWidth, height: innerHeight, dpr: round(devicePixelRatio) },
      standalone: matchMedia('(display-mode: standalone)').matches,
      browserHint: navigator.brave ? 'Brave' : 'unspecified',
      platformHint: /Android/.test(navigator.userAgent) ? 'Android'
        : /iPhone|iPad/.test(navigator.userAgent) ? 'iOS'
        : /Windows/.test(navigator.userAgent) ? 'Windows'
        : /Macintosh/.test(navigator.userAgent) ? 'macOS'
        : /Linux/.test(navigator.userAgent) ? 'Linux' : 'unknown',
      rendered: root ? {
        categoryHeaders: root.querySelectorAll('[data-category-reorder-id]').length,
        taskRows: root.querySelectorAll('[data-diary-note-task-id]').length,
        noteRows: root.querySelectorAll('[data-diary-note-row]').length,
        diaryGroups: root.querySelectorAll('[data-diary-drag-group]').length
      } : null
    };
  };
  function findRoot() {
    const list = document.querySelectorAll('[data-testid="day-slide"]');
    for (const el of list) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20 &&
          rect.bottom > 0 && rect.top < innerHeight) return el;
    }
    return list[0] || null;
  }
  const offset = t => round(t - state.started);
  function onDown(event) {
    if (!state || !event.isPrimary || panel.contains(event.target)) return;
    const kind = classify(event.target);
    if (!kind) return;
    const pos = point(event);
    active = { id: event.pointerId, kind, began: performance.now(),
      last: pos, first: pos, traveled: 0, moves: 0,
      boundaryEvents: 0, estimatedDrag: false, moved: false };
    state.pointers[kind]++;
  }
  function onMove(event) {
    if (!state || !active || event.pointerId !== active.id) return;
    const pos = point(event);
    const distance = Math.hypot(pos.x - active.last.x, pos.y - active.last.y);
    active.traveled += distance;
    active.last = pos;
    active.moves++;
    active.moved = active.moved || active.traveled > 12;
    state.pointerMoves++;
    const timestamp = performance.now();
    // PointerEvent timestamps use the same monotonic time origin in modern
    // browsers. Accept only a plausible delay; never persist coordinates.
    const lag = timestamp - event.timeStamp;
    if (lag >= 0 && lag < 500 && state.inputLag.length < MAX_SAMPLES)
      state.inputLag.push(lag);
  }
  function onEnd(event) {
    if (!state || !active || event.pointerId !== active.id) return;
    state.gestures.push({
      kind: active.kind, durationMs: round(performance.now() - active.began),
      moves: active.moves, travelPx: round(active.traveled),
      boundaryEvents: active.boundaryEvents,
      likelyDrag: active.moved && (active.estimatedDrag || active.boundaryEvents > 0),
      canceled: event.type === 'pointercancel'
    });
    active = null;
  }
  function onMutation(entries) {
    if (!state || !active?.moved) return;
    const count = entries.filter(e => e.type === 'childList' &&
      (e.addedNodes.length || e.removedNodes.length)).length;
    if (!count) return;
    const at = performance.now();
    state.mutations += count;
    active.estimatedDrag = true;
    if (at - lastBoundaryAt < 38 && state.boundaries.length) {
      state.boundaries[state.boundaries.length - 1].mutationRecords += count;
      return;
    }
    lastBoundaryAt = at;
    active.boundaryEvents++;
    if (state.boundaries.length < MAX_BOUNDARIES) state.boundaries.push({
      tMs: offset(at), kind: active.kind, mutationRecords: count
    });
    state.lastBoundaryAt = at;
  }
  function observePerformance(type, consume) {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return false;
      const obs = new PerformanceObserver(entries => {
        if (!state) return;
        for (const entry of entries.getEntries()) consume(entry);
      });
      obs.observe({ type, buffered: false });
      perfObservers.push(obs);
      return true;
    } catch { return false; }
  }
  function sampleFrame(now) {
    if (!state) { raf = 0; return; }
    if (lastFrameAt !== null) {
      const delta = now - lastFrameAt;
      if (delta > 0 && delta < 250 && state.frames.length < MAX_SAMPLES) {
        state.frames.push(delta);
        const nearBoundary = now - state.lastBoundaryAt < 120 && now - state.lastBoundaryAt >= 0;
        if (nearBoundary) state.boundaryFrames.push(delta);
        else state.steadyFrames.push(delta);
        if (delta > 33 && state.slowFrames.length < 90)
          state.slowFrames.push({ tMs: offset(now), frameMs: round(delta),
            nearBoundary, kind: active?.kind || null });
      } else if (delta >= 250) state.suspendedFrames++;
    }
    lastFrameAt = now;
    if (performance.now() - state.started >= MAX_MS) {
      stop('45-second limit reached');
      return;
    }
    raf = requestAnimationFrame(sampleFrame);
  }
  function start() {
    stop('reset');
    const root = findRoot();
    if (!root) {
      status.textContent = 'Open the actual Todo Day View before starting.';
      return;
    }
    savedReport = null;
    lastFrameAt = null;
    lastBoundaryAt = -Infinity;
    state = {
      started: performance.now(), before: snapshot(),
      frames: [], steadyFrames: [], boundaryFrames: [], slowFrames: [],
      boundaries: [], lastBoundaryAt: -Infinity, suspendedFrames: 0,
      gestures: [], pointers: { category: 0, task: 0, note: 0, group: 0 },
      pointerMoves: 0, inputLag: [], mutations: 0,
      longTasks: [], longAnimationFrames: [], support: {}
    };
    rootObserver = new MutationObserver(onMutation);
    rootObserver.observe(root, { childList: true, subtree: true });
    state.support.longTasks = observePerformance('longtask', entry => {
      if (state.longTasks.length < 70) state.longTasks.push({
        tMs: offset(entry.startTime), durationMs: round(entry.duration)
      });
    });
    state.support.longAnimationFrames = observePerformance('long-animation-frame', entry => {
      if (state.longAnimationFrames.length >= 70) return;
      const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
      const jsMs = scripts.reduce((sum, script) => sum + (script.duration || 0), 0);
      const layoutStart = Number.isFinite(entry.styleAndLayoutStart)
        ? entry.styleAndLayoutStart : null;
      state.longAnimationFrames.push({
        tMs: offset(entry.startTime), durationMs: round(entry.duration),
        blockingMs: round(entry.blockingDuration || 0), attributedJsMs: round(jsMs),
        styleLayoutTailMs: layoutStart == null ? null
          : round(Math.max(0, entry.startTime + entry.duration - layoutStart))
      });
    });
    raf = requestAnimationFrame(sampleFrame);
    status.textContent = 'Recording. Reorder category pills, tasks, notes and Diary group.';
    startButton.textContent = 'Restart';
  }
  function stop(reason = 'stopped') {
    if (!state) return;
    if (active) onEnd({ pointerId: active.id, type: 'stopped' });
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    rootObserver?.disconnect();
    rootObserver = null;
    perfObservers.forEach(observer => observer.disconnect());
    perfObservers = [];
    const data = state;
    const after = snapshot();
    state = null;
    savedReport = {
      kind: 'Mosaic #2298 opt-in drag frame/boundary report',
      schema: 1, privacy: 'No content, accounts, identifiers, coordinates or network uploads',
      collectionMs: round(performance.now() - data.started),
      before: data.before, after,
      support: data.support,
      gestures: data.gestures,
      pointerStartsByKind: data.pointers,
      pointerMoves: data.pointerMoves,
      inputDispatchDelay: describe(data.inputLag),
      frameIntervals: describe(data.frames),
      nearStructuralBoundaryFrames: describe(data.boundaryFrames),
      otherFrames: describe(data.steadyFrames),
      longTasks: data.longTasks,
      longAnimationFrames: data.longAnimationFrames,
      structuralMutationRecords: data.mutations,
      detectedStructuralBoundaries: data.boundaries,
      slowFrames: data.slowFrames,
      suspendedFrames: data.suspendedFrames,
      caveat: 'DOM structural mutations approximate boundaries. Instrumentation adds overhead; LoAF attribution is browser-dependent. This is not a full Chrome trace.'
    };
    status.textContent = 'Stopped (' + reason + '). ' +
      data.gestures.filter(g => g.likelyDrag).length + ' drags, ' +
      data.boundaries.length + ' structural changes. Tap Copy JSON.';
  }
  async function copy() {
    if (state) stop('copy');
    if (!savedReport) {
      status.textContent = 'Start and stop a drag recording first.';
      return;
    }
    const report = JSON.stringify(savedReport, null, 2);
    try {
      await navigator.clipboard.writeText(report);
      status.textContent = 'Copied. Paste the JSON into this ChatGPT conversation.';
    } catch {
      const previous = panel.querySelector('textarea');
      previous?.remove();
      const area = document.createElement('textarea');
      area.readOnly = true;
      area.value = report;
      area.setAttribute('aria-label', 'Copy drag diagnostic JSON');
      area.style.cssText = 'display:block;width:100%;height:120px;' +
        'margin-top:7px;background:#fff;color:#111;font:11px monospace';
      panel.append(area);
      area.focus();
      area.select();
      status.textContent = 'Select all and copy the JSON box, then paste in chat.';
    }
  }
  startButton.addEventListener('click', start);
  stopButton.addEventListener('click', () => stop('manual'));
  copyButton.addEventListener('click', () => { void copy(); });
  shrinkButton.addEventListener('click', () => {
    const collapsed = status.style.display !== 'none';
    status.style.display = collapsed ? 'none' : 'block';
    note.style.display = collapsed ? 'none' : 'block';
    shrinkButton.textContent = collapsed ? 'Expand' : 'Minimize';
  });
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  document.addEventListener('pointermove', onMove, { capture: true, passive: true });
  document.addEventListener('pointerup', onEnd, { capture: true, passive: true });
  document.addEventListener('pointercancel', onEnd, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state) stop('page hidden');
  });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => document.body.append(panel), { once: true });
  else document.body.append(panel);
})();
