import type { SharedTaskItem } from './taskShareQueue';
export interface SharedPlacement { categoryId: string; order: number }
export const placementKey = (id: string) => 'sharedPlacement:' + id;

export function parseSharedPlacement(raw: unknown, validCategoryIds: ReadonlySet<string>): SharedPlacement | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<SharedPlacement>;
  if (typeof value.categoryId !== 'string' || !validCategoryIds.has(value.categoryId) ||
      typeof value.order !== 'number' || !Number.isInteger(value.order) ||
      value.order < 0 || value.order > 999999) return null;
  return { categoryId: value.categoryId, order: value.order };
}
export function placedShares(items: readonly SharedTaskItem[], settings: Record<string, unknown>,
  categoryIds: ReadonlySet<string>): Map<string, SharedTaskItem[]> {
  const grouped = new Map<string, SharedTaskItem[]>();
  for (const item of items) {
    if (item.status !== 'accepted') continue;
    const place = parseSharedPlacement(settings[placementKey(item.id)], categoryIds);
    if (!place) continue;
    const arr = grouped.get(place.categoryId) || [];
    arr.push(item);
    grouped.set(place.categoryId, arr);
  }
  for (const items of grouped.values()) items.sort((a, b) => {
    const aa = parseSharedPlacement(settings[placementKey(a.id)], categoryIds)?.order ?? 0;
    const bb = parseSharedPlacement(settings[placementKey(b.id)], categoryIds)?.order ?? 0;
    return aa - bb;
  });
  return grouped;
}

/** Convert drop geometry into recipient-owned share ordering, never owner-task ordering.
 * Native task rows and their gaps precede the shared row group in Day View. */
export function planSharedTaskMove(
  moved: SharedTaskItem,
  destinationId: string,
  targetId: string,
  position: 'start' | 'index' | 'before' | 'after',
  shares: readonly SharedTaskItem[],
  categoryFor: (item: SharedTaskItem) => string,
  orderFor: (item: SharedTaskItem) => number,
): Array<{ id: string; categoryId: string; order: number }> {
  const others = shares.filter(item =>
    item.id !== moved.id && item.status === 'accepted' &&
    item.date === moved.date && categoryFor(item) === destinationId
  ).sort((a, b) => orderFor(a) - orderFor(b) || a.id.localeCompare(b.id));
  const targetIndex = others.findIndex(item => item.id === targetId);
  // All native rows are rendered before shared rows. A drop over a native row,
  // its gap, or a category heading therefore maps to the start of shared rows.
  const index = targetIndex < 0 || position === 'start' || position === 'index'
    ? 0 : targetIndex + (position === 'after' ? 1 : 0);
  others.splice(index, 0, moved);
  return others.map((item, order) => ({
    id: item.id, categoryId: destinationId, order: order * 10,
  }));
}
