export const ROUTE_SWIPE_MIN_FLICK_DISTANCE_PX = 28;
export const ROUTE_SWIPE_FLICK_VELOCITY_PX_PER_MS = 0.5;
const ROUTE_SWIPE_MIN_SETTLE_MS = 100;
const ROUTE_SWIPE_MAX_SETTLE_MS = 180;
const ROUTE_SWIPE_BASE_SETTLE_SPEED_PX_PER_MS = 1.6;

export function shouldCommitRouteSwipe(
  distancePx: number,
  distanceThresholdPx: number,
  velocityTowardDestinationPxPerMs: number
): boolean {
  if (distancePx >= distanceThresholdPx) return true;
  return (
    distancePx >= ROUTE_SWIPE_MIN_FLICK_DISTANCE_PX &&
    velocityTowardDestinationPxPerMs >=
      ROUTE_SWIPE_FLICK_VELOCITY_PX_PER_MS
  );
}

export function resolveRouteSwipeSettleDuration(
  surfaceWidthPx: number,
  distancePx: number,
  velocityPxPerMs: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;

  const remainingDistance = Math.max(0, surfaceWidthPx - distancePx);
  const effectiveSpeed = Math.max(
    Math.abs(velocityPxPerMs),
    ROUTE_SWIPE_BASE_SETTLE_SPEED_PX_PER_MS
  );
  const duration = remainingDistance / effectiveSpeed;
  return Math.round(
    Math.min(
      ROUTE_SWIPE_MAX_SETTLE_MS,
      Math.max(ROUTE_SWIPE_MIN_SETTLE_MS, duration)
    )
  );
}

export function prefersReducedRouteMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
