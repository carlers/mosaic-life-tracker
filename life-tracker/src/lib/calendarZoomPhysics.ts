export type ZoomEdge = 'left' | 'right' | null;
export type ZoomDirection = 'prev' | 'next';
const EDGE_SWIPE_THRESHOLD_PX = 56;

// Each individual day is a snap target. The last legal position overlaps
// earlier columns, so the final visible page contains only real weekdays.
export function zoomSnapColumns(days: number): number[] {
  return Array.from({ length: 8 - days }, (_, day) => day);
}
export function nearestZoomSnap(column: number, days: number): number {
  return Math.min(7 - days, Math.max(0, Math.round(column)));
}
export function edgeSwipeDirection(
  edge: ZoomEdge, dx: number, dy: number,
): ZoomDirection | null {
  if (Math.abs(dx) < EDGE_SWIPE_THRESHOLD_PX ||
      Math.abs(dx) <= Math.abs(dy) * 1.25) return null;
  if (edge === 'left' && dx > 0) return 'prev';
  if (edge === 'right' && dx < 0) return 'next';
  return null;
}
