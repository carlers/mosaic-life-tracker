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

export function useShortcutGesture(
  options: ShortcutGestureOptions,
  secondary?: ShortcutGestureOptions,
): ShortcutGestureHandlers {
  const optionsRef = useRef({ primary: options, secondary });
  useLayoutEffect(() => { optionsRef.current = { primary: options, secondary }; });
  const handlersRef = useRef<ShortcutGestureHandlers | null>(null);

  const enabled = options.enabled || secondary?.enabled === true;
  const paired = Boolean(secondary);
  useEffect(() => {
    let live = true;
    if (enabled) {
      void import('../lib/shortcutGestureHandlers').then((module) => {
        if (!live) return;
        handlersRef.current = paired
          ? module.createCombinedShortcutGestureHandlers(
            () => optionsRef.current.primary,
            () => optionsRef.current.secondary!,
          )
          : module.createShortcutGestureHandlers(() => optionsRef.current.primary);
      }).catch(() => { /* Normal controls remain available if optional chunk fails. */ });
    } else {
      handlersRef.current = null;
    }
    return () => { live = false; handlersRef.current = null; };
  }, [enabled, paired]);

  // A ref-backed dispatch means no React renders on touch/pointer movement,
  // and the existing surface event props stay mounted through activation.
  return useMemo(() => Object.fromEntries(GESTURE_HANDLER_KEYS.map(key => [
    key,
    (event: React.SyntheticEvent<HTMLElement>) => {
      const handler = handlersRef.current?.[key] as
        ((event: React.SyntheticEvent<HTMLElement>) => void) | undefined;
      handler?.(event);
    },
  ])) as unknown as ShortcutGestureHandlers, []);
}
