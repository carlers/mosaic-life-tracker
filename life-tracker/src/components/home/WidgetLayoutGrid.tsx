import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Grip, MoveHorizontal } from 'lucide-react';
import {
  moveWidget, resizeWidget, widgetLayoutsEqual,
  type WidgetId, type WidgetLayoutItem, type WidgetSize,
} from '../../lib/widgetLayout';

interface WidgetGridProps {
  items: WidgetLayoutItem[];
  editing: boolean;
  reducedMotion: boolean;
  onStartEditing: () => void;
  onPreview: (next: WidgetLayoutItem[]) => void;
  onCommit: (next: WidgetLayoutItem[]) => void;
  children: (id: WidgetId, size: WidgetSize) => React.ReactNode;
}

interface PointerSession {
  id: WidgetId;
  pointerId: number;
  pointerType: string;
  mode: 'move' | 'resize';
  x: number;
  y: number;
  startItems: WidgetLayoutItem[];
  initialSize: WidgetSize;
  active: boolean;
  timer?: number;
  origin?: { top: number; left: number; width: number; height: number };
  deltaX: number;
  deltaY: number;
  lastTarget?: WidgetId;
  lastReorderX?: number;
  lastReorderY?: number;
  lastActivityAt: number;
}

type DragVisual = { id: WidgetId; top: number; left: number; width: number; height: number };
const NAMES: Record<WidgetId, string> = {
  today: 'Today', diary: 'Today diary', categories: 'Heaviest categories', weekly: 'Weekly progress',
};

export const WidgetLayoutGrid: React.FC<WidgetGridProps> = ({
  items, editing, reducedMotion, onStartEditing, onPreview, onCommit, children,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<WidgetId, HTMLDivElement>());
  const pointerRef = useRef<PointerSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const previousRectsRef = useRef(new Map<WidgetId, DOMRect>());
  const releaseRectRef = useRef<{ id: WidgetId; rect: DOMRect } | null>(null);
  const suppressClickRef = useRef(false);
  const itemsRef = useRef(items);
  useLayoutEffect(() => { itemsRef.current = items; }, [items]);
  const [selected, setSelected] = useState<WidgetId | null>(null);
  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const captureRects = useCallback(() => {
    const before = new Map<WidgetId, DOMRect>();
    for (const [id, node] of cardRefs.current) {
      const ghost = gridRef.current?.querySelector<HTMLElement>('[data-widget-placeholder="' + id + '"]');
      before.set(id, (ghost ?? node).getBoundingClientRect());
    }
    previousRectsRef.current = before;
  }, []);

  useLayoutEffect(() => {
    const before = previousRectsRef.current;
    previousRectsRef.current = new Map();
    for (const item of items) {
      const node = cardRefs.current.get(item.id);
      if (!node || drag?.id === item.id) continue;
      const origin = before.get(item.id);
      if (!origin) continue;
      const next = node.getBoundingClientRect();
      const x = origin.left - next.left;
      const y = origin.top - next.top;
      if (!reducedMotion && Math.hypot(x, y) > 2 && node.animate) {
        node.getAnimations?.().forEach(animation => animation.cancel());
        node.animate([{ transform: 'translate3d(' + x + 'px,' + y + 'px,0)' },
          { transform: 'translate3d(0,0,0)' }],
        { duration: 190, easing: 'cubic-bezier(.22,.72,.25,1)' });
      }
    }
    const drop = releaseRectRef.current;
    if (drop && !drag && !reducedMotion) {
      releaseRectRef.current = null;
      const node = cardRefs.current.get(drop.id);
      if (!node || !node.animate) return;
      const rect = node.getBoundingClientRect();
      const x = drop.rect.left - rect.left;
      const y = drop.rect.top - rect.top;
      if (Math.hypot(x, y) > 2) {
        node.animate([{ transform: 'translate3d(' + x + 'px,' + y + 'px,0)', opacity: 0.82 },
          { transform: 'translate3d(0,0,0)', opacity: 1 }],
        { duration: 185, easing: 'cubic-bezier(.2,.75,.3,1)' });
      }
    }
  }, [items, drag, reducedMotion]);

  const applyPreview = useCallback((next: WidgetLayoutItem[]) => {
    if (widgetLayoutsEqual(next, itemsRef.current)) return;
    captureRects();
    itemsRef.current = next;
    onPreview(next);
  }, [captureRects, onPreview]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // Only block native touch scrolling while a long-press move is actually
  // active; ordinary Widgets scrolling and outer Home swipe remain native.
  const blockActiveTouchPan = useCallback((event: TouchEvent) => {
    if (pointerRef.current?.active && pointerRef.current.pointerType === 'touch') {
      event.preventDefault();
    }
  }, []);
  const activateMove = useCallback((session: PointerSession) => {
    if (pointerRef.current !== session) return;
    const node = cardRefs.current.get(session.id);
    const rect = node?.getBoundingClientRect();
    if (!rect) return;
    session.active = true;
    if (session.pointerType === 'touch') {
      document.addEventListener('touchmove', blockActiveTouchPan, { passive: false });
    }
    session.origin = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    suppressClickRef.current = true;
    setSelected(session.id);
    onStartEditing();
    setDrag({ id: session.id, ...session.origin });
    setAnnouncement(NAMES[session.id] + ' selected to move');
  }, [onStartEditing, blockActiveTouchPan]);

  const start = useCallback((event: React.PointerEvent<HTMLDivElement>,
    id: WidgetId, mode: PointerSession['mode'] = 'move') => {
    if (event.button !== 0 || pointerRef.current) return;
    const moveHandle = mode === 'move' && event.target instanceof Element &&
      !!event.target.closest('[data-widget-move-handle]');
    if (mode === 'move' && !moveHandle && event.target instanceof Element &&
      event.target.closest('input,textarea,select,[role="checkbox"],[data-widget-editor-control]')) return;
    if (editing || mode === 'resize') event.stopPropagation();
    suppressClickRef.current = false;
    // Capture on the STABLE grid, never on the card that becomes fixed during
    // dragging. Pointerup must survive an animated reflow or leaving a card.
    const target = gridRef.current;
    if (!target) return;
    const current = itemsRef.current;
    const item = current.find(candidate => candidate.id === id);
    if (!item) return;
    const session: PointerSession = {
      id, pointerId: event.pointerId, pointerType: event.pointerType, mode,
      x: event.clientX, y: event.clientY,
      deltaX: 0, deltaY: 0, lastActivityAt: Date.now(), active: mode === 'resize',
      startItems: current.map(entry => ({ ...entry })), initialSize: item.size,
    };
    pointerRef.current = session;
    if (target.setPointerCapture) {
      try { target.setPointerCapture(event.pointerId); }
      catch { /* Window-level release/cancel listeners remain the fallback. */ }
    }
    if (mode === 'resize') {
      if (session.pointerType === 'touch') {
        document.addEventListener('touchmove', blockActiveTouchPan, { passive: false });
      }
      onStartEditing();
      setSelected(id);
      suppressClickRef.current = true;
    } else if (moveHandle || (editing && event.pointerType === 'mouse')) {
      activateMove(session);
    } else {
      // Touch/pen edits on card content require a hold, so the dashboard
      // remains vertically scrollable even while Edit is enabled.
      session.timer = window.setTimeout(() => activateMove(session), 420);
    }
  }, [activateMove, blockActiveTouchPan, editing, onStartEditing]);

  const move = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const session = pointerRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.deltaX = event.clientX - session.x;
    session.deltaY = event.clientY - session.y;
    session.lastActivityAt = Date.now();
    if (!session.active) {
      if (Math.hypot(session.deltaX, session.deltaY) > 8) {
        window.clearTimeout(session.timer);
        session.timer = undefined;
      }
      return;
    }
    event.stopPropagation();
    if (session.mode === 'resize') {
      const nextSize: WidgetSize = session.initialSize === 'half'
        ? (session.deltaX > 42 ? 'full' : 'half')
        : (session.deltaX < -42 ? 'half' : 'full');
      applyPreview(resizeWidget(itemsRef.current, session.id, nextSize));
      return;
    }
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const active = pointerRef.current;
      if (active !== session || !active.active) return;
      const node = cardRefs.current.get(session.id);
      if (node) node.style.transform =
        'translate3d(' + session.deltaX + 'px,' + session.deltaY + 'px,0)';
      const x = session.x + session.deltaX;
      const y = session.y + session.deltaY;
      let target: WidgetId | null = null;
      let shortest = Number.POSITIVE_INFINITY;
      for (const [id, element] of cardRefs.current) {
        if (id === session.id) continue;
        const rect = element.getBoundingClientRect();
        const distance = Math.hypot(
          (rect.left + rect.width / 2 - x) * 0.8,
          rect.top + rect.height / 2 - y);
        if (distance < shortest) { shortest = distance; target = id; }
      }
      if (!target) return;
      const hovered = cardRefs.current.get(target)?.getBoundingClientRect();
      if (!hovered || shortest > Math.max(hovered.height, hovered.width) * 0.85) return;
      const toIndex = itemsRef.current.findIndex(item => item.id === target);
      const fromIndex = itemsRef.current.findIndex(item => item.id === session.id);
      if (toIndex < 0 || fromIndex === toIndex) return;
      // Hysteresis prevents oscillation as slots reflow under the finger,
      // but moving back across a previous target is still possible.
      if (target === session.lastTarget &&
        Math.hypot(x - (session.lastReorderX ?? x), y - (session.lastReorderY ?? y)) < 22) return;
      session.lastTarget = target;
      session.lastReorderX = x;
      session.lastReorderY = y;
      applyPreview(moveWidget(itemsRef.current, session.id, toIndex));
    });
  }, [applyPreview]);

  const endSession = useCallback((pointerId: number, canceled = false) => {
    const session = pointerRef.current;
    if (!session || session.pointerId !== pointerId) return;
    // Clear the session FIRST: releasePointerCapture raises lostpointercapture.
    pointerRef.current = null;
    window.clearTimeout(session.timer);
    document.removeEventListener('touchmove', blockActiveTouchPan);
    stopRaf();
    const grid = gridRef.current;
    if (grid?.hasPointerCapture?.(pointerId)) grid.releasePointerCapture(pointerId);
    if (!session.active) return;
    suppressClickRef.current = true;
    if (session.mode === 'move') {
      const node = cardRefs.current.get(session.id);
      if (node) {
        releaseRectRef.current = canceled ? null : { id: session.id, rect: node.getBoundingClientRect() };
        node.style.transform = '';
      }
      setDrag(null);
    } else if (!canceled && Math.hypot(session.deltaX, session.deltaY) < 12) {
      // A tap on Resize toggles immediately; a horizontal drag previews
      // and commits its size instead. Keyboard activation uses resizeTo.
      const nextSize: WidgetSize = session.initialSize === 'half' ? 'full' : 'half';
      applyPreview(resizeWidget(itemsRef.current, session.id, nextSize));
    }
    if (canceled) {
      applyPreview(session.startItems);
      setAnnouncement('Widget arrangement canceled');
    } else {
      if (!widgetLayoutsEqual(itemsRef.current, session.startItems)) onCommit(itemsRef.current);
      setAnnouncement(NAMES[session.id] + (session.mode === 'resize' ? ' resized' : ' moved'));
    }
  }, [applyPreview, blockActiveTouchPan, onCommit, stopRaf]);

  const finish = useCallback((event: React.PointerEvent<HTMLDivElement>, canceled = false) => {
    if (pointerRef.current?.active) event.stopPropagation();
    endSession(event.pointerId, canceled);
  }, [endSession]);

  // Captured pointers may be lost on viewport exit, tab switch, Escape,
  // Swiper interruption or resize-induced DOM changes. Never leave a fixed
  // ghost, touchmove blocker or active pointer behind.
  useEffect(() => {
    const release = (event: PointerEvent) => endSession(event.pointerId);
    const cancel = (event: PointerEvent) => endSession(event.pointerId, true);
    const cancelActive = () => {
      const session = pointerRef.current;
      if (session) endSession(session.pointerId, true);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelActive();
    };
    const onVisibility = () => { if (document.hidden) cancelActive(); };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancelActive);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', cancelActive, true);
    document.addEventListener('visibilitychange', onVisibility);
    // Fail-safe for a platform that never delivers pointerup/cancel/lostcapture
    // after an out-of-window release. An abandoned overlay cannot persist.
    const idleWatchdog = window.setInterval(() => {
      const session = pointerRef.current;
      if (session?.active && Date.now() - session.lastActivityAt > 10000) {
        endSession(session.pointerId, true);
      }
    }, 1500);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancelActive);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', cancelActive, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(idleWatchdog);
      const session = pointerRef.current;
      if (session) {
        window.clearTimeout(session.timer);
        pointerRef.current = null;
      }
      document.removeEventListener('touchmove', blockActiveTouchPan);
      stopRaf();
    };
  }, [blockActiveTouchPan, endSession, stopRaf]);

  useEffect(() => {
    if (!editing && pointerRef.current?.active) {
      endSession(pointerRef.current.pointerId, true);
    }
  }, [editing, endSession]);

  const moveBy = useCallback((id: WidgetId, step: number) => {
    const index = itemsRef.current.findIndex(item => item.id === id);
    if (index < 0) return;
    const next = moveWidget(itemsRef.current, id, index + step);
    applyPreview(next);
    onCommit(next);
    setSelected(id);
  }, [applyPreview, onCommit]);

  const resizeTo = useCallback((id: WidgetId, size: WidgetSize) => {
    const next = resizeWidget(itemsRef.current, id, size);
    applyPreview(next);
    onCommit(next);
    setSelected(id);
  }, [applyPreview, onCommit]);

  return (
    <div ref={gridRef} data-testid="widgets-layout-grid"
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={event => finish(event, true)}
      onLostPointerCapture={event => endSession(event.pointerId, true)}
      className="grid min-h-min grid-cols-2 content-start gap-3 pb-4"
      aria-label="Widgets dashboard">
      {items.map((item, index) => {
        const isDragging = drag?.id === item.id;
        const span = item.size === 'full' ? 'span 2 / span 2' : 'span 1 / span 1';
        return (
          <React.Fragment key={item.id}>
            {isDragging && (
              <div data-widget-placeholder={item.id} aria-hidden="true"
                className="rounded-2xl border border-dashed border-border bg-surface/20"
                style={{ gridColumn: span, minHeight: drag.height }} />
            )}
            <div ref={node => {
                if (node) cardRefs.current.set(item.id, node);
                else cardRefs.current.delete(item.id);
              }}
              data-widget-id={item.id} data-widget-size={item.size}
              aria-label={NAMES[item.id] + ' widget'}
              tabIndex={editing ? 0 : -1}
              onPointerDown={event => start(event, item.id)}
              onClickCapture={event => {
                if (!editing && !suppressClickRef.current) return;
                if (event.target instanceof Element &&
                  event.target.closest('[data-widget-editor-control]')) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onKeyDown={event => {
                if (!editing || !event.altKey) return;
                if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveBy(item.id, -1);
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveBy(item.id, 1);
                }
              }}
              className={'relative min-w-0 rounded-2xl ' +
                (editing ? 'outline outline-1 outline-border ' : '') +
                (selected === item.id && editing ? 'ring-2 ring-emerald-500/60 ' : '') +
                (isDragging ? 'pointer-events-none shadow-2xl opacity-95 ' : '')}
              style={isDragging ? {
                position: 'fixed', zIndex: 80, top: drag.top, left: drag.left,
                width: drag.width, height: drag.height, willChange: 'transform',
              } : {
                gridColumn: span, minHeight: item.size === 'half' ? 180 : 200,
                touchAction: 'pan-y',
              }}>
              <div inert={editing} className={'h-full min-w-0 ' + (editing ? 'pointer-events-none select-none' : '')}>
                {children(item.id, item.size)}
              </div>
              {editing && (
                <>
                  <div className="absolute left-2 top-2 flex touch-none items-center gap-1 rounded-xl bg-surface/90 p-1 shadow-lg"
                    data-widget-editor-control="true">
                    <button type="button" aria-label={'Move ' + NAMES[item.id] + ' earlier'}
                      data-widget-editor-control="true" disabled={index === 0}
                      onClick={() => moveBy(item.id, -1)}
                      className="rounded-lg p-2 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={'Move ' + NAMES[item.id] + ' later'}
                      data-widget-editor-control="true" disabled={index === items.length - 1}
                      onClick={() => moveBy(item.id, 1)}
                      className="rounded-lg p-2 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <button type="button" data-widget-move-handle="true"
                    aria-label={'Drag ' + NAMES[item.id] + ' to move'}
                    title="Drag to reorder"
                    onPointerDown={event => start(event as unknown as React.PointerEvent<HTMLDivElement>, item.id)}
                    className="absolute right-2 top-2 z-10 flex h-10 touch-none items-center gap-1 rounded-xl bg-surface/95 px-2 text-xs text-primary shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-500">
                    <Grip size={16} aria-hidden="true" /> Move
                  </button>
                  <button type="button" aria-label={'Resize ' + NAMES[item.id] +
                      (item.size === 'full' ? ' to half width' : ' to full width')}
                      data-widget-editor-control="true"
                      onPointerDown={event => {
                        event.stopPropagation();
                        // A grip owns its pointer, not the parent drag surface.
                        start(event as unknown as React.PointerEvent<HTMLDivElement>, item.id, 'resize');
                      }}
                      onClick={event => {
                        event.stopPropagation();
                        // Keyboard/AT activation toggles the two legal sizes.
                        // Pointer gestures have already committed their live result.
                        if (event.detail === 0) resizeTo(item.id, item.size === 'full' ? 'half' : 'full');
                      }}
                      title="Tap to switch width, or drag horizontally to resize"
                      className="absolute bottom-2 right-2 z-10 flex h-11 touch-none items-center gap-1.5 rounded-xl border border-border bg-surface/95 px-3 text-xs font-medium text-primary shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <MoveHorizontal size={19} aria-hidden="true" />
                      Resize: {item.size === 'full' ? 'Full' : 'Half'}
                    </button>
                </>
              )}
            </div>
          </React.Fragment>
        );
      })}
      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
    </div>
  );
};
