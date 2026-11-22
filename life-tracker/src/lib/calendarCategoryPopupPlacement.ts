export interface PopupPlacement {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/** Anchor outside Calendar's clipped scrollers, keeping the whole container on-screen. */
export function placeCalendarCategoryPopup(
  rect: Pick<DOMRect, 'top' | 'bottom' | 'right'>,
  count: number,
  viewport: { left: number; top: number; width: number; height: number },
  layoutHeight: number
): PopupPlacement {
  const inset = 8;
  const gap = 6;
  const width = Math.max(0, Math.min(288, viewport.width - inset * 2));
  const right = viewport.left + viewport.width;
  const bottom = viewport.top + viewport.height;
  const left = Math.max(viewport.left + inset,
    Math.min(rect.right + 72 - width, right - inset - width));
  const below = Math.max(0, bottom - rect.bottom - gap - inset);
  const above = Math.max(0, rect.top - viewport.top - gap - inset);
  const needed = Math.min(448, 100 + (count + 1) * 40);
  const placeBelow = below >= needed || below >= above;
  const maxHeight = Math.floor(Math.min(448, placeBelow ? below : above));
  return placeBelow
    ? { left, width, maxHeight, top: rect.bottom + gap }
    : { left, width, maxHeight, bottom: layoutHeight - rect.top + gap };
}

