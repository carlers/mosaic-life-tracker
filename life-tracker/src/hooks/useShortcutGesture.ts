import { useEffect, useLayoutEffect, useRef } from 'react';
import type React from 'react';
import type { ShortcutGestureEngine, ShortcutGestureOptions } from '../lib/shortcutGestureEngine';

/** Inactive shortcuts do not add gesture code to Home's static asset closure.
 * The small engine is prefetched after opt-in and cached for immediate later swipes. */
export function useShortcutGesture(options: ShortcutGestureOptions) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => { optionsRef.current = options; });
  const engineRef = useRef<ShortcutGestureEngine | null>(null);

  useEffect(() => {
    let live = true;
    if (options.enabled) {
      void import('../lib/shortcutGestureEngine').then(({ createShortcutGestureEngine }) => {
        if (live) engineRef.current = createShortcutGestureEngine(() => optionsRef.current);
      }).catch(() => {});
    } else {
      engineRef.current = null;
    }
    return () => { live = false; engineRef.current = null; };
  }, [options.enabled]);

  return {
    onTouchStartCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { engineRef.current?.cancel(); return; }
      const touch = event.touches[0];
      engineRef.current?.start(touch.identifier, touch.clientX, touch.clientY, event.target, event.currentTarget);
    },
    onTouchMoveCapture: (event: React.TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) { engineRef.current?.cancel(); return; }
      engineRef.current?.move(event.touches[0].identifier);
    },
    onTouchEndCapture: (event: React.TouchEvent<HTMLElement>) => {
      const items = event.changedTouches;
      // A mismatched identifier cannot trigger; finish itself enforces ownership.
      if (items.length === 1) {
        const touch = items[0];
        engineRef.current?.finish(touch.identifier, touch.clientX, touch.clientY);
      } else engineRef.current?.cancel();
    },
    onTouchCancelCapture: () => { engineRef.current?.cancel(); },
    onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const accepted = engineRef.current?.start(
        event.pointerId, event.clientX, event.clientY, event.target, event.currentTarget
      );
      // Only nav buttons capture the pointer. Calendar/Day retain their own owners.
      if (accepted && !optionsRef.current.boundary) {
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* detached */ }
      }
    },
    onPointerMoveCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') engineRef.current?.move(event.pointerId);
    },
    onPointerUpCapture: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse') return;
      engineRef.current?.finish(event.pointerId, event.clientX, event.clientY);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch { /* released */ }
    },
    onPointerCancelCapture: () => { engineRef.current?.cancel(); },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (!engineRef.current?.suppressClick()) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
