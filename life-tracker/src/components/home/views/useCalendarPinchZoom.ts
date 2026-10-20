import { useEffect, type RefObject } from 'react';
import type { CalendarZoomDays } from '../../../lib/preferences';

export function nextCalendarPinchMode(current: CalendarZoomDays, scale: number): CalendarZoomDays {
  if (!Number.isFinite(scale)) return current;
  if (scale >= 1.18) return current === 7 ? 4 : 3;
  if (scale <= 0.85) return current === 3 ? 4 : 7;
  return current;
}

interface Options {
  enabled: boolean;
  activeIndex: number;
  zoomDays: CalendarZoomDays;
  locked: boolean;
  onChange: (days: CalendarZoomDays, centerFraction: number) => void;
}

export function useCalendarPinchZoom(
  ref: RefObject<HTMLElement | null>,
  { enabled, activeIndex, zoomDays, locked, onChange }: Options
): void {
  useEffect(() => {
    const viewport = ref.current;
    if (!enabled || !viewport) return;
    let session: { initial: number; scale: number; center: number } | null = null;
    let clickGuardUntil = 0;
    const inActiveGrid = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !target.closest('[role="grid"]')) return false;
      const slide = target.closest<HTMLElement>('[data-calendar-slide-index]');
      return Boolean(slide) && Number(slide?.dataset.calendarSlideIndex) === activeIndex;
    };
    const distance = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 1) { clickGuardUntil = 0; return; }
      session = null;
      if (locked || e.touches.length !== 2) return;
      const a = e.touches.item(0);
      const b = e.touches.item(1);
      if (!a || !b || !inActiveGrid(a.target) || !inActiveGrid(b.target)) return;
      const initial = distance(a, b);
      const box = viewport.getBoundingClientRect();
      if (initial < 24 || box.width <= 0) return;
      session = {
        initial, scale: 1,
        center: Math.max(0, Math.min(1, ((a.clientX + b.clientX) / 2 - box.left) / box.width)),
      };
      // Opt-in Calendar grid only; never change app-wide touch-action or viewport zoom.
      if (e.cancelable) e.preventDefault();
    };
    const move = (e: TouchEvent) => {
      if (!session) return;
      if (locked || e.touches.length !== 2) { session = null; return; }
      const a = e.touches.item(0);
      const b = e.touches.item(1);
      if (!a || !b) { session = null; return; }
      session.scale = distance(a, b) / session.initial;
      if (e.cancelable) e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      if (!session || e.touches.length >= 2) return;
      const completed = session;
      session = null;
      if (locked) return;
      const next = nextCalendarPinchMode(zoomDays, completed.scale);
      if (next === zoomDays) return;
      clickGuardUntil = Date.now() + 700;
      onChange(next, completed.center);
    };
    const cancel = () => { session = null; };
    const webkitStart = (e: Event) => {
      if (!locked && inActiveGrid(e.target) && e.cancelable) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      if (Date.now() > clickGuardUntil || !inActiveGrid(e.target)) return;
      clickGuardUntil = 0;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    viewport.addEventListener('touchstart', start, { passive: false });
    viewport.addEventListener('touchmove', move, { passive: false });
    viewport.addEventListener('touchend', end);
    viewport.addEventListener('touchcancel', cancel);
    viewport.addEventListener('gesturestart', webkitStart, { passive: false });
    viewport.addEventListener('click', click, true);
    return () => {
      viewport.removeEventListener('touchstart', start);
      viewport.removeEventListener('touchmove', move);
      viewport.removeEventListener('touchend', end);
      viewport.removeEventListener('touchcancel', cancel);
      viewport.removeEventListener('gesturestart', webkitStart);
      viewport.removeEventListener('click', click, true);
    };
  }, [ref, enabled, activeIndex, zoomDays, locked, onChange]);
}
