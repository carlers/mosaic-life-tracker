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
  const copyAllButton = makeButton('Copy all tests');
  const modeRow = document.createElement('label');
  modeRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap';
  modeRow.append('Test mode: ');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('aria-label', 'Performance test mode');
  modeSelect.style.cssText = 'min-width:180px;color:#fff;background:#253955;padding:5px;border-radius:4px';
  for (const [value, label] of [
    ['normal', 'Normal (side panel or bottom sheet)'],
    ['calendar-hidden', 'Suspend adjacent Calendar rendering'],
    ['panel-transform-off', 'Remove idle panel transform'],
  ]) {
    const option = document.createElement('option');
    option.value = value; option.textContent = label; modeSelect.append(option);
  }
  modeRow.append(modeSelect);
  const profileLabel = document.createElement('label');
  const profileToggle = document.createElement('input');
  profileToggle.type = 'checkbox'; profileToggle.checked = true;
  profileToggle.setAttribute('aria-label', 'Measure slow geometry calls');
  profileLabel.append(profileToggle, ' Measure slow geometry calls');
  profileLabel.style.cssText = 'display:block;margin-bottom:5px';
  panel.append(modeRow, profileLabel, row, status);
  const note = document.createElement('div');
  note.textContent = 'Local only • no personal content or network uploads';
  note.style.cssText = 'opacity:.75;margin-top:3px;font-size:10px';
  panel.append(note);
  let state = null, savedReport = null, raf = 0, lastFrameAt = null;
  let rootObserver = null, observedRoot = null, perfObservers = [];
  let active = null, lastBoundaryAt = 0;
  let restoreExperiment = () => {}, restoreGeometry = () => {};
  const reports = [];
  const geometryThresholdMs = 8;
  const experimentModes = new Set(['normal', 'calendar-hidden', 'panel-transform-off']);
  const kindKeys = ['task', 'category', 'note', 'group', 'idle'];
  const groupMetrics = () => Object.fromEntries(kindKeys.map(kind => [kind,
    { longTasks: 0, longTaskMs: 0, longFrames: 0, forcedLayoutMs: 0, attributedJsMs: 0,
      maxForcedLayoutMs: 0, frames: [], settleFrames: [] }]));
  // No user data is read from the DOM: only known structural markers and
  // sanitized static asset locations. Never export an Error.stack string.
  function stackSites() {
    try {
      return (String(new Error().stack || '').split('\n').slice(2).flatMap(line => {
        const hit = line.match(/(https?:\/\/[^\s()]+\/assets\/[A-Za-z0-9_.-]{1,110}\.js):(\d+):(\d+)/);
        if (!hit) return [];
        const url = new URL(hit[1]);
        const asset = url.pathname.match(/^\/assets\/([A-Za-z0-9_.-]{1,110}\.js)$/);
        return url.origin === location.origin && asset
          ? [{ bundle: asset[1], line: Number(hit[2]), column: Number(hit[3]) }] : [];
      })).slice(0, 5);
    } catch { return []; }
  }
  function geometryScope(node) {
    if (!(node instanceof Element)) return 'document-or-window';
    if (node.closest('[data-mosaic-drag-probe]')) return 'diagnostic';
    if (node.closest('[data-testid="day-slide"]')) {
      if (node.closest('[data-panel-reorder-row], [data-diary-note-row], [data-category-reorder-id]'))
        return 'day-row-or-category';
      return 'day-slide';
    }
    if (node.closest('[data-testid="calendar-day-side-panel"]')) return 'panel';
    if (node.closest('[data-calendar-keyboard-owned="true"]')) return 'calendar';
    return 'other-dom';
  }
  function phaseAt(t) {
    if (!state) return { kind: 'idle', phase: 'idle' };
    for (let i = state.gestureWindows.length - 1; i >= 0; i--) {
      const g = state.gestureWindows[i];
      if (g.start > t) continue;
      if (g.end == null || g.end >= t) return { kind: g.kind, phase: 'gesture' };
      if (t - g.end <= 500) return { kind: g.kind, phase: 'settle' };
      break;
    }
    return { kind: 'idle', phase: 'idle' };
  }
  function recordGeometry(method, target, started, elapsed) {
    if (!state || state.probePaused) return;
    const phase = phaseAt(started);
    if (phase.kind === 'idle') return;
    const key = method + ':' + phase.kind + ':' + phase.phase;
    const totals = state.geometryTotals[key] || (state.geometryTotals[key] = {
      method, kind: phase.kind, phase: phase.phase, count: 0, slowCount: 0, totalMs: 0, maxMs: 0
    });
    totals.count++; totals.totalMs += elapsed; totals.maxMs = Math.max(totals.maxMs, elapsed);
    if (elapsed < geometryThresholdMs) return;
    totals.slowCount++;
    const sites = stackSites();
    const scope = geometryScope(target);
    const siteKey = JSON.stringify([method, phase.kind, phase.phase, scope, sites]);
    if (!state.geometrySites[siteKey] && Object.keys(state.geometrySites).length >= 160) {
      state.geometryOverflow++; return;
    }
    const site = state.geometrySites[siteKey] || (state.geometrySites[siteKey] = {
      method, kind: phase.kind, phase: phase.phase, scope, sites,
      count: 0, totalMs: 0, maxMs: 0
    });
    site.count++; site.totalMs += elapsed; site.maxMs = Math.max(site.maxMs, elapsed);
  }
  // Wrap only while a report is being recorded. Never change native return
  // values, receivers, or errors. No stack construction for ordinary fast reads.
  function installGeometry() {
    const restores = [], installed = [];
    function wrap(proto, name, getter = false) {
      if (!proto) return;
      const d = Object.getOwnPropertyDescriptor(proto, name);
      const original = getter ? d?.get : d?.value;
      if (!d?.configurable || typeof original !== 'function') return;
      const method = getter ? name + ':get' : name;
      const wrapped = function (...args) {
        if (!state || state.probePaused || phaseAt(performance.now()).kind === 'idle')
          return Reflect.apply(original, this, args);
        const t = performance.now();
        try { return Reflect.apply(original, this, args); }
        finally {
          const elapsed = performance.now() - t;
          try { recordGeometry(method, name === 'getComputedStyle' ? args[0] : this, t, elapsed); }
          catch { /* instrumentation must not affect application reads */ }
        }
      };
      try {
        Object.defineProperty(proto, name, getter ? { ...d, get: wrapped } : { ...d, value: wrapped });
        installed.push(method);
        restores.push(() => {
          const current = Object.getOwnPropertyDescriptor(proto, name);
          if ((getter ? current?.get : current?.value) === wrapped)
            Object.defineProperty(proto, name, d);
        });
      } catch { /* unsupported browser descriptor */ }
    }
    for (const name of ['getBoundingClientRect', 'getClientRects']) wrap(Element.prototype, name);
    for (const name of ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight', 'scrollTop', 'scrollLeft'])
      wrap(Element.prototype, name, true);
    for (const name of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'offsetParent'])
      wrap(HTMLElement.prototype, name, true);
    for (const name of ['elementFromPoint', 'elementsFromPoint']) wrap(Document.prototype, name);
    wrap(window, 'getComputedStyle');
    restoreGeometry = () => { for (const restore of restores.reverse()) { try { restore(); } catch {} } };
    return installed;
  }
  // Test-only, temporary presentation interventions. Apply before timing,
  // preserve exact original inline declarations, and always restore on stop.
  function applyExperiment(mode, root) {
    const side = root.closest('[data-testid="calendar-day-side-panel"]');
    if (mode === 'normal') return { mode, applied: true, target: 'none' };
    if (!side) return { mode, applied: false, reason: 'Open the side panel first.' };
    const changes = [];
    const setStyle = (el, name, value) => {
      const previous = el.style.getPropertyValue(name);
      const priority = el.style.getPropertyPriority(name);
      el.style.setProperty(name, value, 'important');
      changes.push(() => {
        if (el.style.getPropertyValue(name) !== value || el.style.getPropertyPriority(name) !== 'important') return;
        if (previous) el.style.setProperty(name, previous, priority);
        else el.style.removeProperty(name);
      });
    };
    restoreExperiment = () => { for (const restore of changes.reverse()) restore(); };
    if (mode === 'calendar-hidden') {
      const candidates = [...document.querySelectorAll('[data-calendar-keyboard-owned="true"][data-calendar-primary-active="true"]')]
        .filter(el => !el.contains(side) && !side.contains(el));
      if (candidates.length !== 1 || !CSS.supports('content-visibility', 'hidden'))
        return { mode, applied: false, reason: 'Unique adjacent Calendar not found or content-visibility unsupported.' };
      const calendar = candidates[0];
      const bounds = calendar.getBoundingClientRect();
      if (bounds.width < 20 || bounds.height < 20)
        return { mode, applied: false, reason: 'Adjacent Calendar is not visible.' };
      const priorInert = calendar.inert;
      calendar.inert = true;
      changes.push(() => { if (calendar.inert) calendar.inert = priorInert; });
      setStyle(calendar, 'content-visibility', 'hidden');
      if (getComputedStyle(calendar).contentVisibility !== 'hidden')
        return { mode, applied: false, reason: 'Calendar rendering suspension not applied.' };
      return { mode, applied: true, target: 'adjacent-calendar', calendarWidthBefore: round(bounds.width),
        calendarHeightBefore: round(bounds.height), calendarWidthAfter: round(calendar.getBoundingClientRect().width),
        calendarHeightAfter: round(calendar.getBoundingClientRect().height) };
    }
    const host = side.closest('[data-testid="day-panel-motion-host"]');
    const inner = host?.firstElementChild;
    if (!(inner instanceof HTMLElement) || host.hasAttribute('data-day-panel-resizing'))
      return { mode, applied: false, reason: 'Panel shell unavailable or resizing.' };
    const transform = getComputedStyle(inner).transform;
    if (transform === 'none' || !new DOMMatrixReadOnly(transform).isIdentity)
      return { mode, applied: false, reason: 'Wait for the panel entrance to finish; idle transform must be identity.' };
    setStyle(inner, 'transform', 'none');
    setStyle(inner, 'transition', 'none');
    return { mode, applied: getComputedStyle(inner).transform === 'none', target: 'panel-motion-shell' };
  }
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
    const sidePanel = root?.closest('[data-testid="calendar-day-side-panel"]');
    const calendars = [...document.querySelectorAll('[data-calendar-keyboard-owned="true"][data-calendar-primary-active="true"]')]
      .filter(el => !sidePanel || !el.contains(sidePanel));
    const calendarRenderState = calendars.map(el => ({
      inert: Boolean(el.inert), contentVisibility: getComputedStyle(el).contentVisibility || 'unsupported',
      width: round(el.getBoundingClientRect().width), height: round(el.getBoundingClientRect().height)
    }));
    return {
      build,
      screen: root ? 'day-view' : 'no-day-view',
      // Label the layout/presentation without exporting coordinates/content.
      presentation: sidePanel ? 'side-panel' :
        root?.closest('.mosaic-bottom-sheet') ? 'bottom-sheet' :
        root ? 'inline-or-other' : 'none',
      panelLayoutIsolation: Boolean(sidePanel?.getAttribute('data-panel-layout-isolation') === 'true'),
      calendarNodes: calendars.reduce((sum, el) => sum + el.querySelectorAll('*').length, 0),
      calendarRenderState,
      dayViewHeightPx: root ? Math.round(root.getBoundingClientRect().height) : null,
      appRootInert: Boolean(document.getElementById('root')?.inert),
      daySlideNodes: root ? root.querySelectorAll('*').length : 0,
      documentNodes: document.querySelectorAll('*').length,
      panelTransform: sidePanel ? (() => {
        const inner = sidePanel.closest('[data-testid="day-panel-motion-host"]')?.firstElementChild;
        if (!inner) return 'missing';
        const transform = getComputedStyle(inner).transform;
        return transform === 'none' ? 'none' : new DOMMatrixReadOnly(transform).isIdentity ? 'identity' : 'other';
      })() : null,
      dayViewWidthPx: root ? Math.round(root.getBoundingClientRect().width) : null,
      mountedDaySlides: document.querySelectorAll('[data-testid="day-slide"]').length,
      mountedCategoryRows: document.querySelectorAll('[data-category-reorder-id]').length,
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
    // Day View can mount several (including empty/virtual) date slides. The
    // first visible node is not necessarily the day being reordered.
    let best = null, bestScore = -1;
    for (const el of document.querySelectorAll('[data-testid="day-slide"]')) {
      const rect = el.getBoundingClientRect();
      if (!(rect.width > 20 && rect.height > 20 && rect.bottom > 0 &&
        rect.top < innerHeight)) continue;
      const score = 10000 * Number(Boolean(el.closest('.swiper-slide-active'))) +
        100 * Number(Boolean(el.querySelector('[data-testid="category-reorder"]'))) +
        10 * el.querySelectorAll('[data-category-reorder-id]').length +
        el.querySelectorAll('[data-panel-reorder-row], [data-diary-note-row]').length;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }
  function observeRoot(root) {
    if (observedRoot === root) return;
    rootObserver?.disconnect();
    observedRoot = root;
    if (!state || !root) return;
    rootObserver = new MutationObserver(onMutation);
    rootObserver.observe(root, { childList: true, subtree: true });
    state.observedPopulatedRoot = Boolean(root.querySelector('[data-testid="category-reorder"]'));
  }
  const kindAt = timestamp => {
    if (!state) return null;
    for (let i = state.gestureWindows.length - 1; i >= 0; i--) {
      const window = state.gestureWindows[i];
      if (window.start <= timestamp && (window.end === null || window.end >= timestamp))
        return window.kind;
    }
    return null;
  };
  const safeSymbol = value => {
    const symbol = String(value || '');
    return /^[A-Za-z0-9_$.:<>-]{1,96}$/.test(symbol) ? symbol : null;
  };
  const scriptOrigin = value => {
    if (!value) return 'unknown';
    try {
      const url = new URL(value, location.href);
      if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:')
        return 'browser-extension';
      if (url.origin !== location.origin) return 'external-script';
      const file = url.pathname.startsWith('/assets/')
        ? url.pathname.split('/').pop() : null;
      return file && /^[a-zA-Z0-9_.-]{1,110}$/.test(file)
        ? 'mosaic-bundle:' + file : 'mosaic-other';
    } catch { return 'unknown'; }
  };
  const offset = t => round(t - state.started);
  function onDown(event) {
    if (!state || !event.isPrimary || panel.contains(event.target)) return;
    const kind = classify(event.target);
    if (!kind) return;
    // Active note gestures call stopPropagation at the window capture stage.
    // Observe here first and retain the previous gesture if another down arrives.
    if (active) onEnd({ pointerId: active.id, type: 'interrupted' });
    const actualRoot = event.target instanceof Element
      ? event.target.closest('[data-testid="day-slide"]') : null;
    if (actualRoot) observeRoot(actualRoot);
    const pos = point(event);
    const began = performance.now();
    const window = { start: began, end: null, kind };
    state.gestureWindows.push(window);
    active = { id: event.pointerId, kind, began, window,
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
    const ended = performance.now();
    active.window.end = ended;
    state.gestures.push({
      kind: active.kind, durationMs: round(ended - active.began),
      moves: active.moves, travelPx: round(active.traveled),
      boundaryEvents: active.boundaryEvents,
      likelyDrag: active.moved && (active.estimatedDrag || active.boundaryEvents > 0 ||
        (ended - active.began > 350 && active.traveled > 25)),
      canceled: event.type === 'pointercancel',
      interrupted: event.type === 'interrupted'
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
      perfObservers.push({ observer: obs, consume });
      return true;
    } catch { return false; }
  }
  function sampleFrame(now) {
    if (!state) { raf = 0; return; }
    if (lastFrameAt !== null) {
      const delta = now - lastFrameAt;
      if (delta > 0 && !document.hidden && state.frames.length < MAX_SAMPLES) {
        state.frames.push(delta);
        const phase = phaseAt(now);
        const metric = state.byKind[phase.kind];
        (phase.phase === 'settle' ? metric.settleFrames : metric.frames).push(delta);
        if (delta >= 250) state.visibleFramesOver250++;
        const nearBoundary = now - state.lastBoundaryAt < 120 && now - state.lastBoundaryAt >= 0;
        if (nearBoundary) state.boundaryFrames.push(delta);
        else state.steadyFrames.push(delta);
        if (delta > 33 && state.slowFrames.length < 90)
          state.slowFrames.push({ tMs: offset(now), frameMs: round(delta),
            nearBoundary, kind: active?.kind || null });
      } else if (document.hidden) state.suspendedFrames++;
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
    const mode = experimentModes.has(modeSelect.value) ? modeSelect.value : 'normal';
    let experiment;
    const widthBefore = root.getBoundingClientRect().width;
    try { experiment = applyExperiment(mode, root); }
    catch { experiment = { mode, applied: false, reason: 'Experiment could not be applied safely.' }; }
    const widthAfter = root.getBoundingClientRect().width;
    if (!experiment.applied || Math.abs(widthAfter - widthBefore) > 2) {
      restoreExperiment(); restoreExperiment = () => {};
      status.textContent = experiment.reason || 'Experiment changed Day View width; not recorded.';
      return;
    }
    experiment.dayViewWidthBefore = round(widthBefore);
    experiment.dayViewWidthAfter = round(widthAfter);
    savedReport = null;
    lastFrameAt = null;
    lastBoundaryAt = -Infinity;
    state = {
      started: 0, before: snapshot(), experiment, geometryEnabled: profileToggle.checked,
      geometryInstalled: [], geometryTotals: Object.create(null), geometrySites: Object.create(null),
      geometryOverflow: 0, byKind: groupMetrics(), totalLongTasks: 0, totalLongFrames: 0,
      visibleFramesOver250: 0, probePaused: false,
      frames: [], steadyFrames: [], boundaryFrames: [], slowFrames: [],
      boundaries: [], lastBoundaryAt: -Infinity, suspendedFrames: 0,
      gestures: [], gestureWindows: [], pointers: { category: 0, task: 0, note: 0, group: 0 },
      pointerMoves: 0, inputLag: [], mutations: 0, observedPopulatedRoot: false,
      longTasks: [], longAnimationFrames: [], support: {}
    };
    state.started = performance.now();
    if (state.geometryEnabled) state.geometryInstalled = installGeometry();
    modeSelect.disabled = true; profileToggle.disabled = true;
    observeRoot(root);
    state.support.longTasks = observePerformance('longtask', entry => {
      state.totalLongTasks++;
      const phase = phaseAt(entry.startTime);
      const metric = state.byKind[phase.kind];
      metric.longTasks++; metric.longTaskMs += entry.duration;
      if (state.longTasks.length < 70) state.longTasks.push({
        tMs: offset(entry.startTime), durationMs: round(entry.duration),
        kind: kindAt(entry.startTime)
      });
    });
    state.support.longAnimationFrames = observePerformance('long-animation-frame', entry => {
      state.totalLongFrames++;
      const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
      const jsMs = scripts.reduce((sum, script) => sum + (script.duration || 0), 0);
      const phase = phaseAt(entry.startTime);
      const metric = state.byKind[phase.kind];
      const forced = scripts.reduce((sum, script) => sum + (script.forcedStyleAndLayoutDuration || 0), 0);
      metric.longFrames++; metric.forcedLayoutMs += forced; metric.attributedJsMs += jsMs;
      metric.maxForcedLayoutMs = Math.max(metric.maxForcedLayoutMs, forced);
      if (state.longAnimationFrames.length >= 70) return;
      const layoutStart = Number.isFinite(entry.styleAndLayoutStart)
        ? entry.styleAndLayoutStart : null;
      const topScripts = [...scripts].sort((a, b) => (b.duration || 0) - (a.duration || 0))
        .slice(0, 3).map(script => ({
          durationMs: round(script.duration || 0),
          origin: scriptOrigin(script.sourceURL),
          functionName: safeSymbol(script.sourceFunctionName || script.functionName),
          invoker: safeSymbol(script.invoker),
          sourceCharPosition: Number.isInteger(script.sourceCharPosition) && script.sourceCharPosition >= 0
            ? script.sourceCharPosition : null,
          forcedStyleLayoutMs: round(script.forcedStyleAndLayoutDuration || 0)
        }));
      state.longAnimationFrames.push({
        tMs: offset(entry.startTime), durationMs: round(entry.duration),
        kind: kindAt(entry.startTime),
        blockingMs: round(entry.blockingDuration || 0), attributedJsMs: round(jsMs),
        // This tail includes browser paint; it is not a precise layout duration.
        styleLayoutTailMs: layoutStart == null ? null
          : round(Math.max(0, entry.startTime + entry.duration - layoutStart)),
        topScripts
      });
    });
    raf = requestAnimationFrame(sampleFrame);
    status.textContent = 'Recording ' + mode + '. Reorder task, category, note, group. Stop to restore the UI.';
    startButton.textContent = 'Restart';
  }
  function stop(reason = 'stopped') {
    if (!state) return;
    if (active) onEnd({ pointerId: active.id, type: 'stopped' });
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    rootObserver?.disconnect();
    rootObserver = null;
    observedRoot = null;
    state.probePaused = true;
    perfObservers.forEach(({ observer, consume }) => {
      for (const entry of observer.takeRecords()) consume(entry);
      observer.disconnect();
    });
    perfObservers = [];
    restoreGeometry(); restoreGeometry = () => {};
    const data = state;
    const elapsed = round(performance.now() - data.started);
    let after = null;
    try { after = snapshot(); }
    catch { /* restore even if the view was torn down mid-recording */ }
    state = null;
    restoreExperiment(); restoreExperiment = () => {};
    modeSelect.disabled = false; profileToggle.disabled = false;
    startButton.textContent = 'Start drag test';
    savedReport = {
      kind: 'Mosaic #2298 opt-in drag frame/boundary report',
      schema: 3, privacy: 'No content, accounts, identifiers, coordinates or network uploads',
      collectionMs: elapsed,
      experiment: { ...data.experiment,
        retainedAtEnd: Boolean(after && after.presentation === data.before.presentation &&
          (data.experiment.mode === 'normal' ||
            (data.experiment.mode === 'calendar-hidden' && after.calendarRenderState.length === 1 &&
              after.calendarRenderState[0].inert && after.calendarRenderState[0].contentVisibility === 'hidden') ||
            (data.experiment.mode === 'panel-transform-off' && after.panelTransform === 'none')) &&
          Math.abs((after.dayViewWidthPx ?? -100) - data.before.dayViewWidthPx) <= 2) },
      geometryProfile: { enabled: data.geometryEnabled, installed: data.geometryInstalled,
        slowThresholdMs: geometryThresholdMs, omittedSlowSiteOccurrences: data.geometryOverflow,
        totals: Object.values(data.geometryTotals).map(v => ({ ...v, totalMs: round(v.totalMs), maxMs: round(v.maxMs) })),
        slowSites: Object.values(data.geometrySites).sort((a,b) => b.totalMs - a.totalMs).slice(0, 35)
          .map(v => ({ ...v, totalMs: round(v.totalMs), maxMs: round(v.maxMs) })) },
      allLongTaskCount: data.totalLongTasks, allLongAnimationFrameCount: data.totalLongFrames,
      visibleFramesOver250Ms: data.visibleFramesOver250,
      byKind: Object.fromEntries(Object.entries(data.byKind).map(([kind, v]) => [kind, {
        longTasks: v.longTasks, longTaskMs: round(v.longTaskMs), longFrames: v.longFrames,
        forcedLayoutMs: round(v.forcedLayoutMs), attributedJsMs: round(v.attributedJsMs),
        maxForcedLayoutMs: round(v.maxForcedLayoutMs), gestureFrames: describe(v.frames),
        settleFrames: describe(v.settleFrames) }])),
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
      observedPopulatedRoot: data.observedPopulatedRoot,
      slowFrames: data.slowFrames,
      suspendedFrames: data.suspendedFrames,
      caveat: 'Visible frame stalls >=250ms are retained. Detail arrays are capped; allLong* and byKind include all observed entries. Geometry durations are measured call wall time, not proven layout time; lazy style-property reads can escape wrapping. Stack sites are sanitized asset basename/line/column only. DOM mutations approximate boundaries. Instrumentation adds overhead; compare identical settings.'
    };
    reports.push(savedReport);
    if (reports.length > 6) reports.shift();
    status.textContent = 'Stopped (' + reason + '). ' +
      data.gestures.filter(g => g.likelyDrag).length + ' drags, ' +
      data.boundaries.length + ' structural changes. ' + reports.length + ' saved test(s). Copy JSON or Copy all tests.';
  }
  async function copy(all = false) {
    if (state) stop('copy');
    if (!savedReport) {
      status.textContent = 'Start and stop a drag recording first.';
      return;
    }
    const report = JSON.stringify(all ? { kind: 'Mosaic #2298 comparison set', schema: 3, reports } : savedReport, null, 2);
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
  copyAllButton.addEventListener('click', () => { void copy(true); });
  shrinkButton.addEventListener('click', () => {
    const collapsed = status.style.display !== 'none';
    status.style.display = collapsed ? 'none' : 'block';
    note.style.display = collapsed ? 'none' : 'block';
    modeRow.style.display = collapsed ? 'none' : 'flex';
    profileLabel.style.display = collapsed ? 'none' : 'block';
    shrinkButton.textContent = collapsed ? 'Expand' : 'Minimize';
  });
  // Register on window capture BEFORE app gesture listeners. The Diary note
  // drag handler stops propagation at this stage, before document sees input.
  window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  window.addEventListener('pointermove', onMove, { capture: true, passive: true });
  window.addEventListener('pointerup', onEnd, { capture: true, passive: true });
  window.addEventListener('pointercancel', onEnd, { capture: true, passive: true });
  window.addEventListener('pagehide', () => { if (state) stop('page hidden'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state) stop('page hidden');
  });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => document.body.append(panel), { once: true });
  else document.body.append(panel);
})();
