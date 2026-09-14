import { useCallback, useRef } from 'react';

export interface UseLongPressOptions {
  /** Time in ms the pointer must be held before firing. Default: 500. */
  threshold?: number;
  /** Max movement (px) tolerated before the press is cancelled. Default: 10. */
  moveThreshold?: number;
}

export interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /**
   * Read-and-reset the "did the long-press just fire?" flag. Call this at
   * the top of your onClick handler to avoid double-firing the action.
   */
  consumeDidFire: () => boolean;
}

/**
 * Fires `callback` after the pointer has been held without moving for
 * `threshold` ms. Cancels automatically on movement, pointer-up, or pointer
 * leaving the element. Also intercepts right-click (contextmenu) so callers
 * can present their own menu on desktop.
 *
 * If the long-press already fired, the click handler that follows should
 * call `consumeDidFire()` to detect and short-circuit itself.
 */
export function useLongPress(
  callback: (e: React.PointerEvent | React.MouseEvent) => void,
  options: UseLongPressOptions = {}
): UseLongPressHandlers {
  const { threshold = 500, moveThreshold = 10 } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didFireRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      didFireRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        didFireRef.current = true;
        callback(e);
      }, threshold);
    },
    [callback, threshold, clearTimer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > moveThreshold) {
        clearTimer();
        startPosRef.current = null;
      }
    },
    [moveThreshold, clearTimer]
  );

  const cancel = useCallback(() => {
    clearTimer();
    startPosRef.current = null;
  }, [clearTimer]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      didFireRef.current = true;
      callback(e);
    },
    [callback]
  );

  const consumeDidFire = useCallback(() => {
    const fired = didFireRef.current;
    didFireRef.current = false;
    return fired;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu,
    consumeDidFire,
  };
}