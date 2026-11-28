/* #2298 private opt-in CSS invalidation A/B. No telemetry, network, persistence or task-data reads. */
(() => {
  'use strict';
  if (new URLSearchParams(window.location.search).get('mosaic2298RootCSS') !== '1') return;
  if (window.__mosaic2298RootCSS) return;

  // Source: CalendarWallpaperBackdrop.css, OtherPagesWallpaper.css,
  // WallpaperMaterial.css and FloatingDock.css. The rewritten predicates
  // retain the original CSS specificity and visual matching semantics.
  const ROOT = /\.mosaic-app-layout:has\(\s*>\s*\[data-(home|other-pages)-wallpaper-paint\s*=\s*["']true["']\](?:\[(data-wallpaper-material|data-glass-transparency)\s*=\s*["']([^"']+)["']\])?\s*\)/g;
  const NAV = /:has\(\s*\.mosaic-floating-navigation(?:\[(data-mosaic-nav-hidden|data-mosaic-nav-keyboard)\s*=\s*["']true["']\])?\s*\)/g;
  const modes = [
    ['baseline', 'Original CSS'],
    ['page', 'Page paint'],
    ['material', 'Material / glass'],
    ['nav', 'Floating nav'],
    ['all', 'All three'],
  ];
  const originals = new Map();
  const counts = { page: 0, material: 0, nav: 0 };
  const status = { mode: 'baseline', rewritten: 0, failed: 0, available: counts, shellReady: false };
  let shell = null;
  let directObserver = null;
  let attributeObserver = null;
  let observedPaint = [];
  let navObserver = null;
  let observedNav = null;
  let statusElement = null;
  let buttons = [];

  const setMarker = (element, key, value) => {
    const next = value == null ? null : String(value);
    if (next === null) {
      if (element.hasAttribute(key)) element.removeAttribute(key);
    } else if (element.getAttribute(key) !== next) {
      element.setAttribute(key, next);
    }
  };

  // Observe only the app shell's DIRECT children and wallpaper/nav attributes.
  // Dragging Task/Diary descendants never invokes these observers.
  const syncRoot = () => {
    if (!shell || !shell.isConnected) return;
    const children = Array.from(shell.children);
    const findPaint = (kind) => children.find(node =>
      node instanceof HTMLElement && node.getAttribute('data-' + kind + '-wallpaper-paint') === 'true'
    ) || null;
    const home = findPaint('home');
    const other = findPaint('other-pages');
    for (const [type, paint] of [['home', home], ['other', other]]) {
      setMarker(shell, 'data-mosaic-2298-' + type, paint ? 'true' : null);
      setMarker(shell, 'data-mosaic-2298-' + type + '-material',
        paint ? paint.getAttribute('data-wallpaper-material') : null);
      setMarker(shell, 'data-mosaic-2298-' + type + '-transparency',
        paint ? paint.getAttribute('data-glass-transparency') : null);
    }
    if (home !== observedPaint[0] || other !== observedPaint[1]) {
      if (attributeObserver) attributeObserver.disconnect();
      observedPaint = [home, other];
      attributeObserver = new MutationObserver(syncRoot);
      for (const paint of observedPaint) {
        if (paint) attributeObserver.observe(paint, {
          attributes: true,
          attributeFilter: ['data-home-wallpaper-paint', 'data-other-pages-wallpaper-paint',
            'data-wallpaper-material', 'data-glass-transparency'],
        });
      }
    }
    const nav = shell.querySelector('.mosaic-floating-navigation');
    setMarker(shell, 'data-mosaic-2298-nav', nav ? 'true' : null);
    setMarker(shell, 'data-mosaic-2298-nav-hidden',
      nav?.getAttribute('data-mosaic-nav-hidden') === 'true' ? 'true' : null);
    setMarker(shell, 'data-mosaic-2298-nav-keyboard',
      nav?.getAttribute('data-mosaic-nav-keyboard') === 'true' ? 'true' : null);
    if (nav !== observedNav) {
      if (navObserver) navObserver.disconnect();
      observedNav = nav;
      navObserver = new MutationObserver(syncRoot);
      if (nav) navObserver.observe(nav, {
        attributes: true, attributeFilter: ['data-mosaic-nav-hidden', 'data-mosaic-nav-keyboard'],
      });
    }
    status.shellReady = true;
    renderStatus();
  };

  const attachShell = (node) => {
    if (!node || node === shell) return;
    if (directObserver) directObserver.disconnect();
    if (attributeObserver) attributeObserver.disconnect();
    if (navObserver) navObserver.disconnect();
    shell = node;
    observedPaint = [];
    observedNav = null;
    directObserver = new MutationObserver(syncRoot);
    directObserver.observe(shell, { childList: true });
    syncRoot();
  };

  const attachWhenReady = () => {
    const root = document.getElementById('root');
    if (!root) return;
    const found = root.querySelector('.mosaic-app-layout');
    if (found) return attachShell(found);
    const waiting = new MutationObserver(() => {
      const next = root.querySelector('.mosaic-app-layout');
      if (!next) return;
      waiting.disconnect();
      attachShell(next);
    });
    waiting.observe(root, { childList: true, subtree: true });
  };

  const replacement = (original, mode) => {
    let next = original.replace(ROOT, (full, type, qualifier, value) => {
      const group = qualifier ? 'material' : 'page';
      if (mode !== 'all' && mode !== group) return full;
      const name = 'data-mosaic-2298-' + (type === 'home' ? 'home' : 'other');
      const suffix = qualifier === 'data-wallpaper-material' ? 'material' : 'transparency';
      return '.mosaic-app-layout[' + name + '="true"]' +
        (qualifier ? '[' + name + '-' + suffix + '="' + value + '"]' : '');
    });
    if ((mode === 'all' || mode === 'nav') && original.includes('.mosaic-app-layout')) {
      next = next.replace(NAV, (full, qualifier) =>
        '[data-mosaic-2298-nav="true"]' +
          (qualifier ? '[data-mosaic-2298-' +
            (qualifier === 'data-mosaic-nav-hidden' ? 'nav-hidden' : 'nav-keyboard') +
            '="true"]' : '')
      );
    }
    return next;
  };

  function collectRules() {
    const active = new Set();
    const visit = (list) => {
      for (const rule of Array.from(list)) {
        if (rule.type === CSSRule.STYLE_RULE && typeof rule.selectorText === 'string') {
          const original = originals.get(rule) || rule.selectorText;
          if (original.includes('.mosaic-app-layout') &&
            (original.includes('wallpaper-paint') || original.includes('.mosaic-floating-navigation'))) {
            originals.set(rule, original);
            active.add(rule);
          }
        }
        if (rule.cssRules) visit(rule.cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try { visit(sheet.cssRules); } catch { /* Non-origin stylesheets are never edited. */ }
    }
    for (const rule of originals.keys()) if (!active.has(rule)) originals.delete(rule);
    counts.page = 0;
    counts.material = 0;
    counts.nav = 0;
    for (const original of originals.values()) {
      for (const match of original.matchAll(ROOT)) counts[match[2] ? 'material' : 'page'] += 1;
      if (original.includes('.mosaic-app-layout')) {
        counts.nav += Array.from(original.matchAll(NAV)).length;
      }
    }
  }

  function renderStatus() {
    if (!statusElement) return;
    const mode = modes.find(([value]) => value === status.mode);
    statusElement.textContent =
      (mode ? mode[1] : 'Unknown') + ' · changed ' + status.rewritten +
      ' rules · available ' + counts.page + '/' + counts.material + '/' + counts.nav +
      ' (paint/material/nav)' +
      (status.failed ? ' · CSSOM errors: ' + status.failed : '') +
      (!status.shellReady ? ' · waiting for app shell' : '') +
      (status.mode !== 'baseline' && status.rewritten === 0 ? ' · NO RULES CHANGED' : '');
    statusElement.dataset.mode = status.mode;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === status.mode));
      button.style.background = button.dataset.mode === status.mode ? '#255f58' : '#333b48';
    }
  }

  const setMode = (nextMode) => {
    if (!modes.some(([id]) => id === nextMode)) return false;
    collectRules();
    let changed = 0;
    let failed = 0;
    for (const [rule, original] of originals) {
      const desired = replacement(original, nextMode);
      if (rule.selectorText === desired) continue;
      try {
        rule.selectorText = desired;
        if ((desired.includes('data-mosaic-2298-') &&
          !rule.selectorText.includes('data-mosaic-2298-')) ||
          (nextMode === 'baseline' && rule.selectorText.includes('data-mosaic-2298-'))) {
          failed += 1;
        } else if (desired !== original) {
          changed += 1;
        }
      } catch { failed += 1; }
    }
    if (failed) {
      // Fail closed: a partial A/B is meaningless. Restore the original rules.
      for (const [rule, original] of originals) {
        try { rule.selectorText = original; } catch { /* Reported below. */ }
      }
      nextMode = 'baseline';
      changed = 0;
    }
    status.mode = nextMode;
    status.rewritten = changed;
    status.failed = failed;
    renderStatus();
    return failed === 0;
  };

  const mount = () => {
    if (document.querySelector('[data-mosaic-2298-root-css-hud]')) return;
    const hud = document.createElement('section');
    hud.setAttribute('data-mosaic-2298-root-css-hud', 'true');
    hud.setAttribute('role', 'region');
    hud.setAttribute('aria-label', 'Day View selector comparison');
    hud.style.cssText = 'position:fixed;top:10px;left:10px;z-index:2147483640;max-width:280px;padding:10px;border:1px solid #84909c;border-radius:9px;background:#171b22;color:#fff;font:12px/1.35 system-ui,sans-serif;box-shadow:0 6px 22px #0009';
    const heading = document.createElement('strong');
    heading.textContent = 'Day View root selector A/B';
    hud.appendChild(heading);
    const minimize = document.createElement('button');
    minimize.type = 'button';
    minimize.textContent = 'Minimize';
    minimize.style.cssText = 'float:right;margin-left:8px;color:white;background:#333b48;border:1px solid #84909c;border-radius:4px;cursor:pointer;padding:2px 4px';
    hud.appendChild(minimize);
    const content = document.createElement('div');
    const info = document.createElement('p');
    info.textContent = 'Switch modes before dragging, allow 2 seconds to settle, and compare the same task or Diary drag. Selector Stats OFF. Appearance is intended to match.';
    info.style.margin = '7px 0';
    content.appendChild(info);
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    for (const [mode, label] of modes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mode = mode;
      button.textContent = label;
      button.style.cssText = 'color:white;background:#333b48;border:1px solid #84909c;border-radius:5px;padding:5px;cursor:pointer';
      button.addEventListener('click', () => setMode(mode));
      controls.appendChild(button);
      buttons.push(button);
    }
    content.appendChild(controls);
    statusElement = document.createElement('div');
    statusElement.setAttribute('role', 'status');
    statusElement.style.cssText = 'margin-top:7px;font-size:11px;color:#e3ecf6';
    content.appendChild(statusElement);
    hud.appendChild(content);
    minimize.addEventListener('click', () => {
      content.hidden = !content.hidden;
      minimize.textContent = content.hidden ? 'Expand' : 'Minimize';
    });
    document.body.appendChild(hud);
    attachWhenReady();
    setMode('baseline');
  };

  window.__mosaic2298RootCSS = {
    setMode, getStatus: () => ({
      mode: status.mode, rewritten: status.rewritten, failed: status.failed,
      available: { ...counts }, shellReady: status.shellReady,
    }),
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else mount();
})();