import type React from 'react';
import { createShortcutGestureEngine, type ShortcutGestureOptions } from './shortcutGestureEngine';

// React event props are reused by the nav and owned scroll surfaces.
// Only the optional dynamic chunk evaluates this gesture arbitration code.
export type ShortcutGestureHandlers = Required<Pick<React.DOMAttributes<HTMLElement>,
  | 'onTouchStartCapture'
  | 'onTouchMoveCapture'
  | 'onTouchEndCapture'
  | 'onPointerDownCapture'
  | 'onPointerMoveCapture'
  | 'onPointerUpCapture'
  | 'onPointerCancelCapture'
  | 'onClickCapture'
>> & { onTouchCancelCapture: () => void };

export function createShortcutGestureHandlers(
  getOptions: () => ShortcutGestureOptions,
): ShortcutGestureHandlers {
  const engine = createShortcutGestureEngine(getOptions);
  let nativeSurface: HTMLElement | null = null;
  let nativeMove: ((event: TouchEvent) => void) | null = null;
  const clearNativeMove = () => {
    if (nativeSurface && nativeMove) nativeSurface.removeEventListener('touchmove', nativeMove, true);
    nativeSurface = null;
    nativeMove = null;
  };
  return {
    onTouchStartCapture: (event: React.TouchEvent<HTMLElement>) => {
      clearNativeMove();
      if (event.touches.length !== 1) { engine.cancel(); return; }
      const touch = event.touches[0];
      const accepted = engine.start(touch.identifier, touch.clientX, touch.clientY, event.target, event.currentTarget);
      if (!accepted || !getOptions().allowCalendarDayCells) return;
      // React delegates touchmove passively, which cannot stop Safari's root
      // refresh when CSS overscroll containment is ignored. Install a
      // short-lived non-passive listener on this Calendar scroll owner only.
      // Native scrolling, pinch and horizontal month gestures remain untouched.
      nativeSurface = event.currentTarget;
      nativeMove = (move: TouchEvent) => {
        if (!move.cancelable || move.touches.length !== 1) return;
        const current = move.touches[0];
        if (engine.shouldContainNativeOverscroll(current.identifier, current.clientX, current.clientY)) {
          move.preventDefault();
        }
      };
      nativeSurface.addEventListener('touchmove', nativeMove, { capture: true, passive: false });
    },
    onTouchMoveCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { engine.cancel(); return; }
      engine.move(event.touches[0].identifier);
    },
    onTouchEndCapture: (event: React.TouchEvent<HTMLElement>) => {
      clearNativeMove();
      const items = event.changedTouches;
      // A mismatched identifier cannot trigger; finish itself enforces ownership.
      if (items.length === 1) {
        const touch = items[0];
        engine.finish(touch.identifier, touch.clientX, touch.clientY);
      } else engine.cancel();
    },
    onTouchCancelCapture: () => { clearNativeMove(); engine.cancel(); },
    onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const accepted = engine.start(
        event.pointerId, event.clientX, event.clientY, event.target, event.currentTarget
      );
      // Only nav buttons capture the pointer. Calendar/Day retain their own owners.
      if (accepted && !getOptions().boundary) {
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* detached */ }
      }
    },
    onPointerMoveCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') engine.move(event.pointerId);
    },
    onPointerUpCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse') return;
      engine.finish(event.pointerId, event.clientX, event.clientY);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch { /* released */ }
    },
    // A browser may issue pointercancel during a native touch scroll,
    // before touchend. The touch lifecycle alone owns touch cancellation.
    onPointerCancelCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') engine.cancel();
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (!engine.suppressClick()) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/** A single owned Calendar surface dispatches top/bottom intents through the
 * same nine capture callbacks. Only this opt-in chunk contains the fan-out. */
export function createCombinedShortcutGestureHandlers(
  primaryOptions: () => ShortcutGestureOptions,
  secondaryOptions: () => ShortcutGestureOptions,
): ShortcutGestureHandlers {
  const primary = createShortcutGestureHandlers(primaryOptions);
  const secondary = createShortcutGestureHandlers(secondaryOptions);
  return Object.fromEntries((Object.keys(primary) as (keyof ShortcutGestureHandlers)[]).map(key => [
    key,
    (event: React.SyntheticEvent<HTMLElement>) => {
      (primary[key] as unknown as (event: React.SyntheticEvent<HTMLElement>) => void)(event);
      (secondary[key] as unknown as (event: React.SyntheticEvent<HTMLElement>) => void)(event);
    },
  ])) as unknown as ShortcutGestureHandlers;
}
