/** Recognize two-finger pinch changes without conflating ordinary one-finger scrolling. */
export function reviewTouchDistance(touches: ArrayLike<Pick<Touch, 'clientX' | 'clientY'>>): number {
  if (touches.length !== 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/** Pinch inward shows all three stages; pinch outward returns to a stage. */
export function reviewPinchIntent(
  initialDistance: number, finalDistance: number, isOverview: boolean,
): 'overview' | 'focus' | null {
  if (!Number.isFinite(initialDistance) || initialDistance < 40 ||
      !Number.isFinite(finalDistance)) return null;
  const ratio = finalDistance / initialDistance;
  if (!isOverview && ratio <= 0.78) return 'overview';
  if (isOverview && ratio >= 1.22) return 'focus';
  return null;
}
