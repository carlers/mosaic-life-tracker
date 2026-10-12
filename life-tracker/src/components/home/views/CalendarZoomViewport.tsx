import React, { useLayoutEffect, useRef } from 'react';
import type { CalendarZoomDays } from '../../../lib/preferences';
import {
  edgeSwipeDirection, nearestZoomSnap, zoomSnapColumns,
  type ZoomEdge,
} from '../../../lib/calendarZoomPhysics';

type Direction = 'prev' | 'next';
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
}
function edgeOf(node: HTMLDivElement): Edge {
  if (node.scrollLeft <= EDGE_TOLERANCE_PX) return 'left';
  const max = node.scrollWidth - node.clientWidth;
  return max > 0 && node.scrollLeft >= max - EDGE_TOLERANCE_PX ? 'right' : null;
}
export function edgeSwipeDirection(edge: Edge, dx: number, dy: number): Direction | null {
  if (Math.abs(dx) < EDGE_SWIPE_THRESHOLD_PX ||
      Math.abs(dx) <= Math.abs(dy) * 1.25) return null;
  if (edge === 'left' && dx > 0) return 'prev';
  if (edge === 'right' && dx < 0) return 'next';
  return null;
}
function columnAt(node: HTMLDivElement, days: number): number {
  return node.clientWidth > 0 ? node.scrollLeft * days / node.clientWidth : 0;
}
function scrollToSnap(node: HTMLDivElement, days: number) {
  const column = nearestZoomSnap(columnAt(node, days), days);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  node.scrollTo?.({
    left: column * node.clientWidth / days,
    behavior: reduceMotion ? 'instant' : 'smooth',
  });
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
  zoomDays, children, onZoomMount, onZoomScroll, onNavigate,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<Start | null>(null);
  const mouseStartRef = useRef<Start | null>(null);
  const suppressClickRef = useRef(false);
  const wheelRef = useRef({ last: -Infinity, direction: 0, distance: 0,
    edge: null as Edge, committed: false });

  useLayoutEffect(() => {
    if (viewportRef.current) onZoomMount?.(viewportRef.current, zoomDays);
  }, [onZoomMount, zoomDays]);

  const navigateOnRelease = (start: Start, x: number, y: number): boolean => {
    const direction = edgeSwipeDirection(start.edge, x - start.x, y - start.y);
    if (!direction || !onNavigate) return false;
    suppressClickRef.current = true;
    onNavigate(direction);
    return true;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const node = event.currentTarget;
    suppressClickRef.current = false;
    mouseStartRef.current = {
      x: event.clientX, y: event.clientY, scroll: node.scrollLeft,
      edge: edgeOf(node), pointerId: event.pointerId,
    };
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = mouseStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
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
  const finishMouse = (node: HTMLDivElement, x: number, y: number) => {
    const start = mouseStartRef.current;
    mouseStartRef.current = null;
    if (!start) return;
    node.style.scrollSnapType = 'x mandatory';
    if (!start.dragged) return;
    if (!navigateOnRelease(start, x, y)) scrollToSnap(node, zoomDays);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey ||
      event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) ||
      !target.parentElement?.matches('[role="gridcell"]')) return;
    const delta = event.key === 'ArrowRight' ? 1 :
      event.key === 'ArrowLeft' ? -1 :
      event.key === 'ArrowDown' ? 7 :
      event.key === 'ArrowUp' ? -7 : 0;
    if (delta === 0) return;
    const days = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="gridcell"] > button:not(:disabled)')];
    const next = days[days.indexOf(target) + delta];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    next.scrollIntoView?.({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  };

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Scrollable calendar weekdays"
      tabIndex={0}
      data-calendar-zoom-lane="true"
      data-zoom-days={zoomDays}
      className="max-w-full overflow-x-auto overscroll-x-contain"
      style={{ touchAction: 'auto', scrollSnapType: 'x mandatory', cursor: 'grab' }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        if (event.pointerType === 'mouse')
          finishMouse(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerCancel={() => {
        mouseStartRef.current = null;
        if (viewportRef.current) viewportRef.current.style.scrollSnapType = 'x mandatory';
      }}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchStart={(event) => {
        const node = event.currentTarget;
        const touch = event.touches[0];
        if (event.touches.length !== 1 || !touch) {
          touchStartRef.current = null;
          return;
        }
        suppressClickRef.current = false;
        touchStartRef.current = {
          x: touch.clientX, y: touch.clientY, scroll: node.scrollLeft, edge: edgeOf(node),
        };
      }}
      onTouchEnd={(event) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        const touch = event.changedTouches[0];
        if (start && touch) navigateOnRelease(start, touch.clientX, touch.clientY);
      }}
      onTouchCancel={() => { touchStartRef.current = null; }}
      onWheel={(event) => {
        if (!onNavigate || event.ctrlKey || event.metaKey || event.shiftKey ||
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
        if (event.target !== event.currentTarget &&
          event.target instanceof HTMLElement &&
          event.target.closest('[role="gridcell"]')) {
          event.target.scrollIntoView?.({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
      }}
      onScroll={(event) => onZoomScroll?.(event.currentTarget, zoomDays)}
    >
      <div className="relative" style={{ width: `${(7 / zoomDays) * 100}%` }}>
        {zoomSnapColumns(zoomDays).map((column) => (
          <span aria-hidden="true" key={column} style={{
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
