import { useCallback, useEffect, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right';

export interface UseBubbleGesturesOptions {
  /** Which direction is a valid "reply" swipe. */
  swipeDirection?: SwipeDirection;
  /** Fires on tap when no double-tap follows within the window. */
  onSingleTap?: () => void;
  /** Fires when two taps occur within the double-tap window. */
  onDoubleTap?: () => void;
  /** Fires after holding still for `longPressThreshold` ms. */
  onLongPress?: () => void;
  /** Fires when a valid reply swipe is released past threshold. */
  onSwipeReply?: () => void;
  /** Desktop right-click handler. */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** When true, all gestures are disabled. */
  disabled?: boolean;
  longPressThreshold?: number;
  doubleTapWindow?: number;
  swipeThreshold?: number;
  swipeMaxDistance?: number;
}

export interface UseBubbleGesturesReturn {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** Signed offset of the current swipe (0 when idle). */
  swipeOffset: number;
  /** True while the user is actively swiping horizontally. */
  isSwiping: boolean;
}

export function useBubbleGestures(
  options: UseBubbleGesturesOptions
): UseBubbleGesturesReturn {
  const {
    swipeDirection = 'right',
    onSingleTap,
    onDoubleTap,
    onLongPress,
    onSwipeReply,
    onContextMenu,
    disabled = false,
    longPressThreshold = 500,
    doubleTapWindow = 300,
    swipeThreshold = 60,
    swipeMaxDistance = 100,
  } = options;

  const swipeSign = swipeDirection === 'right' ? 1 : -1;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const isSwipingRef = useRef(false);
  const swipeOffsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<number | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearTapTimer = useCallback(() => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  }, []);

  const resetSwipe = useCallback(() => {
    isSwipingRef.current = false;
    swipeOffsetRef.current = 0;
    pendingOffsetRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsSwiping(false);
    setSwipeOffset(0);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (activePointerIdRef.current !== null) return;

      activePointerIdRef.current = e.pointerId;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      clearLongPress();

      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        startPosRef.current = null;
        onLongPress?.();
      }, longPressThreshold);
    },
    [disabled, clearLongPress, longPressThreshold, onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (activePointerIdRef.current !== e.pointerId) return;
      const start = startPosRef.current;
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      // Vertical dominant: hand off to native scroll.
      if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
        clearLongPress();
        resetSwipe();
        startPosRef.current = null;
        return;
      }

      // Any meaningful horizontal movement kills the long-press.
      if (Math.abs(dx) > 8) clearLongPress();

      // Wrong direction: abort.
      if (Math.abs(dx) > 8 && Math.sign(dx) !== swipeSign) {
        resetSwipe();
        return;
      }

      // Correct direction: enter swipe.
      if (dx * swipeSign > 8) {
        isSwipingRef.current = true;
        const magnitude = Math.min(Math.abs(dx), swipeMaxDistance);
        const nextOffset = magnitude * swipeSign;
        swipeOffsetRef.current = nextOffset;
        pendingOffsetRef.current = nextOffset;
        setIsSwiping(true);
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingOffsetRef.current !== null) {
              setSwipeOffset(pendingOffsetRef.current);
              pendingOffsetRef.current = null;
            }
          });
        }
      }
    },
    [disabled, clearLongPress, resetSwipe, swipeSign, swipeMaxDistance]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      clearLongPress();

      try {
        (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }

      const wasSwiping = isSwipingRef.current;
      const finalOffset = swipeOffsetRef.current;
      const hadStart = startPosRef.current !== null;
      startPosRef.current = null;

      if (wasSwiping) {
        if (Math.abs(finalOffset) >= swipeThreshold) {
          resetSwipe();
          onSwipeReply?.();
          return;
        }
        resetSwipe();
        return;
      }

      if (!hadStart) return;

      const now = Date.now();
      if (now - lastTapRef.current < doubleTapWindow) {
        clearTapTimer();
        lastTapRef.current = 0;
        onDoubleTap?.();
      } else {
        lastTapRef.current = now;
        clearTapTimer();
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          lastTapRef.current = 0;
          onSingleTap?.();
        }, doubleTapWindow);
      }
    },
    [
      clearLongPress,
      clearTapTimer,
      resetSwipe,
      swipeThreshold,
      doubleTapWindow,
      onSwipeReply,
      onDoubleTap,
      onSingleTap,
    ]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      clearLongPress();
      resetSwipe();
      startPosRef.current = null;
    },
    [clearLongPress, resetSwipe]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      onContextMenu?.(e);
    },
    [disabled, onContextMenu]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu: handleContextMenu,
    swipeOffset,
    isSwiping,
  };
}