export type ZoomEdge = 'left' | 'right' | null;
export type ZoomDirection = 'prev' | 'next';
const EDGE_SWIPE_THRESHOLD_PX = 56;

// Final chunk overlaps with the previous page; no blank days at the edge.
export function zoomSnapColumns(days: number): number[] {
  return days === 3 ? [0, 3, 4] : [0, 3];
}
export function nearestZoomSnap(column: number, days: number): number {
  return zoomSnapColumns(days).reduce((best, position) =>
    Math.abs(position - column) < Math.abs(best - column) ? position : best, 0);
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
