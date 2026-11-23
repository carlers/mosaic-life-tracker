import type { DiaryMixedDrop } from './diaryMixedOrder';

export interface DiaryDragRect {
  left: number; right: number; top: number; bottom: number;
}
export interface DiaryDragHitRegion {
  categoryId: string;
  rect: DiaryDragRect;
  rows: readonly { kind: 'task' | 'note'; id: string; midpoint: number }[];
}
export type DiaryGeometryHit =
  | { kind: 'group' }
  | { kind: 'category'; drop: DiaryMixedDrop };

/** Hit-test the captured *unprojected* geometry. Animated insertion slots
 * never become a moving collision target, including at category boundaries. */
export function resolveDiaryDragHit(
  group: DiaryDragRect | null,
  regions: readonly DiaryDragHitRegion[],
  x: number,
  baselineY: number,
  sourceId: string,
): DiaryGeometryHit | null {
  const horizontal = (rect: DiaryDragRect) => x >= rect.left && x <= rect.right;
  if (group && horizontal(group) && baselineY >= group.top && baselineY <= group.bottom)
    return { kind: 'group' };

  const eligible = regions.filter(region => horizontal(region.rect));
  let selected = eligible.find(region =>
    baselineY >= region.rect.top && baselineY <= region.rect.bottom);

  // A category margin is not a dead zone. Split short gaps at the midpoint
  // so last-row and first-row drops work on either side of the next pill.
  if (!selected) {
    for (let i = 0; i < eligible.length - 1; i++) {
      const before = eligible[i];
      const after = eligible[i + 1];
      const gap = after.rect.top - before.rect.bottom;
      if (gap >= 0 && gap <= 48 &&
          baselineY > before.rect.bottom && baselineY < after.rect.top) {
        selected = baselineY <= (before.rect.bottom + after.rect.top) / 2
          ? before : after;
        break;
      }
    }
  }
  if (!selected && eligible.length) {
    const first = eligible[0], last = eligible[eligible.length - 1];
    if (baselineY >= first.rect.top - 12 && baselineY < first.rect.top) selected = first;
    else if (baselineY > last.rect.bottom && baselineY <= last.rect.bottom + 20)
      selected = last;
  }
  if (!selected) return null;

  const rows = selected.rows.filter(row => row.kind !== 'note' || row.id !== sourceId);
  const next = rows.find(row => baselineY < row.midpoint);
  const last = rows[rows.length - 1];
  if (!next && !last)
    return { kind: 'category', drop: { categoryId: selected.categoryId, position: 'start' } };
  const chosen = next ?? last;
  const side = next ? 'before' as const : 'after' as const;
  return {
    kind: 'category',
    drop: chosen.kind === 'note'
      ? { categoryId: selected.categoryId, position: 'note', noteId: chosen.id, side }
      : { categoryId: selected.categoryId, position: side, taskId: chosen.id },
  };
}
