/**
 * Fixed geometry for one category drag. DOM rows remain in their original
 * order until drop; preview displacements are CSS transforms only.
 */
export interface CategoryDragGeometry {
  id: string;
  top: number;
  bottom: number;
  headerCenter: number;
}

/** Hysteresis on cached header midpoints prevents targets chasing FLIP rows. */
export const nextCategoryDragIndex = (
  rows: readonly CategoryDragGeometry[], sourceIndex: number,
  currentIndex: number, pointerY: number, hysteresis = 6
): number => {
  if (sourceIndex < 0 || sourceIndex >= rows.length) return currentIndex;
  let to = currentIndex;
  if (to === sourceIndex) {
    // The first boundary decides which direction to enter, otherwise the
    // source slot would be locked against upward/reverse drags.
    if (to + 1 < rows.length && pointerY >= rows[to + 1].headerCenter + hysteresis) {
      while (to + 1 < rows.length &&
        pointerY >= rows[to + 1].headerCenter + hysteresis) to++;
    } else {
      while (to > 0 && pointerY < rows[to - 1].headerCenter - hysteresis) to--;
    }
  } else if (to > sourceIndex) {
    while (to + 1 < rows.length &&
      pointerY >= rows[to + 1].headerCenter + hysteresis) to++;
    while (to > sourceIndex && pointerY < rows[to].headerCenter - hysteresis) to--;
  } else {
    while (to > 0 && pointerY < rows[to - 1].headerCenter - hysteresis) to--;
    while (to < sourceIndex && pointerY > rows[to].headerCenter + hysteresis) to++;
  }
  return to;
};

/** Final logical order. This must only reach React and persistence on drop. */
export const categoryDragOrder = (
  rows: readonly CategoryDragGeometry[], sourceIndex: number, to: number
): string[] => {
  const order = rows.map(row => row.id);
  if (sourceIndex < 0 || sourceIndex >= order.length || to < 0 || to >= order.length)
    return order;
  order.splice(to, 0, order.splice(sourceIndex, 1)[0]);
  return order;
};

/**
 * Move entire category sections visually, never mutate their layout.
 * The carried section takes the total height of the crossed siblings.
 * Every crossed section moves by the carried section's fixed height.
 */
export const categoryDragOffsets = (
  rows: readonly CategoryDragGeometry[], sourceIndex: number, to: number
): number[] => {
  const offsets = rows.map(() => 0);
  if (sourceIndex < 0 || sourceIndex >= rows.length || to < 0 ||
      to >= rows.length || to === sourceIndex) return offsets;
  const source = rows[sourceIndex];
  const sourceHeight = source.bottom - source.top;
  if (to > sourceIndex) {
    offsets[sourceIndex] = rows[to].bottom - source.bottom;
    for (let i = sourceIndex + 1; i <= to; i++) offsets[i] = -sourceHeight;
  } else {
    offsets[sourceIndex] = rows[to].top - source.top;
    for (let i = to; i < sourceIndex; i++) offsets[i] = sourceHeight;
  }
  return offsets;
};
