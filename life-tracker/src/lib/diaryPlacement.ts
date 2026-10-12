export type DiaryPlacement =
  | { kind: 'top' | 'bottom' }
  | { kind: 'slot'; categoryId: string; index: number };
export function diaryPlacementKey(date: string): string { return `diaryPlacement:${date}`; }
export function normalizeDiaryPlacement(value: unknown, fallback: 'top' | 'bottom'): DiaryPlacement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { kind: fallback };
  const item = value as Record<string, unknown>;
  if (item.kind === 'top' || item.kind === 'bottom') return { kind: item.kind };
  if (item.kind === 'slot' && typeof item.categoryId === 'string' && item.categoryId &&
      Number.isInteger(item.index) && Number(item.index) >= 0 && Number(item.index) <= 100000) {
    return { kind: 'slot', categoryId: item.categoryId, index: Number(item.index) };
  }
  return { kind: fallback };
}
export function placementFromTaskDrop(
  target: { categoryId: string; position: string; taskId?: string; index?: number },
  taskIds: readonly string[]
): DiaryPlacement {
  const slot = target.position === 'start' ? 0 :
    target.position === 'index' ? Number(target.index ?? 0) :
    taskIds.indexOf(target.taskId ?? '') + (target.position === 'after' ? 1 : 0);
  return { kind: 'slot', categoryId: target.categoryId, index: Math.max(0, Math.min(taskIds.length, slot)) };
}
