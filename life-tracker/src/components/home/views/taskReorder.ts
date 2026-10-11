import type { TaskDocument } from '../../../db/schema';
import type { TaskOrderGroup, TaskPlacement } from '../../../lib/taskOrder';

export interface ActiveTaskDrag {
  taskId: string;
  initialCategoryId: string;
  snapshot: TaskPlacement;
  projection: TaskPlacement;
  rowHeight: number;
}

type ParsedDropTarget =
  | { categoryId: string; position: 'start' }
  | { categoryId: string; position: 'index'; index: number }
  | {
      categoryId: string;
      position: 'before' | 'after';
      taskId: string;
    };

const CATEGORY_START_PREFIX = 'task-category-start:';
const GAP_PREFIX = 'task-gap:';
const INSERT_PREFIX = 'task-insert:';

export function categoryStartDropId(categoryId: string): string {
  return `${CATEGORY_START_PREFIX}${categoryId}`;
}

export function taskGapDropId(categoryId: string, index: number): string {
  return `${GAP_PREFIX}${categoryId}:${index}`;
}

export function taskInsertDropId(
  categoryId: string,
  taskId: string,
  position: 'before' | 'after'
): string {
  return `${INSERT_PREFIX}${categoryId}:${taskId}:${position}`;
}

export function findTaskCategory(
  placement: TaskPlacement,
  taskId: string
): string | null {
  for (const [categoryId, taskIds] of Object.entries(placement)) {
    if (taskIds.includes(taskId)) return categoryId;
  }
  return null;
}

export function parseDropTarget(targetId: string): ParsedDropTarget | null {
  if (targetId.startsWith(CATEGORY_START_PREFIX)) {
    const categoryId = targetId.slice(CATEGORY_START_PREFIX.length);
    return categoryId ? { categoryId, position: 'start' } : null;
  }

  if (targetId.startsWith(GAP_PREFIX)) {
    const [categoryId, rawIndex, ...rest] = targetId
      .slice(GAP_PREFIX.length)
      .split(':');
    const index = Number(rawIndex);
    if (
      rest.length > 0 ||
      !categoryId ||
      !Number.isInteger(index) ||
      index < 0
    ) {
      return null;
    }
    return { categoryId, position: 'index', index };
  }

  if (!targetId.startsWith(INSERT_PREFIX)) return null;

  const [categoryId, taskId, position, ...rest] = targetId
    .slice(INSERT_PREFIX.length)
    .split(':');
  if (
    rest.length > 0 ||
    !categoryId ||
    !taskId ||
    (position !== 'before' && position !== 'after')
  ) {
    return null;
  }

  return { categoryId, taskId, position };
}

export function projectTaskPlacement(
  snapshot: TaskPlacement,
  taskId: string,
  targetId: string
): TaskPlacement | null {
  const target = parseDropTarget(targetId);
  if (!target || !(target.categoryId in snapshot)) return null;

  const sourceCategoryId = findTaskCategory(snapshot, taskId);
  if (!sourceCategoryId) return null;

  // Only source and destination arrays can change during one projection.
  // Keep every other category array shared with the immutable drag snapshot.
  const next: TaskPlacement = { ...snapshot };
  const sourceTaskIds = [...(snapshot[sourceCategoryId] ?? [])];
  next[sourceCategoryId] = sourceTaskIds;

  const sourceIndex = sourceTaskIds.indexOf(taskId);
  if (sourceIndex < 0) return null;
  sourceTaskIds.splice(sourceIndex, 1);

  const targetTaskIds =
    target.categoryId === sourceCategoryId
      ? sourceTaskIds
      : [...(snapshot[target.categoryId] ?? [])];
  next[target.categoryId] = targetTaskIds;

  let targetIndex = 0;
  if (target.position === 'index') {
    targetIndex = target.index;
  } else if (target.position !== 'start') {
    const targetTaskIndex = targetTaskIds.indexOf(target.taskId);
    if (targetTaskIndex < 0) return null;
    targetIndex =
      targetTaskIndex + (target.position === 'after' ? 1 : 0);
  }

  const clampedIndex = Math.max(
    0,
    Math.min(targetIndex, targetTaskIds.length)
  );
  targetTaskIds.splice(clampedIndex, 0, taskId);
  return next;
}

export function taskPlacementsEqual(
  a: TaskPlacement,
  b: TaskPlacement,
  categoryIds: readonly string[]
): boolean {
  for (const categoryId of categoryIds) {
    const aIds = a[categoryId] ?? [];
    const bIds = b[categoryId] ?? [];
    if (aIds.length !== bIds.length) return false;
    for (let index = 0; index < aIds.length; index += 1) {
      if (aIds[index] !== bIds[index]) return false;
    }
  }
  return true;
}

export function buildRenderedTasksByCategory(
  tasks: readonly TaskDocument[],
  placement: TaskPlacement,
  categoryIds: readonly string[]
): Map<string, TaskDocument[]> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const result = new Map<string, TaskDocument[]>();

  for (const categoryId of categoryIds) {
    const ordered: TaskDocument[] = [];
    for (const [order, taskId] of (placement[categoryId] ?? []).entries()) {
      const task = taskById.get(taskId);
      if (!task) continue;
      ordered.push(
        task.categoryId === categoryId && task.order === order
          ? task
          : { ...task, categoryId, order }
      );
    }
    result.set(categoryId, ordered);
  }

  return result;
}

export function buildAffectedTaskOrderGroups(
  snapshot: TaskPlacement,
  finalPlacement: TaskPlacement,
  taskId: string
): TaskOrderGroup[] {
  const sourceCategoryId = findTaskCategory(snapshot, taskId);
  const targetCategoryId = findTaskCategory(finalPlacement, taskId);
  if (!sourceCategoryId || !targetCategoryId) return [];

  return Array.from(new Set([sourceCategoryId, targetCategoryId])).map(
    (categoryId) => ({
      categoryId,
      taskIds: finalPlacement[categoryId] ?? [],
    })
  );
}
