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
  return {
    onTouchStartCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { engine.cancel(); return; }
      const touch = event.touches[0];
      engine.start(touch.identifier, touch.clientX, touch.clientY, event.target, event.currentTarget);
    },
    onTouchMoveCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { engine.cancel(); return; }
      engine.move(event.touches[0].identifier);
    },
    onTouchEndCapture: (event: React.TouchEvent<HTMLElement>) => {
      const items = event.changedTouches;
      // A mismatched identifier cannot trigger; finish itself enforces ownership.
      if (items.length === 1) {
        const touch = items[0];
        engine.finish(touch.identifier, touch.clientX, touch.clientY);
      } else engine.cancel();
    },
    onTouchCancelCapture: () => { engine.cancel(); },
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
