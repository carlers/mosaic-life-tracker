import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PrimarySwipeDirection } from '../../lib/primarySwipeNavigation';
import {
  prefersReducedRouteMotion,
  resolveRouteSwipeSettleDuration,
  shouldCommitRouteSwipe,
} from './routeSwipeMotion';

const DIRECTION_LOCK_DISTANCE = 8;
const HORIZONTAL_AXIS_RATIO = 1.15;
const MIN_COMMIT_DISTANCE = 64;
const COMMIT_VIEWPORT_RATIO = 0.18;
const RELEASE_DURATION_MS = 160;
const EDGE_RESISTANCE = 0.18;
const EDGE_BACK_ACTIVATION_PX = 32;
// WheelEvent has no reliable finger-lift phase. Do not mistake a short
// low-delta gap in a live trackpad gesture for release.
const TRACKPAD_IDLE_MS = 280;
let trackpadCooldownUntil = 0;

export type RouteSwipeActivationMode = 'full' | 'home-zone' | 'edge-back';

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  dragging: boolean;
}

interface PrimaryRouteSwipeSurfaceProps {
  children: React.ReactNode;
  homeZoneOnly?: boolean;
  activationMode?: RouteSwipeActivationMode;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  leftPreview?: React.ReactNode;
  rightPreview?: React.ReactNode;
  onSwipe: (direction: PrimarySwipeDirection) => void;
  fullHeight?: boolean;
}

export const PrimaryRouteSwipeSurface: React.FC<
  PrimaryRouteSwipeSurfaceProps
> = ({
  children,
  homeZoneOnly = false,
  activationMode,
  canSwipeLeft,
  canSwipeRight,
  leftPreview = null,
  rightPreview = null,
  onSwipe,
  fullHeight = false,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const currentPanelRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const wheelRef = useRef<{ direction: PrimarySwipeDirection; distance: number; timer: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingXRef = useRef(0);
  const releaseTimerRef = useRef<number | null>(null);
  const clickResetTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const previewDirectionRef = useRef<PrimarySwipeDirection | null>(null);
  const [previewDirection, setPreviewDirection] =
    useState<PrimarySwipeDirection | null>(null);
  const resolvedActivationMode: RouteSwipeActivationMode =
    activationMode ?? (homeZoneOnly ? 'home-zone' : 'full');

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
      const reducedMotion = prefersReducedRouteMotion();
      const transition = immediate || reducedMotion
        ? 'none'
        : `transform ${RELEASE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      setTransition(transition);
      trackRef.current?.style.setProperty('--route-swipe-x', '0px');
      pendingXRef.current = 0;

      if (immediate || reducedMotion) {
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
      if (wheelRef.current) window.clearTimeout(wheelRef.current.timer);
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
    (target: Element, clientX: number, surfaceLeft: number) => {
      if (!canSwipeLeft && !canSwipeRight) return false;

      const hardGestureOwner = target.closest(
        'input, textarea, select, [contenteditable="true"], [data-bottom-sheet-native-horizontal-swipe], [data-bottom-sheet-directional-drag-handle]'
      );
      if (hardGestureOwner) return false;

      const routeIgnored = target.closest('[data-route-swipe-ignore="true"]');
      const replyableMessageBubble = target.closest('[data-message-id]');

      if (resolvedActivationMode === 'edge-back') {
        if (routeIgnored && !replyableMessageBubble) return false;
        const edgeOffset = clientX - surfaceLeft;
        return (
          canSwipeRight &&
          edgeOffset >= 0 &&
          edgeOffset <= EDGE_BACK_ACTIVATION_PX
        );
      }

      if (routeIgnored) {
        return false;
      }
      if (resolvedActivationMode === 'home-zone') {
        return Boolean(
          target.closest('[data-route-swipe-zone="home-to-explore"]')
        );
      }
      return true;
    },
    [canSwipeLeft, canSwipeRight, resolvedActivationMode]
  );

  // Both pointer drags and trackpad deltas settle through the same compositor transition.
  const settleSwipe = (
    direction: PrimarySwipeDirection,
    distance: number,
    velocityX: number
  ): boolean => {
    const width = currentPanelRef.current?.getBoundingClientRect().width || 360;
    const threshold = Math.max(MIN_COMMIT_DISTANCE, Math.min(96, width * COMMIT_VIEWPORT_RATIO));
    const towardDestination = direction === 'right' ? velocityX : -velocityX;
    if (!directionAllowed(direction) ||
      !shouldCommitRouteSwipe(distance, threshold, towardDestination)) {
      resetSurface();
      return false;
    }
    cancelFrame();
    clearReleaseTimer();
    const duration = resolveRouteSwipeSettleDuration(
      width, distance, velocityX, prefersReducedRouteMotion()
    );
    setTransition(duration === 0
      ? 'none'
      : `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`);
    const targetX = direction === 'left' ? -width : width;
    trackRef.current?.style.setProperty('--route-swipe-x', `${targetX}px`);
    pendingXRef.current = targetX;
    if (duration === 0) {
      onSwipe(direction);
    } else {
      releaseTimerRef.current = window.setTimeout(() => {
        onSwipe(direction);
        releaseTimerRef.current = null;
      }, duration);
    }
    return true;
  };

  // Pixel-mode, predominantly horizontal wheel bursts are produced by desktop
  // trackpads. Native scrollers, carousels, editors and route edge rules win.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.cancelable || event.defaultPrevented || gestureRef.current ||
        event.deltaMode !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        Math.abs(event.deltaX) < 0.1) return;
      const target = event.target;
      if (!(target instanceof Element) ||
        document.getElementById('root')?.inert ||
        !isEligibleStart(target, event.clientX, track.getBoundingClientRect().left)) return;
      for (let node: Element | null = target; node && node !== track; node = node.parentElement) {
        if (node.matches('.swiper, .embla, [data-route-swipe-horizontal-owner]')) return;
        if (node.scrollWidth > node.clientWidth + 1 &&
          /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
      }
      const previous = wheelRef.current;
      const horizontalDominant =
        Math.abs(event.deltaX) >= 1 &&
        Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.35;
      // Small low-energy trailing deltas still belong to the current wheel
      // session, but new gestures must establish deliberate horizontal intent.
      if (!horizontalDominant && (!previous ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 0.5)) return;

      const direction: PrimarySwipeDirection =
        !horizontalDominant && previous
          ? previous.direction
          : event.deltaX > 0 ? 'left' : 'right';
      if (!directionAllowed(direction)) return;
      event.preventDefault();
      if (Date.now() < trackpadCooldownUntil) return;

      if (previous?.direction !== direction) {
        if (previous) {
          window.clearTimeout(previous.timer);
          resetSurface(true);
        }
        wheelRef.current = { direction, distance: 0, timer: 0 };
        setTransition('none');
        showPreviewForDirection(direction);
      }
      const gesture = wheelRef.current!;
      if (horizontalDominant) gesture.distance += Math.abs(event.deltaX);
      const width = currentPanelRef.current?.getBoundingClientRect().width || 360;
      applyOffset((direction === 'left' ? -1 : 1) * Math.min(gesture.distance, width * 0.85));
      window.clearTimeout(gesture.timer);
      gesture.timer = window.setTimeout(() => {
        if (wheelRef.current !== gesture) return;
        wheelRef.current = null;
        if (settleSwipe(direction, gesture.distance, 0)) {
          // Prevent inertia after a route change from skipping another page.
          trackpadCooldownUntil = Date.now() + 750;
        }
      }, TRACKPAD_IDLE_MS);
    };
    track.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      track.removeEventListener('wheel', handleWheel);
    };
  }, [applyOffset, directionAllowed, isEligibleStart, resetSurface, setTransition, showPreviewForDirection]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const surfaceLeft = event.currentTarget.getBoundingClientRect().left;
    if (
      event.button !== 0 ||
      !isEligibleStart(event.target as Element, event.clientX, surfaceLeft)
    ) {
      gestureRef.current = null;
      return;
    }

    if (resolvedActivationMode === 'edge-back') {
      // Capture owns an accepted edge-back from the first pointer event so
      // nested bubble reply recognizers cannot start on the same pointer.
      event.stopPropagation();
    }

    clearReleaseTimer();
    setTransition('none');
    if (previewDirectionRef.current) hidePreview();

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

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
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is an optimization; the gesture can continue without it.
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

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that lack or already released capture.
    }

    if (!gesture.dragging || cancelled) {
      resetSurface();
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const elapsed = Math.max(1, event.timeStamp - gesture.startTime);
    const velocityX = deltaX / elapsed;
    const direction: PrimarySwipeDirection = deltaX < 0 ? 'left' : 'right';
    settleSwipe(direction, Math.abs(deltaX), velocityX);

    if (clickResetTimerRef.current !== null) {
      window.clearTimeout(clickResetTimerRef.current);
    }
    clickResetTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      clickResetTimerRef.current = null;
    }, 300);
  };

  const customHorizontalOwner =
    (canSwipeLeft || canSwipeRight) &&
    resolvedActivationMode !== 'home-zone';
  const heightClass = fullHeight || resolvedActivationMode === 'home-zone'
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
          <div
            className={`sticky top-0 ${
              fullHeight
                ? 'h-full'
                : 'h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))]'
            } overflow-hidden bg-[#111111]`}
          >
            {previewNode}
          </div>
        </div>
      ) : null}
    </div>
  );
};
