import React, {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PrimarySwipeDirection } from '../../lib/primarySwipeNavigation';

const DIRECTION_LOCK_DISTANCE = 8;
const HORIZONTAL_AXIS_RATIO = 1.15;
const MIN_COMMIT_DISTANCE = 64;
const COMMIT_VIEWPORT_RATIO = 0.18;
const RELEASE_DURATION_MS = 160;
const EDGE_RESISTANCE = 0.18;

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  dragging: boolean;
}

interface PrimaryRouteSwipeSurfaceProps {
  children: React.ReactNode;
  activeKey: string;
  homeZoneOnly?: boolean;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  onSwipe: (direction: PrimarySwipeDirection) => void;
}

export const PrimaryRouteSwipeSurface: React.FC<
  PrimaryRouteSwipeSurfaceProps
> = ({
  children,
  activeKey,
  homeZoneOnly = false,
  canSwipeLeft,
  canSwipeRight,
  onSwipe,
}) => {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingXRef = useRef(0);
  const releaseTimerRef = useRef<number | null>(null);
  const clickResetTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const applyTransform = useCallback((x: number) => {
    pendingXRef.current = x;
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const surface = surfaceRef.current;
      if (!surface) return;
      surface.style.transform = `translate3d(${pendingXRef.current}px, 0, 0)`;
    });
  }, []);

  const clearReleaseTimer = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  const resetSurface = useCallback((immediate = false) => {
    cancelFrame();
    clearReleaseTimer();
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.style.transition = immediate
      ? 'none'
      : `transform ${RELEASE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    surface.style.transform = 'translate3d(0, 0, 0)';
    if (!immediate) {
      releaseTimerRef.current = window.setTimeout(() => {
        const current = surfaceRef.current;
        if (current) current.style.transition = 'none';
        releaseTimerRef.current = null;
      }, RELEASE_DURATION_MS);
    }
  }, [cancelFrame, clearReleaseTimer]);

  useEffect(() => {
    gestureRef.current = null;
    suppressClickRef.current = false;
    resetSurface(true);
  }, [activeKey, resetSurface]);

  useEffect(
    () => () => {
      cancelFrame();
      clearReleaseTimer();
      if (clickResetTimerRef.current !== null) {
        window.clearTimeout(clickResetTimerRef.current);
      }
    },
    [cancelFrame, clearReleaseTimer]
  );

  const directionAllowed = useCallback(
    (direction: PrimarySwipeDirection) =>
      direction === 'left' ? canSwipeLeft : canSwipeRight,
    [canSwipeLeft, canSwipeRight]
  );

  const isEligibleStart = useCallback(
    (target: Element) => {
      if (!canSwipeLeft && !canSwipeRight) return false;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [data-route-swipe-ignore="true"], [data-bottom-sheet-native-horizontal-swipe], [data-bottom-sheet-directional-drag-handle]'
        )
      ) {
        return false;
      }
      if (homeZoneOnly) {
        return Boolean(
          target.closest('[data-route-swipe-zone="home-to-explore"]')
        );
      }
      return true;
    },
    [canSwipeLeft, canSwipeRight, homeZoneOnly]
  );

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      event.button !== 0 ||
      !isEligibleStart(event.target as Element)
    ) {
      gestureRef.current = null;
      return;
    }

    clearReleaseTimer();
    const surface = surfaceRef.current;
    if (surface) surface.style.transition = 'none';

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      dragging: false,
    };
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    gesture.currentX = event.clientX;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const distanceX = Math.abs(deltaX);
    const distanceY = Math.abs(deltaY);

    if (!gesture.dragging) {
      if (Math.max(distanceX, distanceY) < DIRECTION_LOCK_DISTANCE) return;
      if (distanceY > distanceX * HORIZONTAL_AXIS_RATIO) {
        gestureRef.current = null;
        return;
      }
      if (distanceX <= distanceY * HORIZONTAL_AXIS_RATIO) return;

      gesture.dragging = true;
      suppressClickRef.current = true;
      if ('setPointerCapture' in event.currentTarget) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is an optimization; the gesture can continue without it.
        }
      }
    }

    const direction: PrimarySwipeDirection = deltaX < 0 ? 'left' : 'right';
    const resistedDelta = directionAllowed(direction)
      ? deltaX
      : deltaX * EDGE_RESISTANCE;
    applyTransform(resistedDelta);
  };

  const finishGesture = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false
  ) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if ('releasePointerCapture' in event.currentTarget) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore browsers that already released capture.
      }
    }

    if (!gesture.dragging || cancelled) {
      resetSurface();
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const direction: PrimarySwipeDirection = deltaX < 0 ? 'left' : 'right';
    const surface = surfaceRef.current;
    const width = surface?.getBoundingClientRect().width || 360;
    const threshold = Math.max(
      MIN_COMMIT_DISTANCE,
      Math.min(96, width * COMMIT_VIEWPORT_RATIO)
    );

    if (!directionAllowed(direction) || Math.abs(deltaX) < threshold) {
      resetSurface();
    } else if (surface) {
      cancelFrame();
      clearReleaseTimer();
      surface.style.transition =
        `transform ${RELEASE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      surface.style.transform = `translate3d(${
        direction === 'left' ? -width : width
      }px, 0, 0)`;
      releaseTimerRef.current = window.setTimeout(() => {
        onSwipe(direction);
        const current = surfaceRef.current;
        if (current) {
          current.style.transition = 'none';
          current.style.transform = 'translate3d(0, 0, 0)';
        }
        releaseTimerRef.current = null;
      }, RELEASE_DURATION_MS);
    }

    if (clickResetTimerRef.current !== null) {
      window.clearTimeout(clickResetTimerRef.current);
    }
    clickResetTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      clickResetTimerRef.current = null;
    }, 300);
  };

  const customHorizontalOwner = (canSwipeLeft || canSwipeRight) && !homeZoneOnly;

  return (
    <div
      className="min-h-full w-full overflow-x-hidden"
      style={{ touchAction: customHorizontalOwner ? 'pan-y' : undefined }}
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={(event) => finishGesture(event)}
      onPointerCancelCapture={(event) => finishGesture(event, true)}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }}
    >
      <div
        ref={surfaceRef}
        data-testid="primary-route-swipe-surface"
        className="min-h-full w-full will-change-transform"
        style={{ transform: 'translate3d(0, 0, 0)' }}
      >
        {children}
      </div>
    </div>
  );
};
