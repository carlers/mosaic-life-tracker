import { useCallback, useEffect, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right';

export interface LongPressPointer {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}

export interface UseBubbleGesturesOptions {
  swipeDirection?: SwipeDirection;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
  onTripleTap?: () => void;
  onLongPress?: (pointer: LongPressPointer) => void;
  onSwipeReply?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  longPressThreshold?: number;
  doubleTapWindow?: number;
  swipeThreshold?: number;
  swipeMaxDistance?: number;
  deferTripleTap?: boolean;
}

export interface UseBubbleGesturesReturn {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  swipeOffset: number;
  isSwiping: boolean;
}

export function useBubbleGestures(
  options: UseBubbleGesturesOptions
): UseBubbleGesturesReturn {
  const {
    swipeDirection = 'right',
    onSingleTap,
    onDoubleTap,
    onTripleTap,
    onLongPress,
    onSwipeReply,
    onContextMenu,
    disabled = false,
    longPressThreshold = 500,
    doubleTapWindow = 300,
    swipeThreshold = 60,
    swipeMaxDistance = 100,
    deferTripleTap = false,
  } = options;

  const swipeSign = swipeDirection === 'right' ? 1 : -1;
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tripleTapFrameRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const tapCountRef = useRef(0);
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

  const clearTripleTapFrame = useCallback(() => {
    if (tripleTapFrameRef.current !== null) {
      cancelAnimationFrame(tripleTapFrameRef.current);
      tripleTapFrameRef.current = null;
    }
  }, []);

  const resetTapSequence = useCallback(() => {
    clearTapTimer();
    clearTripleTapFrame();
    lastTapRef.current = 0;
    tapCountRef.current = 0;
  }, [clearTapTimer, clearTripleTapFrame]);

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
      clearTripleTapFrame();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [clearTripleTapFrame]);

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
        // Pointer capture is optional.
      }
      const longPressPointer: LongPressPointer = {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        startPosRef.current = null;
        resetTapSequence();
        onLongPress?.(longPressPointer);
      }, longPressThreshold);
    },
    [disabled, clearLongPress, longPressThreshold, onLongPress, resetTapSequence]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || activePointerIdRef.current !== e.pointerId) return;
      const start = startPosRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
        clearLongPress();
        resetSwipe();
        startPosRef.current = null;
        return;
      }
      if (Math.abs(dx) > 8) clearLongPress();
      if (Math.abs(dx) > 8 && Math.sign(dx) !== swipeSign) {
        resetSwipe();
        startPosRef.current = null;
        return;
      }
      if (dx * swipeSign > 8) {
        isSwipingRef.current = true;
        const nextOffset = Math.min(Math.abs(dx), swipeMaxDistance) * swipeSign;
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

  const dispatchTap = useCallback(() => {
    const now = Date.now();
    if (onTripleTap) {
      tapCountRef.current =
        lastTapRef.current && now - lastTapRef.current < doubleTapWindow
          ? tapCountRef.current + 1
          : 1;
      lastTapRef.current = now;
      clearTapTimer();
      if (tapCountRef.current >= 3) {
        resetTapSequence();
        if (!deferTripleTap) {
          onTripleTap();
        } else {
          tripleTapFrameRef.current = requestAnimationFrame(() => {
            tripleTapFrameRef.current = null;
            onTripleTap();
          });
        }
        return;
      }
      tapTimerRef.current = setTimeout(() => {
        const count = tapCountRef.current;
        resetTapSequence();
        if (count === 2) onDoubleTap?.();
        else onSingleTap?.();
      }, doubleTapWindow);
      return;
    }

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
  }, [
    clearTapTimer,
    doubleTapWindow,
    deferTripleTap,
    onDoubleTap,
    onSingleTap,
    onTripleTap,
    resetTapSequence,
  ]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      clearLongPress();
      try {
        (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture.
      }
      const wasSwiping = isSwipingRef.current;
      const finalOffset = swipeOffsetRef.current;
      const hadStart = startPosRef.current !== null;
      startPosRef.current = null;

      if (wasSwiping) {
        resetTapSequence();
        if (Math.abs(finalOffset) >= swipeThreshold) {
          resetSwipe();
          onSwipeReply?.();
          return;
        }
        resetSwipe();
        return;
      }
      if (!hadStart) return;
      dispatchTap();
    },
    [
      clearLongPress,
      dispatchTap,
      onSwipeReply,
      resetSwipe,
      resetTapSequence,
      swipeThreshold,
    ]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      clearLongPress();
      resetSwipe();
      resetTapSequence();
      startPosRef.current = null;
    },
    [clearLongPress, resetSwipe, resetTapSequence]
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
