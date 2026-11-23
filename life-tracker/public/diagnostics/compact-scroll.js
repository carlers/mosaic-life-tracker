/* Opt-in read-only #2300 Brave scroll diagnostic. No network or account content. */
(() => {
  'use strict';
  const sel = '[data-testid="todo-scroll-region"]';
  const round = x => Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
  const region = () => document.querySelector(
    '[data-mosaic-tour="calendar"] .swiper-slide-active ' + sel
  ) || Array.from(document.querySelectorAll(sel)).find(n => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  }) || null;
  const metrics = el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { tag: el.tagName, test: el.getAttribute('data-testid'),
      activeSlide: el.classList.contains('swiper-slide-active'),
      display: s.display, position: s.position, overflowX: s.overflowX,
      overflowY: s.overflowY, touchAction: s.touchAction, pointerEvents: s.pointerEvents,
      minHeight: s.minHeight, top: round(r.top), bottom: round(r.bottom),
      height: round(r.height), clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight, scrollTop: round(el.scrollTop),
      maxScroll: el.scrollHeight - el.clientHeight };
  };
  function snapshot() {
    const n = region(), ancestors = [];
    for (let e = n, i = 0; e && i < 20; i++, e = e.parentElement) ancestors.push(metrics(e));
    const active = document.querySelector(
      '[data-mosaic-tour="calendar"] .swiper-slide-active [data-testid="compact-activity-current"]');
    const cards = Array.from(active?.querySelectorAll('[data-testid^="compact-heatmap-month-"]') || []);
    const nav = document.querySelector('nav[aria-label="Main"]');
    let build = null;
    try {
      const raw = document.querySelector('meta[name="mosaic-build-info"]')?.content;
      const x = raw ? JSON.parse(raw) : null;
      if (x) build = { commit: x.commit, branch: x.branch, channel: x.channel };
    } catch { /* build meta optional */ }
    return { build, route: location.pathname, viewport: {
      width: innerWidth, height: innerHeight,
      visualHeight: round(visualViewport?.height), visualScale: round(visualViewport?.scale),
      dpr: round(devicePixelRatio) },
      regionCount: document.querySelectorAll(sel).length,
      ancestors,
      finalMonthBottom: cards.length ? round(cards[cards.length - 1].getBoundingClientRect().bottom) : null,
      navTop: nav ? round(nav.getBoundingClientRect().top) : null };
  }
  let baseline, armed = false, starts = 0, moves = 0, wheels = 0;
  let scrolls = 0, prevented = 0, cancelable = 0, maxTop = 0;
  let touchOrigin = null, maxDx = 0, maxDy = 0, lastWheel = null, target = null;
  let frame = 0;
  function update() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const n = region();
      status.textContent = !n ? 'No active Todo/Diary scroller found' :
        'Scroll ' + round(n.scrollTop) + '/' + (n.scrollHeight - n.clientHeight) +
        ' | touch ' + moves + ' | wheel ' + wheels;
    });
  }
  function onEvent(e) {
    if (!armed || panel.contains(e.target)) return;
    if (e.type === 'scroll') {
      if (e.target === region()) { scrolls++; maxTop = Math.max(maxTop, e.target.scrollTop); }
    } else {
      const element = e.target instanceof Element ? e.target : null;
      const near = element?.closest('[data-testid]');
      const key = near?.getAttribute('data-testid');
      target = { tag: element?.tagName || null,
        test: key && /^(compact-|todo-)/.test(key) ? key.replace(/\d{4}-\d{2}/g,'YYYY-MM') : null,
        withinScrollRegion: !!(element && region()?.contains(element)) };
      if (e.type === 'touchstart') {
        starts++;
        const t = e.touches[0];
        touchOrigin = t ? { id:t.identifier,x:t.clientX,y:t.clientY } : null;
      }
      if (e.type === 'touchend') touchOrigin = null;
      if (e.type === 'touchmove' || e.type === 'wheel') {
        if (e.type === 'touchmove') {
          moves++;
          const t = Array.from(e.touches).find(x => x.identifier === touchOrigin?.id);
          if (t && touchOrigin) {
            maxDx = Math.max(maxDx, Math.abs(t.clientX - touchOrigin.x));
            maxDy = Math.max(maxDy, Math.abs(t.clientY - touchOrigin.y));
          }
        } else { wheels++; lastWheel = { dx:round(e.deltaX),dy:round(e.deltaY), mode:e.deltaMode }; }
        if (e.cancelable) cancelable++;
        queueMicrotask(() => { if (e.defaultPrevented) prevented++; });
      }
    }
    update();
  }
  function begin() {
    baseline = snapshot();
    armed = true;
    starts = moves = wheels = scrolls = prevented = cancelable = maxDx = maxDy = 0;
    maxTop = region()?.scrollTop || 0;
    lastWheel = target = touchOrigin = null;
    beginButton.textContent = 'Restart test';
    status.textContent = 'Try scrolling on the month cards, then tap Copy report';
  }
  async function copy() {
    const report = JSON.stringify({
      kind:'Mosaic #2300 scroll input/geometry (no task or account data)',
      before:baseline || snapshot(),after:snapshot(),
      gestures:{touchStarts:starts,touchMoves:moves,wheels,scrollEvents:scrolls,
        cancelable,prevented,maxDx:round(maxDx),maxDy:round(maxDy),
        maxScrollTop:round(maxTop),lastWheel,target}
    },null,2);
    try {
      await navigator.clipboard.writeText(report);
      status.textContent = 'Report copied; paste it in the Mosaic chat';
    } catch {
      const area = document.createElement('textarea');
      area.value = report;
      area.style.cssText = 'width:100%;height:130px;background:white;color:black';
      area.setAttribute('aria-label','Copy scroll report');
      panel.append(area);
      area.select();
      status.textContent = 'Copy the selected text and paste it in chat';
    }
  }
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;z-index:2147483647;left:8px;right:8px;' +
    'bottom:calc(4.25rem + env(safe-area-inset-bottom));border-radius:9px;' +
    'border:1px solid #94bfff;background:#15223ff0;color:white;padding:9px;' +
    'font:12px system-ui;box-shadow:0 2px 14px #0009';
  const beginButton = document.createElement('button');
  const copyButton = document.createElement('button');
  beginButton.textContent = 'Start scroll test';
  copyButton.textContent = 'Copy report';
  for (const button of [beginButton,copyButton]) {
    button.type = 'button';
    button.style.cssText = 'margin-right:8px;padding:8px;border-radius:6px;' +
      'background:#31558c;color:white;border:1px solid #709ae1';
  }
  const status = document.createElement('div');
  status.style.cssText = 'margin-top:5px';
  status.textContent = 'Read-only. Open Todo/Diary in six-month view; no data leaves your device.';
  beginButton.addEventListener('click',begin);
  copyButton.addEventListener('click',copy);
  panel.append(beginButton,copyButton,status);
  for (const type of ['touchstart','touchmove','touchend','wheel','scroll']) {
    document.addEventListener(type,onEvent,{capture:true,passive:true});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',()=>document.body.append(panel),{once:true});
  } else document.body.append(panel);
})();
