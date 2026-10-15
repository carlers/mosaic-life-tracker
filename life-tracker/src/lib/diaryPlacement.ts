import type { TaskPlacement } from './taskOrder';
export type DiaryPlacement =
  | { kind: 'top' | 'bottom' }
  | { kind: 'slot'; categoryId: string; index: number }
  | { kind: 'before' | 'after'; categoryId: string; taskId: string; index: number };
export function diaryPlacementKey(date: string): string { return `diaryPlacement:${date}`; }
export function normalizeDiaryPlacement(value: unknown, fallback: 'top' | 'bottom'): DiaryPlacement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { kind: fallback };
  const item = value as Record<string, unknown>;
  if (item.kind === 'top' || item.kind === 'bottom') return { kind: item.kind };
  const validSlot = typeof item.categoryId === 'string' && item.categoryId &&
    Number.isInteger(item.index) && Number(item.index) >= 0 && Number(item.index) <= 100000;
  if (item.kind === 'slot' && validSlot) {
    return { kind: 'slot', categoryId: item.categoryId as string, index: Number(item.index) };
  }
  if ((item.kind === 'before' || item.kind === 'after') && validSlot &&
      typeof item.taskId === 'string' && /^[A-Za-z0-9_]{1,36}$/.test(item.taskId)) {
    return { kind: item.kind, categoryId: item.categoryId as string,
      taskId: item.taskId, index: Number(item.index) };
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
  return anchoredDiaryPlacement(target.categoryId, slot, taskIds);
}

export function diarySlotIndex(placement: DiaryPlacement, taskIds: readonly string[]): number {
  if (placement.kind === 'top' || placement.kind === 'bottom')
    return placement.kind === 'top' ? 0 : taskIds.length;
  if (placement.kind === 'before' || placement.kind === 'after') {
    const anchor = taskIds.indexOf(placement.taskId);
    if (anchor !== -1) return anchor + (placement.kind === 'after' ? 1 : 0);
  }
  return 'index' in placement ? Math.max(0, Math.min(taskIds.length, placement.index)) : 0;
}

export function anchoredDiaryPlacement(categoryId: string, index: number,
  taskIds: readonly string[]): DiaryPlacement {
  const slot = Math.max(0, Math.min(taskIds.length, index));
  if (slot === 0) return taskIds.length
    ? { kind: 'before', categoryId, taskId: taskIds[0], index: 0 }
    : { kind: 'slot', categoryId, index: 0 };
  return { kind: 'after', categoryId, taskId: taskIds[slot - 1], index: slot };
}

/** Treat a normal task drag as removing and reinserting that task in a mixed
 * sequence. Crossing Diary changes its relative rank, never pins it.
 */
export function diaryAfterTaskMove(
  placement: DiaryPlacement,
  before: TaskPlacement,
  after: TaskPlacement,
  movingTaskId: string,
  dropRelativeToDiary: 'before' | 'after' = 'before'
): DiaryPlacement {
  if (placement.kind === 'top' || placement.kind === 'bottom') return placement;
  if (!('categoryId' in placement)) return placement;
  const category = placement.categoryId;
  const source = Object.keys(before).find(id => before[id].includes(movingTaskId));
  const target = Object.keys(after).find(id => after[id].includes(movingTaskId));
  if (!source || !target || !before[category] || !after[category]) return placement;
  let diaryIndex = diarySlotIndex(placement, before[category]);
  if (source === category && before[source].indexOf(movingTaskId) < diaryIndex) diaryIndex--;
  if (target === category) {
    const insertedIndex = after[target].indexOf(movingTaskId);
    if (insertedIndex < diaryIndex ||
        (insertedIndex === diaryIndex && dropRelativeToDiary === 'before')) diaryIndex++;
  }
  return anchoredDiaryPlacement(category, diaryIndex, after[category]);
}
