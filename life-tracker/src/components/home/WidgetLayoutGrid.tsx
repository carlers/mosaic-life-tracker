import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Grip, MoveHorizontal } from 'lucide-react';
import {
  moveWidget, resizeWidget, widgetLayoutsEqual,
  type WidgetId, type WidgetLayoutItem, type WidgetSize,
} from '../../lib/widgetLayout';
import { widgetDragIndex, type WidgetSlot } from '../../lib/widgetDragProjection';

interface WidgetGridProps {
  items: WidgetLayoutItem[];
  editing: boolean;
  reducedMotion: boolean;
  onStartEditing: () => void;
  onPreview: (next: WidgetLayoutItem[]) => void;
  onCommit: (next: WidgetLayoutItem[]) => void;
  children: (id: WidgetId, size: WidgetSize) => React.ReactNode;
}

const NAMES: Record<WidgetId, string> = {
  today: 'Today', diary: 'Today diary', categories: 'Heaviest categories', weekly: 'Weekly progress',
};

interface DragSession {
  id: WidgetId;
  pointerId: number;
  pointerType: string;
  mode: 'move' | 'resize';
  active: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  origin: DOMRect;
  startItems: WidgetLayoutItem[];
  initialSize: WidgetSize;
  slots: WidgetSlot[];
  currentIndex: number;
  scrollHost: HTMLElement | null;
  scrollStart: number;
  timer?: number;
  lastActivityAt: number;
}

type FloatingCard = {
  id: WidgetId; size: WidgetSize;
  left: number; top: number; width: number; height: number;
};

/**
 * The real card remains in the CSS grid as a full-size, invisible placeholder.
 * A separate pointer-events-none body portal follows the pointer. The drag
 * resolves against frozen, viewport-coordinate slots, never animated siblings.
 * This keeps drag geometry independent from Swiper transforms and React reflow.
 */
export const WidgetLayoutGrid: React.FC<WidgetGridProps> = ({
  items, editing, reducedMotion, onStartEditing, onPreview, onCommit, children,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<WidgetId, HTMLDivElement>());
  const overlayRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<DragSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const beforeRectsRef = useRef(new Map<WidgetId, DOMRect>());
  const itemsRef = useRef(items);
  const callbacksRef = useRef({ onStartEditing, onPreview, onCommit });
  const [floating, setFloating] = useState<FloatingCard | null>(null);
  const [selected, setSelected] = useState<WidgetId | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [activeId, setActiveId] = useState<WidgetId | null>(null);

  useLayoutEffect(() => { itemsRef.current = items; }, [items]);
  useLayoutEffect(() => { callbacksRef.current = { onStartEditing, onPreview, onCommit }; },
    [onStartEditing, onPreview, onCommit]);

  const rememberRects = () => {
    beforeRectsRef.current = new Map(Array.from(cardRefs.current, ([id, node]) =>
      [id, node.getBoundingClientRect()]));
  };
  useLayoutEffect(() => {
    const before = beforeRectsRef.current;
    beforeRectsRef.current = new Map();
    for (const item of items) {
      if (pointerRef.current?.mode === 'move' && pointerRef.current.id === item.id) continue;
      const node = cardRefs.current.get(item.id);
      const previous = before.get(item.id);
      if (!node || !previous) continue;
      node.getAnimations?.().forEach(animation => animation.cancel());
      const next = node.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (!reducedMotion && node.animate && Math.hypot(dx, dy) > 2) {
        node.animate([
          { transform: 'translate3d(' + dx + 'px,' + dy + 'px,0)' },
          { transform: 'translate3d(0,0,0)' },
        ], { duration: 145, easing: 'cubic-bezier(.22,.72,.25,1)' });
      }
    }
  }, [items, reducedMotion]);

  const applyPreview = (next: WidgetLayoutItem[]) => {
    if (widgetLayoutsEqual(next, itemsRef.current)) return;
    rememberRects();
    itemsRef.current = next;
    callbacksRef.current.onPreview(next);
  };
  const stopFrame = () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };
  const preventActiveTouchPan = useCallback((event: TouchEvent) => {
    if (pointerRef.current?.active && pointerRef.current.pointerType === 'touch') {
      event.preventDefault();
    }
  }, []);

  const showOverlay = useCallback((session: DragSession) => {
    if (pointerRef.current !== session || session.active) return;
    session.active = true;
    session.lastActivityAt = Date.now();
    if (session.pointerType === 'touch') {
      document.addEventListener('touchmove', preventActiveTouchPan, { passive: false });
    }
    const node = gridRef.current;
    if (node?.setPointerCapture) {
      try { node.setPointerCapture(session.pointerId); } catch { /* Window listeners also handle release. */ }
    }
    setSelected(session.id);
    callbacksRef.current.onStartEditing();
    if (session.mode === 'move') {
      setActiveId(session.id);
      setFloating({
        id: session.id, size: session.initialSize,
        left: session.origin.left, top: session.origin.top,
        width: session.origin.width, height: session.origin.height,
      });
      setAnnouncement(NAMES[session.id] + ' selected to move');
    }
  }, [preventActiveTouchPan]);

  const pointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, id: WidgetId) => {
    if (event.button !== 0 || pointerRef.current) return;
    const target = event.target as Element;
    const resizeGrip = !!target.closest('[data-widget-resize-grip]');
    const moveGrip = !!target.closest('[data-widget-move-grip]');
    const isControl = !!target.closest(
      'input,textarea,select,[role="combobox"],[role="checkbox"],[data-widget-editor-control]'
    );
    if (isControl && !resizeGrip && !moveGrip) return;
    if (editing) event.stopPropagation();
    const node = cardRefs.current.get(id);
    const origin = node?.getBoundingClientRect();
    if (!node || !origin) return;
    const snapshot = itemsRef.current.map(item => ({ ...item }));
    const found = snapshot.find(item => item.id === id);
    if (!found) return;
    const slots = snapshot.map(item => {
      const rect = cardRefs.current.get(item.id)?.getBoundingClientRect();
      return {
        id: item.id,
        centerX: rect ? rect.left + rect.width / 2 : origin.left + origin.width / 2,
        centerY: rect ? rect.top + rect.height / 2 : origin.top + origin.height / 2,
      };
    });
    const scrollHost = gridRef.current?.closest<HTMLElement>('[data-widgets-scrollport]') ?? null;
    const session: DragSession = {
      id, pointerId: event.pointerId, pointerType: event.pointerType,
      mode: resizeGrip ? 'resize' : 'move', active: false,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      origin, slots, startItems: snapshot, initialSize: found.size,
      currentIndex: snapshot.findIndex(item => item.id === id),
      scrollHost, scrollStart: scrollHost?.scrollTop ?? 0, lastActivityAt: Date.now(),
    };
    pointerRef.current = session;
    // A grip owns the gesture immediately. Other touch areas require a deliberate
    // hold to preserve native vertical scrolling and ordinary widget controls.
    if (resizeGrip || moveGrip || (editing && event.pointerType === 'mouse')) {
      showOverlay(session);
    } else {
      session.timer = window.setTimeout(() => showOverlay(session), 440);
    }
  }, [editing, showOverlay]);

  const flushDrag = () => {
    frameRef.current = null;
    const s = pointerRef.current;
    if (!s?.active) return;
    if (s.mode !== 'move') return;
    const dx = s.x - s.startX;
    const dy = s.y - s.startY;
    if (overlayRef.current) {
      overlayRef.current.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    }
    const scrollDelta = (s.scrollHost?.scrollTop ?? 0) - s.scrollStart;
    const index = widgetDragIndex(
      s.slots, s.origin.left + s.origin.width / 2 + dx,
      s.origin.top + s.origin.height / 2 + dy,
      s.currentIndex, scrollDelta
    );
    if (index !== s.currentIndex) {
      s.currentIndex = index;
      applyPreview(moveWidget(s.startItems, s.id, index));
    }
    // Limited near-edge autoscroll allows reaching bottom placements without
    // overriding native scrolling when the user is not dragging.
    const host = s.scrollHost;
    if (host) {
      const box = host.getBoundingClientRect();
      const nearEnd = s.y > box.bottom - 58 && s.y < box.bottom + 16;
      const nearStart = s.y < box.top + 58 && s.y > box.top - 16;
      const direction = nearEnd ? 1 : nearStart ? -1 : 0;
      if (direction) {
        const before = host.scrollTop;
        host.scrollTop += 11 * direction;
        if (before !== host.scrollTop) {
          frameRef.current = window.requestAnimationFrame(flushDrag);
        }
      }
    }
  };

  const pointerMove = useCallback((event: PointerEvent) => {
    const s = pointerRef.current;
    if (!s || s.pointerId !== event.pointerId) return;
    s.x = event.clientX;
    s.y = event.clientY;
    s.lastActivityAt = Date.now();
    const dx = s.x - s.startX;
    const dy = s.y - s.startY;
    if (!s.active) {
      if (Math.hypot(dx, dy) > 8) {
        window.clearTimeout(s.timer);
        s.timer = undefined;
      }
      return;
    }
    if (s.mode === 'resize') {
      const nextSize: WidgetSize = s.initialSize === 'half'
        ? (dx >= 42 ? 'full' : 'half')
        : (dx <= -42 ? 'half' : 'full');
      applyPreview(resizeWidget(s.startItems, s.id, nextSize));
    } else if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(flushDrag);
    }
  }, [flushDrag]);

  const endSession = (pointerId: number, canceled = false) => {
    const s = pointerRef.current;
    if (!s || s.pointerId !== pointerId) return;
    pointerRef.current = null;
    window.clearTimeout(s.timer);
    stopFrame();
    document.removeEventListener('touchmove', preventActiveTouchPan);
    const host = gridRef.current;
    if (host?.hasPointerCapture?.(pointerId)) {
      try { host.releasePointerCapture(pointerId); } catch { /* Capture may already be lost. */ }
    }
    if (!s.active) return;
    // A release before the next animation frame must still use the final point.
    if (s.mode === 'move' && !canceled) {
      const dx = s.x - s.startX;
      const dy = s.y - s.startY;
      const scrollDelta = (s.scrollHost?.scrollTop ?? 0) - s.scrollStart;
      const index = widgetDragIndex(
        s.slots, s.origin.left + s.origin.width / 2 + dx,
        s.origin.top + s.origin.height / 2 + dy, s.currentIndex, scrollDelta
      );
      if (index !== s.currentIndex) applyPreview(moveWidget(s.startItems, s.id, index));
    }
    setFloating(null);
    setActiveId(null);
    if (canceled) {
      applyPreview(s.startItems);
      setAnnouncement('Widget arrangement canceled');
      return;
    }
    if (!widgetLayoutsEqual(itemsRef.current, s.startItems)) {
      callbacksRef.current.onCommit(itemsRef.current);
    }
    setAnnouncement(NAMES[s.id] + (s.mode === 'resize' ? ' resized' : ' moved'));
  };

  const pointerMoveRef = useRef(pointerMove);
  const endSessionRef = useRef(endSession);
  useLayoutEffect(() => {
    pointerMoveRef.current = pointerMove;
    endSessionRef.current = endSession;
  });

  useEffect(() => {
    const onMove = (event: PointerEvent) => pointerMoveRef.current(event);
    const onRelease = (event: PointerEvent) => endSessionRef.current(event.pointerId);
    const onCancel = (event: PointerEvent) => endSessionRef.current(event.pointerId, true);
    const onLost = (event: PointerEvent) => endSessionRef.current(event.pointerId, true);
    const cancel = () => {
      const session = pointerRef.current;
      if (session) endSessionRef.current(session.pointerId, true);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const onHidden = () => { if (document.hidden) cancel(); };
    // A passive move listener preserves native touch pan before activation.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('lostpointercapture', onLost, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onHidden);
    const watchdog = window.setInterval(() => {
      const s = pointerRef.current;
      if (s?.active && Date.now() - s.lastActivityAt > 12000) {
        endSessionRef.current(s.pointerId, true);
      }
    }, 1500);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('lostpointercapture', onLost, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onHidden);
      window.clearInterval(watchdog);
      cancel();
    };
  }, []);
  useEffect(() => {
    if (!editing && pointerRef.current?.active && pointerRef.current.mode === 'resize') {
      endSessionRef.current(pointerRef.current.pointerId, true);
    }
  }, [editing]);

  const moveBy = (id: WidgetId, step: number) => {
    const from = itemsRef.current.findIndex(item => item.id === id);
    if (from < 0) return;
    const next = moveWidget(itemsRef.current, id, from + step);
    if (widgetLayoutsEqual(next, itemsRef.current)) return;
    applyPreview(next);
    callbacksRef.current.onCommit(next);
    setSelected(id);
  };
  const keyboardResize = (id: WidgetId, size: WidgetSize) => {
    const next = resizeWidget(itemsRef.current, id, size);
    if (widgetLayoutsEqual(next, itemsRef.current)) return;
    applyPreview(next);
    callbacksRef.current.onCommit(next);
    setSelected(id);
  };

  return (
    <div ref={gridRef} data-testid="widgets-layout-grid"
      className="grid min-h-min grid-cols-2 content-start gap-3 pb-4"
      aria-label="Widgets dashboard">
      {items.map((item, index) => {
        const isDragging = activeId === item.id;
        const span = item.size === 'full' ? 'span 2 / span 2' : 'span 1 / span 1';
        return (
          <div key={item.id}
            ref={node => {
              if (node) cardRefs.current.set(item.id, node);
              else cardRefs.current.delete(item.id);
            }}
            data-widget-id={item.id}
            data-widget-size={item.size}
            data-widget-placeholder={isDragging ? item.id : undefined}
            aria-label={NAMES[item.id] + ' widget'}
            tabIndex={editing ? 0 : -1}
            onPointerDown={event => pointerDown(event, item.id)}
            onDoubleClick={event => {
              if (event.target instanceof Element &&
                event.target.closest('button,input,select,[role="checkbox"]')) return;
              setSelected(item.id);
              callbacksRef.current.onStartEditing();
            }}
            onContextMenu={event => {
              if (pointerRef.current?.id === item.id || editing) event.preventDefault();
            }}
            onClickCapture={event => {
              if (!editing) return;
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
              (isDragging ? 'outline-dashed outline-2 outline-accent/50 bg-surface/10 ' : '')}
            style={{
              gridColumn: span,
              minHeight: item.size === 'half' ? 180 : 200,
              touchAction: 'pan-y',
            }}>
            <div inert={editing || isDragging}
              className={'h-full min-w-0 ' +
                (editing ? 'pointer-events-none select-none ' : '') +
                (isDragging ? 'opacity-0 ' : '')}>
              {children(item.id, item.size)}
            </div>
            {editing && !isDragging && (
              <>
                <div data-widget-editor-control="true"
                  className="absolute left-2 top-2 flex items-center gap-1 rounded-xl bg-surface/90 p-1 shadow-lg">
                  <button type="button" aria-label={'Move ' + NAMES[item.id] + ' earlier'}
                    data-widget-editor-control="true" disabled={index === 0}
                    onClick={() => moveBy(item.id, -1)}
                    className="rounded-lg p-2 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent">
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={'Move ' + NAMES[item.id] + ' later'}
                    data-widget-editor-control="true" disabled={index === items.length - 1}
                    onClick={() => moveBy(item.id, 1)}
                    className="rounded-lg p-2 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent">
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                </div>
                <button type="button" data-widget-move-grip="true"
                  aria-label={'Drag ' + NAMES[item.id] + ' to move'}
                  title="Hold and drag to reorder"
                  className="absolute right-2 top-2 z-10 flex h-10 touch-none items-center gap-1 rounded-xl bg-surface/95 px-2 text-xs text-primary shadow-lg focus-visible:ring-2 focus-visible:ring-accent">
                  <Grip size={16} aria-hidden="true" /> Move
                </button>
                <button type="button" data-widget-resize-grip="true"
                  data-widget-editor-control="true"
                  aria-label={'Drag to resize ' + NAMES[item.id] +
                    (item.size === 'full' ? ' to half width' : ' to full width')}
                  title="Drag sideways to resize; arrow keys also adjust width"
                  onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                      event.preventDefault();
                      event.stopPropagation();
                      keyboardResize(item.id, event.key === 'ArrowLeft' ? 'half' : 'full');
                    }
                  }}
                  className="absolute bottom-2 right-2 z-10 flex h-11 touch-none items-center gap-1.5 rounded-xl bg-surface/95 px-3 text-xs font-medium text-primary shadow-lg focus-visible:ring-2 focus-visible:ring-accent">
                  <MoveHorizontal size={19} aria-hidden="true" />
                  Drag width: {item.size === 'full' ? 'Full' : 'Half'}
                </button>
              </>
            )}
          </div>
        );
      })}
      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
      {floating && createPortal(
        <div ref={overlayRef} aria-hidden="true" inert
          data-widget-drag-overlay={floating.id}
          className="pointer-events-none overflow-hidden rounded-2xl shadow-2xl"
          style={{
            position: 'fixed', zIndex: 1300, left: floating.left, top: floating.top,
            width: floating.width, height: floating.height, willChange: 'transform',
            transform: 'translate3d(0,0,0)',
          }}>
          {children(floating.id, floating.size)}
        </div>, document.body)}
    </div>
  );
};
