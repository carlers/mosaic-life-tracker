/* #2298 temporary local performance recorder.
 * It never reads task/Diary content, dates, credentials or network data.
 * No fetch, beacon, storage or transport; copy is exclusively user-triggered.
 */
(() => {
  if (new URLSearchParams(window.location.search).get('mosaic2298Perf') !== '1') return;
  if (window.__mosaic2298FrameAuditActive) return;
  window.__mosaic2298FrameAuditActive = true;

  const maxSamples = 24;
  const samples = [];
  const timingEntries = [];
  let active = null;
  const p = (values, percentile) => {
    if (!values.length) return 0;
    const ordered = [...values].sort((a, b) => a - b);
    return +ordered[Math.min(ordered.length - 1,
      Math.max(0, Math.ceil(ordered.length * percentile) - 1))].toFixed(1);
  };
  const name = node => node instanceof Element ? node : null;
  const kindOf = target => {
    if (target.closest('[data-diary-note-row], [data-diary-reorder-id]')) return 'diary-note';
    if (target.closest('[data-diary-drag-group]')) return 'diary-group';
    if (target.closest('[data-category-drag-handle], .mosaic-category-pill')) return 'category';
    if (target.closest('[data-task-id]')) return 'task';
    return null;
  };
  const modeOf = target => target.closest('[data-testid="calendar-day-side-panel"]')
    ? 'panel' : target.closest('[data-testid="day-sheet-swipe-surface"]')
      ? 'sheet' : 'other';

  const host = document.createElement('aside');
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'Drag performance recorder');
  host.setAttribute('data-mosaic-2298-audit', 'true');
  Object.assign(host.style, {
    position: 'fixed', top: '10px', left: '10px', zIndex: '2147483646',
    width: 'min(290px, calc(100vw - 20px))', maxHeight: 'min(340px, 50vh)',
    overflow: 'auto', padding: '10px', background: 'rgba(12, 17, 27, .97)',
    color: '#fff', border: '1px solid #64748b', borderRadius: '10px',
    font: '12px/1.4 system-ui, sans-serif', boxShadow: '0 6px 16px #0008',
  });
  const heading = document.createElement('strong');
  heading.textContent = 'Mosaic drag frame audit · local only';
  const status = document.createElement('div');
  status.textContent = 'Drag a task, category or diary item to record.';
  status.style.marginTop = '6px';
  status.setAttribute('role', 'status');
  const controls = document.createElement('div');
  Object.assign(controls.style, {display: 'flex', gap: '8px', marginTop: '8px'});
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'Copy summary';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.textContent = 'Clear';
  for (const control of [button, reset]) Object.assign(control.style, {
    background: '#334155', color: '#fff', borderRadius: '5px',
    padding: '5px 8px', cursor: 'pointer'
  });
  const output = document.createElement('textarea');
  output.readOnly = true;
  output.setAttribute('aria-label', 'Numeric drag performance summary');
  Object.assign(output.style, {
    width: '100%', height: '98px', marginTop: '8px', resize: 'vertical',
    font: '10px/1.4 ui-monospace, monospace', background: '#020617',
    color: '#cbd5e1', border: '1px solid #64748b',
  });
  host.append(heading, status, controls, output);
  controls.append(button, reset);
  document.body.appendChild(host);

  const numeric = sample => {
    const start = sample.since, end = sample.until;
    const matching = timingEntries.filter(e => e.startTime >= start && e.startTime <= end);
    const loaf = matching.filter(e => e.entryType === 'long-animation-frame');
    const longTasks = matching.filter(e => e.entryType === 'longtask');
    return {
      presentation: sample.mode,
      gesture: sample.kind,
      pointerMoves: sample.moves,
      sampleFrames: sample.frames.length,
      frameP50ms: p(sample.frames, .5),
      frameP95ms: p(sample.frames, .95),
      frameMaxMs: p(sample.frames, 1),
      framesOver32ms: sample.frames.filter(n => n > 32).length,
      framesOver50ms: sample.frames.filter(n => n > 50).length,
      longAnimationFrames: loaf.length,
      loafMaxMs: p(loaf.map(e => e.duration), 1),
      loafBlockingMs: +loaf.reduce((n, e) => n + (e.blockingDuration || 0), 0).toFixed(1),
      loafScriptsMs: +loaf.reduce((n, e) => n + (e.scriptsDuration || 0), 0).toFixed(1),
      loafForcedLayoutMs: +loaf.reduce((n, e) => n + (e.forcedLayoutDuration || 0), 0).toFixed(1),
      longTasks: longTasks.length,
      longTaskMaxMs: p(longTasks.map(e => e.duration), 1),
    };
  };
  const refresh = () => {
    const result = {
      label: 'Mosaic #2298 anonymous local frame sample',
      supportsLongAnimationFrame: Boolean(window.PerformanceObserver &&
        PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')),
      gestureCount: samples.length,
      samples: samples.slice(),
    };
    output.value = JSON.stringify(result, null, 2);
    status.textContent = samples.length
      ? samples.length + ' drag(s) recorded. Use Copy summary.'
      : 'Drag a task, category or diary item to record.';
  };
  refresh();
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = 'Numeric summary copied. No telemetry sent.';
    } catch {
      output.focus();
      output.select();
      status.textContent = 'Select the numeric summary and copy manually.';
    }
  });
  reset.addEventListener('click', () => { samples.length = 0; refresh(); });

  if ('PerformanceObserver' in window) {
    for (const type of ['long-animation-frame', 'longtask']) {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) continue;
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const data = entry;
            const scripts = Array.isArray(data.scripts) ? data.scripts : [];
            timingEntries.push({
              entryType: type, startTime: entry.startTime, duration: entry.duration,
              blockingDuration: Number(data.blockingDuration || 0),
              scriptsDuration: scripts.reduce((n, s) => n + Number(s.duration || 0), 0),
              forcedLayoutDuration: scripts.reduce((n, s) =>
                n + Number(s.forcedStyleAndLayoutDuration || 0), 0),
            });
          }
          if (timingEntries.length > 700) timingEntries.splice(0, timingEntries.length - 500);
        });
        observer.observe({type, buffered: false});
      } catch { /* unsupported API; requestAnimationFrame remains available */ }
    }
  }

  const tick = now => {
    const sample = active;
    if (!sample || !sample.started) return;
    if (sample.lastFrame) sample.frames.push(now - sample.lastFrame);
    sample.lastFrame = now;
    if (sample.frames.length > 1800) sample.frames.shift();
    sample.frame = requestAnimationFrame(tick);
  };
  window.addEventListener('pointerdown', e => {
    if (active || e.button !== 0 || e.isPrimary === false) return;
    const target = name(e.target);
    if (!target || !target.closest('[data-testid="day-slide"]')) return;
    const kind = kindOf(target);
    if (!kind) return;
    active = {
      pointerId: e.pointerId, x: e.clientX, y: e.clientY,
      kind, mode: modeOf(target), since: 0, until: 0,
      started: false, moves: 0, frames: [], frame: null, lastFrame: 0
    };
  }, true);
  window.addEventListener('pointermove', e => {
    const s = active;
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.started && Math.hypot(e.clientX - s.x, e.clientY - s.y) >= 8) {
      s.started = true; s.since = performance.now(); s.lastFrame = 0;
      s.frame = requestAnimationFrame(tick);
    }
    if (s.started) s.moves++;
  }, true);
  const end = e => {
    const s = active;
    if (!s || (e.pointerId != null && e.pointerId !== s.pointerId)) return;
    active = null;
    if (s.frame !== null) cancelAnimationFrame(s.frame);
    if (!s.started || s.moves < 3) return;
    s.until = performance.now();
    // Allow PerformanceObserver delivery for the last presented frame.
    setTimeout(() => {
      samples.push(numeric(s));
      if (samples.length > maxSamples) samples.shift();
      refresh();
    }, 180);
  };
  window.addEventListener('pointerup', end, true);
  window.addEventListener('pointercancel', end, true);
  window.addEventListener('blur', () => end({pointerId:active?.pointerId}), true);
})();
