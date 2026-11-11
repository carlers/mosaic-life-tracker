import { useRef } from 'react';
import type React from 'react';

type Direction = 'up' | 'down';
type Boundary = 'top' | 'bottom';
interface Options {
  enabled: boolean;
  direction: Direction;
  boundary?: Boundary;
  onTrigger: () => void;
  scrollOwner?: (target: Element, surface: HTMLElement) => HTMLElement | null;
  exclude?: string;
}

type Start = {
  identifier: number;
  x: number;
  y: number;
  scroll: HTMLElement | null;
  invalid: boolean;
};

const INPUT_EXCLUSIONS =
  'input, textarea, select, [contenteditable], [role="textbox"], [role="slider"], ' +
  '[data-bottom-sheet-drag-handle], [data-bottom-sheet-directional-drag-handle], ' +
  '[data-diary-drag-source], [data-calendar-zoom-lane], [data-category-drag-handle]';

const SCROLL_EPSILON = 2;
const MIN_SWIPE_DISTANCE = 72;
const DIRECTION_RATIO = 1.35;

/** No document-wide handlers, timers or gesture-frame React updates. */
export function useShortcutGesture(options: Options) {
  const sessionRef = useRef<Start | null>(null);
  const suppressClickUntilRef = useRef(0);

  const atBoundary = (scroll: HTMLElement | null) => {
    if (!scroll || !options.boundary) return true;
    const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    if (options.boundary === 'top') return scroll.scrollTop <= SCROLL_EPSILON;
    return scroll.scrollTop >= max - SCROLL_EPSILON;
  };

  const ownsVerticalScroll = (target: Element, owner: HTMLElement): boolean => {
    // A nested scroll area takes precedence even when the outer Calendar or
    // Day View happens to be at its own edge. Inspect only on gesture start.
    for (let node: Element | null = target; node && node !== owner; node = node.parentElement) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.scrollHeight - node.clientHeight <= SCROLL_EPSILON) continue;
      const overflow = window.getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return true;
    }
    return false;
  };

  const start = (id: number, x: number, y: number, target: EventTarget | null, surface: HTMLElement) => {
    // A fresh touch/tap must not inherit suppression from an earlier swipe.
    suppressClickUntilRef.current = 0;
    sessionRef.current = null;
    if (!options.enabled || !(target instanceof Element) ||
        target.closest(INPUT_EXCLUSIONS) || (options.exclude && target.closest(options.exclude))) return;
    // Keep child buttons/links as their own gesture owners. A bottom-nav
    // button can still own the gesture when it IS the registered surface.
    const interactive = target.closest('button, a[href], [role="button"]');
    if (interactive && interactive !== surface) return;
    const scroll = options.scrollOwner ? options.scrollOwner(target, surface) : (options.boundary ? surface : null);
    if (options.boundary && (!scroll || !scroll.contains(target) ||
        ownsVerticalScroll(target, scroll) || !atBoundary(scroll))) return;
    sessionRef.current = { identifier: id, x, y, scroll, invalid: false };
  };

  const move = (id: number) => {
    const state = sessionRef.current;
    if (state && state.identifier === id && !atBoundary(state.scroll)) state.invalid = true;
  };

  const finish = (id: number, x: number, y: number) => {
    const state = sessionRef.current;
    sessionRef.current = null;
    if (!options.enabled || !state || state.identifier !== id || state.invalid ||
        (state.scroll !== null && !state.scroll.isConnected) ||
        !atBoundary(state.scroll)) return;
    const dx = x - state.x;
    const dy = y - state.y;
    const along = options.direction === 'up' ? -dy : dy;
    if (along < MIN_SWIPE_DISTANCE || along < Math.abs(dx) * DIRECTION_RATIO) return;
    suppressClickUntilRef.current = Date.now() + 500;
    options.onTrigger();
  };

  return {
    onTouchStartCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { sessionRef.current = null; return; }
      const touch = event.touches[0];
      start(touch.identifier, touch.clientX, touch.clientY, event.target, event.currentTarget);
    },
    onTouchMoveCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { sessionRef.current = null; return; }
      move(event.touches[0].identifier);
    },
    onTouchEndCapture: (event: React.TouchEvent<HTMLElement>) => {
      const state = sessionRef.current;
      const touch = state && Array.from(event.changedTouches).find(t => t.identifier === state.identifier);
      if (touch) finish(touch.identifier, touch.clientX, touch.clientY);
      else sessionRef.current = null;
    },
    onTouchCancelCapture: () => { sessionRef.current = null; },
    onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      start(event.pointerId, event.clientX, event.clientY, event.target, event.currentTarget);
      // Mouse drags from the 64px nav need pointer-up after leaving the
      // button. Do not capture Calendar/Day pointers from existing owners.
      if (sessionRef.current?.identifier === event.pointerId && !options.boundary) {
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* detached */ }
      }
    },
    onPointerMoveCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') move(event.pointerId);
    },
    onPointerUpCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') {
        finish(event.pointerId, event.clientX, event.clientY);
        try {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch { /* released by browser */ }
      }
    },
    // A native touch pan often emits pointercancel before touchend. Touch
    // sessions belong to the touch lifecycle, not the mouse pointer lifecycle.
    onPointerCancelCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') sessionRef.current = null;
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (Date.now() > suppressClickUntilRef.current) return;
      suppressClickUntilRef.current = 0;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
