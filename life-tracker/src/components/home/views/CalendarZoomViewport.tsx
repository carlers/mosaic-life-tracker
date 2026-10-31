import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { CalendarZoomDays } from '../../../lib/preferences';
import { scrollCalendarDateWithinSlide } from './useCalendarGridKeyboard';
import {
  edgeSwipeDirection, nearestZoomSnap, zoomSnapColumns,
  type ZoomEdge,
} from '../../../lib/calendarZoomPhysics';

type Edge = ZoomEdge;
const DRAG_THRESHOLD_PX = 7;
const WHEEL_EDGE_THRESHOLD_PX = 72;
const WHEEL_GAP_MS = 260;
const EDGE_TOLERANCE_PX = 2;

interface CalendarZoomViewportProps {
  zoomDays: Exclude<CalendarZoomDays, 7>;
  children: React.ReactNode;
  onZoomMount?: (element: HTMLDivElement, days: number) => void;
  onZoomScroll?: (element: HTMLDivElement, days: number) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  navigationLocked?: boolean;
}
function edgeOf(node: HTMLDivElement): Edge {
  if (node.scrollLeft <= EDGE_TOLERANCE_PX) return 'left';
  const max = node.scrollWidth - node.clientWidth;
  return max > 0 && node.scrollLeft >= max - EDGE_TOLERANCE_PX ? 'right' : null;
}
function columnAt(node: HTMLDivElement, days: number): number {
  return node.clientWidth > 0 ? node.scrollLeft * days / node.clientWidth : 0;
}
interface Start {
  x: number;
  y: number;
  scroll: number;
  edge: Edge;
  pointerId?: number;
  dragged?: boolean;
}

/**
 * Native touch pan remains browser-owned and follows the finger 1:1.
 * No sibling scrollLeft writes happen while scrolling. Mouse dragging is
 * synthesized only for pointerType=mouse; CSS owns release snapping on touch.
 */
export const CalendarZoomViewport: React.FC<CalendarZoomViewportProps> = ({
  zoomDays, children, onZoomMount, onZoomScroll, onNavigate, navigationLocked = false,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<Start | null>(null);
  const mouseStartRef = useRef<Start | null>(null);
  const pendingMouseSnapRef = useRef<(() => void) | null>(null);
  const nativeIdleTimerRef = useRef<number | null>(null);
  const clearNativeIdle = () => {
    if (nativeIdleTimerRef.current !== null) window.clearTimeout(nativeIdleTimerRef.current);
    nativeIdleTimerRef.current = null;
  };
  const cancelMouseSnap = () => {
    pendingMouseSnapRef.current?.();
    pendingMouseSnapRef.current = null;
  };
  useEffect(() => () => {
    pendingMouseSnapRef.current?.();
    if (nativeIdleTimerRef.current !== null) window.clearTimeout(nativeIdleTimerRef.current);
  }, []);

  // Prevent another horizontal wheel gesture from moving the incoming
  // month while Embla is settling. Vertical scrolling and pinch zoom remain.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !navigationLocked) return;
    const stopHorizontalWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey &&
        Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.35) {
        event.preventDefault();
      }
    };
    node.addEventListener('wheel', stopHorizontalWheel, { passive: false });
    return () => node.removeEventListener('wheel', stopHorizontalWheel);
  }, [navigationLocked]);
  const suppressClickRef = useRef(false);
  const wheelRef = useRef({ last: -Infinity, direction: 0, distance: 0,
    edge: null as Edge, committed: false });

  useLayoutEffect(() => {
    if (viewportRef.current) onZoomMount?.(viewportRef.current, zoomDays);
  }, [onZoomMount, zoomDays]);

  const navigateOnRelease = (start: Start, x: number, y: number): boolean => {
    const direction = edgeSwipeDirection(start.edge, x - start.x, y - start.y);
    if (!direction || !onNavigate || navigationLocked) return false;
    suppressClickRef.current = true;
    onNavigate(direction);
    return true;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || navigationLocked) return;
    const node = event.currentTarget;
    cancelMouseSnap();
    clearNativeIdle();
    suppressClickRef.current = false;
    mouseStartRef.current = {
      x: event.clientX, y: event.clientY, scroll: node.scrollLeft,
      edge: edgeOf(node), pointerId: event.pointerId,
    };
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = mouseStartRef.current;
    if (!start || start.pointerId !== event.pointerId || navigationLocked) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.dragged) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
      start.dragged = true;
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.currentTarget.style.scrollSnapType = 'none';
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = start.scroll - dx;
  };
  const smoothSnap = (node: HTMLDivElement) => {
    clearNativeIdle();
    if (navigationLocked || mouseStartRef.current || touchStartRef.current ||
      pendingMouseSnapRef.current || !node.clientWidth) return;
    const destination = nearestZoomSnap(columnAt(node, zoomDays), zoomDays)
      * node.clientWidth / zoomDays;
    if (Math.abs(node.scrollLeft - destination) <= 1) {
      node.style.scrollSnapType = '';
      return;
    }
    if (!node.scrollTo || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      node.scrollLeft = destination;
      node.style.scrollSnapType = '';
      return;
    }
    // CSS snap targets alone are unreliable for nested scrolling on some
    // mobile WebKit/trackpads. Align only once native momentum has stopped.
    // Never write scrollLeft while the finger is moving.
    node.style.scrollSnapType = 'none';
    const restore = () => {
      node.removeEventListener('scrollend', restore);
      window.clearTimeout(fallback);
      node.style.scrollSnapType = '';
      if (pendingMouseSnapRef.current === restore) pendingMouseSnapRef.current = null;
    };
    const fallback = window.setTimeout(restore, 900);
    pendingMouseSnapRef.current = restore;
    node.addEventListener('scrollend', restore);
    node.scrollTo({ left: destination, behavior: 'smooth' });
  };
  const queueNativeSnap = (node: HTMLDivElement, delay = 160) => {
    clearNativeIdle();
    if (navigationLocked || node.dataset.calendarPinchMorph === 'true' ||
      mouseStartRef.current || touchStartRef.current || pendingMouseSnapRef.current) return;
    nativeIdleTimerRef.current = window.setTimeout(() => {
      nativeIdleTimerRef.current = null;
      smoothSnap(node);
    }, delay);
  };
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onNativeScrollEnd = () => {
      if (!navigationLocked && node.dataset.calendarPinchMorph !== 'true' &&
        !pendingMouseSnapRef.current) smoothSnap(node);
    };
    node.addEventListener('scrollend', onNativeScrollEnd);
    return () => node.removeEventListener('scrollend', onNativeScrollEnd);
  // Keep the native scrollend listener bound to the current snap callback.
  }, [navigationLocked, zoomDays, smoothSnap]);
  useEffect(() => {
    if (navigationLocked) clearNativeIdle();
  }, [navigationLocked]);
  const finishMouse = (node: HTMLDivElement, x: number, y: number) => {
    const start = mouseStartRef.current;
    mouseStartRef.current = null;
    if (!start) return;
    if (!start.dragged || navigateOnRelease(start, x, y)) {
      node.style.scrollSnapType = '';
      return;
    }
    smoothSnap(node);
  };
  // Standalone MonthView/WeekView grids historically support arrow navigation
  // through this zoom lane. Once CalendarBody owns the grid keyboard contract,
  // leave arrows to its date-aware controller (including period boundaries).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing ||
      event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
      event.currentTarget.closest('[data-calendar-keyboard-owned="true"]')) return;
    const source = event.target;
    if (!(source instanceof HTMLButtonElement) ||
      !source.parentElement?.matches('[role="gridcell"]')) return;
    const offset = event.key === 'ArrowRight' ? 1 :
      event.key === 'ArrowLeft' ? -1 :
      event.key === 'ArrowDown' ? 7 :
      event.key === 'ArrowUp' ? -7 : 0;
    if (!offset) return;
    const days = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="gridcell"] > button:not(:disabled)'
    ));
    const target = days[days.indexOf(source) + offset];
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    const slide = event.currentTarget.closest<HTMLElement>('[data-calendar-slide-index]') ?? event.currentTarget;
    scrollCalendarDateWithinSlide(target, slide);
  };

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Scrollable calendar weekdays"
      tabIndex={0}
      data-calendar-zoom-lane="true"
      onKeyDown={handleKeyDown}
      data-zoom-days={zoomDays}
      className="max-w-full shrink-0 overflow-x-auto overscroll-x-contain"
      style={{
        touchAction: navigationLocked ? 'pan-y pinch-zoom' : 'auto',
        scrollSnapType: 'x mandatory',
        cursor: navigationLocked ? 'default' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        if (event.pointerType === 'mouse')
          finishMouse(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerCancel={() => {
        mouseStartRef.current = null;
        cancelMouseSnap();
        clearNativeIdle();
        if (viewportRef.current) viewportRef.current.style.scrollSnapType = '';
      }}
      onClickCapture={(event) => {
        if (!navigationLocked && !suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchStart={(event) => {
        const node = event.currentTarget;
        const touch = event.touches[0];
        if (navigationLocked || event.touches.length !== 1 || !touch) {
          touchStartRef.current = null;
          return;
        }
        suppressClickRef.current = false;
        clearNativeIdle();
        cancelMouseSnap();
        touchStartRef.current = {
          x: touch.clientX, y: touch.clientY, scroll: node.scrollLeft, edge: edgeOf(node),
        };
      }}
      onTouchEnd={(event) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        const touch = event.changedTouches[0];
        if (start && touch && !navigationLocked &&
          !navigateOnRelease(start, touch.clientX, touch.clientY))
          queueNativeSnap(event.currentTarget, 180);
      }}
      onTouchCancel={() => {
        touchStartRef.current = null;
        clearNativeIdle();
      }}
      onWheel={(event) => {
        if (navigationLocked || !onNavigate || event.ctrlKey || event.metaKey || event.shiftKey ||
          event.deltaMode !== 0 ||
          Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.35) return;
        const dir = Math.sign(event.deltaX);
        const state = wheelRef.current;
        const now = Date.now();
        if (now - state.last > WHEEL_GAP_MS || state.direction !== dir) {
          state.distance = 0;
          state.committed = false;
          state.edge = edgeOf(event.currentTarget);
          state.direction = dir;
        }
        state.last = now;
        if (state.committed || (dir > 0 && state.edge !== 'right') ||
          (dir < 0 && state.edge !== 'left')) return;
        state.distance += Math.abs(event.deltaX);
        if (state.distance >= WHEEL_EDGE_THRESHOLD_PX) {
          state.committed = true;
          onNavigate(dir > 0 ? 'next' : 'prev');
        }
      }}
      onFocusCapture={(event) => {
        if (!navigationLocked && event.target !== event.currentTarget &&
          event.target instanceof HTMLElement &&
          event.target.closest('[role="gridcell"]')) {
          const slide = event.currentTarget.closest<HTMLElement>('[data-calendar-slide-index]');
          if (slide) scrollCalendarDateWithinSlide(event.target, slide);
        }
      }}
      onScroll={(event) => {
        onZoomScroll?.(event.currentTarget, zoomDays);
        queueNativeSnap(event.currentTarget);
      }}
    >
      <div className="relative" style={{ width: `${(7 / zoomDays) * 100}%` }}>
        {zoomSnapColumns(zoomDays).map((column) => (
          <span aria-hidden="true" data-calendar-snap-day={column} key={column} style={{
            position: 'absolute',
            top: 0,
            left: `${(column / 7) * 100}%`,
            width: 1, height: 1, pointerEvents: 'none', scrollSnapAlign: 'start',
          }} />
        ))}
        {children}
      </div>
    </div>
  );
};
