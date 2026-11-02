export type TourBounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
export interface TourPosition { left: number; top: number; side: 'top' | 'bottom' | 'left' | 'right' | 'fallback' }

const EDGE = 12;
const GAP = 16;
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));

/** Keep the guide inside the viewport and outside the highlighted control whenever space permits. */
export function positionTourGuide(
  anchor: TourBounds | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): TourPosition {
  const w = Math.min(card.width, viewport.width - EDGE * 2);
  const h = Math.min(card.height, viewport.height - EDGE * 2);
  const x = (value: number) => clamp(value, EDGE, viewport.width - w - EDGE);
  const y = (value: number) => clamp(value, EDGE, viewport.height - h - EDGE);
  if (!anchor) return { left: x((viewport.width - w) / 2), top: y(viewport.height - h - 16), side: 'fallback' };
  const cy = anchor.top + anchor.height / 2;
  const cx = anchor.left + anchor.width / 2;
  const right = viewport.width - anchor.right;
  const left = anchor.left;
  const top = anchor.top;
  const bottom = viewport.height - anchor.bottom;
  // Prefer a side for wide desktop canvases; on phones use the free vertical space.
  if (viewport.width >= 650 && right >= w + GAP + EDGE) {
    return { left: x(anchor.right + GAP), top: y(cy - h / 2), side: 'right' };
  }
  if (viewport.width >= 650 && left >= w + GAP + EDGE) {
    return { left: x(anchor.left - GAP - w), top: y(cy - h / 2), side: 'left' };
  }
  if (bottom >= h + GAP + EDGE) {
    return { left: x(cx - w / 2), top: y(anchor.bottom + GAP), side: 'bottom' };
  }
  if (top >= h + GAP + EDGE) {
    return { left: x(cx - w / 2), top: y(anchor.top - GAP - h), side: 'top' };
  }
  // No fit (very small viewport/large control): select the side with the
  // least overlap, then clamp to the safe viewport.
  return bottom >= top
    ? { left: x(cx - w / 2), top: y(anchor.bottom + GAP), side: 'bottom' }
    : { left: x(cx - w / 2), top: y(anchor.top - GAP - h), side: 'top' };
}
