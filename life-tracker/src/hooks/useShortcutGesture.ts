import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type React from 'react';
import type { ShortcutGestureOptions } from '../lib/shortcutGestureEngine';
import type { ShortcutGestureHandlers } from '../lib/shortcutGestureHandlers';

// The adapter is opt-in; only forwarding functions belong in the Home
// startup graph. The gesture factory (and engine) loads after opt-in.
const GESTURE_HANDLER_KEYS = [
  'onTouchStartCapture',
  'onTouchMoveCapture',
  'onTouchEndCapture',
  'onTouchCancelCapture',
  'onPointerDownCapture',
  'onPointerMoveCapture',
  'onPointerUpCapture',
  'onPointerCancelCapture',
  'onClickCapture',
] as const satisfies readonly (keyof ShortcutGestureHandlers)[];

export function useShortcutGesture(options: ShortcutGestureOptions): ShortcutGestureHandlers {
  const optionsRef = useRef(options);
  useLayoutEffect(() => { optionsRef.current = options; });
  const handlersRef = useRef<ShortcutGestureHandlers | null>(null);

  useEffect(() => {
    let live = true;
    if (options.enabled) {
      void import('../lib/shortcutGestureHandlers').then(({ createShortcutGestureHandlers }) => {
        if (live) handlersRef.current = createShortcutGestureHandlers(() => optionsRef.current);
      }).catch(() => { /* Normal controls remain available if optional chunk fails. */ });
    } else {
      handlersRef.current = null;
    }
    return () => { live = false; handlersRef.current = null; };
  }, [options.enabled]);

  // A ref-backed dispatch means no React renders on touch/pointer movement,
  // and the existing surface event props stay mounted through activation.
  return useMemo(() => Object.fromEntries(GESTURE_HANDLER_KEYS.map(key => [
    key,
    (event: React.SyntheticEvent<HTMLElement>) => {
      const handler = handlersRef.current?.[key] as
        ((event: React.SyntheticEvent<HTMLElement>) => void) | undefined;
      handler?.(event);
    },
  ])) as ShortcutGestureHandlers, []);
}
