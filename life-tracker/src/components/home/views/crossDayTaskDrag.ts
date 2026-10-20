import { addDays, format, parseISO } from 'date-fns';

/** Horizontal exit keeps the same edge armed while the held pointer stays at Day View height. */
export function dragEdgeDirection(
  x: number,
  y: number,
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width'>,
): -1 | 0 | 1 {
  if (!Number.isFinite(x) || !Number.isFinite(y) ||
      y < rect.top || y > rect.bottom) return 0;
  const band = Math.min(56, Math.max(24, rect.width * 0.11));
  if (x <= rect.left + band) return -1;
  if (x >= rect.right - band) return 1;
  return 0;
}

export function adjacentCalendarDate(date: string, direction: -1 | 1): string {
  return format(addDays(parseISO(date), direction), 'yyyy-MM-dd');
}

/** Clamp to the destination's live list, including empty categories. */
export function clampTaskInsertIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Number.isFinite(index) ? Math.trunc(index) : length, length));
}
