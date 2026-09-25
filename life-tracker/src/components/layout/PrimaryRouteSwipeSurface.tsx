import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
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
  homeZoneOnly?: boolean;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  leftPreview?: React.ReactNode;
  rightPreview?: React.ReactNode;
  onSwipe: (direction: PrimarySwipeDirection) => void;
}

export const PrimaryRouteSwipeSurface: React.FC<
  PrimaryRouteSwipeSurfaceProps
> = ({
  children,
  homeZoneOnly = false,
  canSwipeLeft,
  canSwipeRight,
  leftPreview = null,
  rightPreview = null,
  onSwipe,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const currentPanelRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingXRef = useRef(0);
  const releaseTimerRef = useRef<number | null>(null);
  const clickResetTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const previewDirectionRef = useRef<PrimarySwipeDirection | null>(null);
  const [previewDirection, setPreviewDirection] =
    useState<PrimarySwipeDirection | null>(null);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const applyOffset = useCallback((x: number) => {
    pendingXRef.current = x;
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      trackRef.current?.style.setProperty('--route-swipe-x', `${pendingXRef.current}px`);
    });
  }, []);

  const setTransition = useCallback((value: string) => {
    if (currentPanelRef.current) {
      currentPanelRef.current.style.transition = value;
    }
    if (previewPanelRef.current) {
      previewPanelRef.current.style.transition = value;
    }
  }, []);

  const clearReleaseTimer = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  const hidePreview = useCallback(() => {
    previewDirectionRef.current = null;
    setPreviewDirection(null);
  }, []);

  const resetSurface = useCallback(
    (immediate = false) => {
      cancelFrame();
      clearReleaseTimer();
      const transition = immediate
        ? 'none'
        : `transform ${RELEASE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      setTransition(transition);
      trackRef.current?.style.setProperty('--route-swipe-x', '0px');
      pendingXRef.current = 0;

      if (immediate) {
        hidePreview();
        return;
      }

      releaseTimerRef.current = window.setTimeout(() => {
        setTransition('none');
        hidePreview();
        releaseTimerRef.current = null;
      }, RELEASE_DURATION_MS);
    },
    [cancelFrame, clearReleaseTimer, hidePreview, setTransition]
  );

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

  const previewForDirection = useCallback(
    (direction: PrimarySwipeDirection) =>
      direction === 'left' ? leftPreview : rightPreview,
    [leftPreview, rightPreview]
  );

  const showPreviewForDirection = useCallback(
    (direction: PrimarySwipeDirection) => {
      if (!directionAllowed(direction) || !previewForDirection(direction)) {
        return;
      }
      if (previewDirectionRef.current === direction) return;
      previewDirectionRef.current = direction;
      setPreviewDirection(direction);
    },
    [directionAllowed, previewForDirection]
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isEligibleStart(event.target as Element)) {
      gestureRef.current = null;
      return;
    }

    clearReleaseTimer();
    setTransition('none');
    if (previewDirectionRef.current) hidePreview();

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    if (directionAllowed(direction)) {
      showPreviewForDirection(direction);
    }

    const resistedDelta = directionAllowed(direction)
      ? deltaX
      : deltaX * EDGE_RESISTANCE;
    applyOffset(resistedDelta);
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
    const currentPanel = currentPanelRef.current;
    const width = currentPanel?.getBoundingClientRect().width || 360;
    const threshold = Math.max(
      MIN_COMMIT_DISTANCE,
      Math.min(96, width * COMMIT_VIEWPORT_RATIO)
    );

    if (!directionAllowed(direction) || Math.abs(deltaX) < threshold) {
      resetSurface();
    } else {
      cancelFrame();
      clearReleaseTimer();
      const transition =
        `transform ${RELEASE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      setTransition(transition);
      const targetX = direction === 'left' ? -width : width;
      trackRef.current?.style.setProperty('--route-swipe-x', `${targetX}px`);
      pendingXRef.current = targetX;

      releaseTimerRef.current = window.setTimeout(() => {
        onSwipe(direction);
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

  const customHorizontalOwner =
    (canSwipeLeft || canSwipeRight) && !homeZoneOnly;
  const heightClass = homeZoneOnly
    ? 'h-full min-h-0'
    : 'min-h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]';
  const previewNode =
    previewDirection === 'left' ? leftPreview : rightPreview;
  const previewTransform =
    previewDirection === 'left'
      ? 'translate3d(calc(100% + var(--route-swipe-x, 0px)), 0, 0)'
      : 'translate3d(calc(-100% + var(--route-swipe-x, 0px)), 0, 0)';

  return (
    <div
      ref={trackRef}
      className={`relative w-full overflow-x-clip ${heightClass}`}
      style={{
        touchAction: customHorizontalOwner ? 'pan-y' : undefined,
        '--route-swipe-x': '0px',
      } as React.CSSProperties}
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
        ref={currentPanelRef}
        data-testid="primary-route-swipe-surface"
        className={`w-full will-change-transform ${heightClass}`}
        style={{
          transform: 'translate3d(var(--route-swipe-x, 0px), 0, 0)',
        }}
      >
        {children}
      </div>

      {previewDirection && previewNode ? (
        <div
          ref={previewPanelRef}
          data-testid="primary-route-neighbor-preview"
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-y-0 left-0 w-full will-change-transform"
          style={{ transform: previewTransform, contain: 'layout paint' }}
        >
          <div className="sticky top-0 h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] overflow-hidden bg-[#111111]">
            {previewNode}
          </div>
        </div>
      ) : null}
    </div>
  );
};
