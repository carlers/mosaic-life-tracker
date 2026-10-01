import type { TaskDocument } from '../db/schema';

export interface TaskOrderGroup {
  categoryId: string;
  taskIds: readonly string[];
}

export type TaskPlacement = Record<string, string[]>;

export interface TaskOrderAssignment {
  id: string;
  categoryId: string;
  order: number;
}

type JsonBackedTaskDocument = TaskDocument & {
  toJSON?: (withMetaFields?: boolean) => TaskDocument;
};

export function materializeTaskDocument(
  task: TaskDocument
): TaskDocument {
  const jsonTask = task as JsonBackedTaskDocument;
  const source =
    typeof jsonTask.toJSON === 'function'
      ? jsonTask.toJSON()
      : task;

  return { ...source };
}

const compareTasks = (a: TaskDocument, b: TaskDocument) =>
  (a.order ?? 0) - (b.order ?? 0) ||
  b.createdAt.localeCompare(a.createdAt) ||
  a.id.localeCompare(b.id);

export function buildTaskPlacement(
  tasks: readonly TaskDocument[],
  categoryIds: readonly string[]
): TaskPlacement {
  const placement = Object.fromEntries(
    categoryIds.map((categoryId) => [categoryId, [] as string[]])
  );
  const allowed = new Set(categoryIds);
  const grouped = new Map<string, TaskDocument[]>();

  for (const task of tasks) {
    if (!allowed.has(task.categoryId)) continue;
    const list = grouped.get(task.categoryId);
    if (list) list.push(task);
    else grouped.set(task.categoryId, [task]);
  }

  for (const categoryId of categoryIds) {
    placement[categoryId] = (grouped.get(categoryId) ?? [])
      .slice()
      .sort(compareTasks)
      .map((task) => task.id);
  }

  return placement;
}

export function cloneTaskPlacement(placement: TaskPlacement): TaskPlacement {
  return Object.fromEntries(
    Object.entries(placement).map(([categoryId, taskIds]) => [
      categoryId,
      [...taskIds],
    ])
  );
}

export function moveTaskInPlacement(
  placement: TaskPlacement,
  taskId: string,
  targetCategoryId: string,
  targetIndex: number
): TaskPlacement | null {
  const next = cloneTaskPlacement(placement);
  let found = false;

  for (const taskIds of Object.values(next)) {
    const index = taskIds.indexOf(taskId);
    if (index < 0) continue;
    taskIds.splice(index, 1);
    found = true;
    break;
  }

  if (!found) return null;

  const target = next[targetCategoryId] ?? (next[targetCategoryId] = []);
  const index = Math.max(0, Math.min(targetIndex, target.length));
  target.splice(index, 0, taskId);
  return next;
}

export function taskPlacementSignature(
  placement: TaskPlacement,
  categoryIds: readonly string[] = Object.keys(placement)
): string {
  return categoryIds
    .map((categoryId) => `${categoryId}:${(placement[categoryId] ?? []).join(',')}`)
    .join('|');
}

export function taskPlacementIdSignature(placement: TaskPlacement): string {
  return Object.values(placement).flat().slice().sort().join('|');
}

export function isTaskPlacementCompatible(
  candidate: TaskPlacement,
  live: TaskPlacement,
  categoryIds: readonly string[]
): boolean {
  const allowed = new Set(categoryIds);

  for (const [categoryId, taskIds] of Object.entries(candidate)) {
    if (!allowed.has(categoryId) && taskIds.length > 0) return false;
  }

  const expectedIds = categoryIds.flatMap(
    (categoryId) => live[categoryId] ?? []
  );
  const candidateIds = categoryIds.flatMap(
    (categoryId) => candidate[categoryId] ?? []
  );

  if (expectedIds.length !== candidateIds.length) return false;

  const expected = new Set(expectedIds);
  const actual = new Set(candidateIds);

  if (
    expected.size !== expectedIds.length ||
    actual.size !== candidateIds.length ||
    actual.size !== expected.size
  ) {
    return false;
  }

  for (const taskId of expected) {
    if (!actual.has(taskId)) return false;
  }

  return true;
}

export function buildTaskOrderAssignments(
  tasks: readonly TaskDocument[],
  userId: string,
  date: string,
  groups: readonly TaskOrderGroup[]
): TaskOrderAssignment[] {
  if (groups.length === 0) return [];

  const categoryIds = new Set<string>();
  const desired = new Map<string, TaskOrderAssignment>();

  for (const group of groups) {
    if (categoryIds.has(group.categoryId)) {
      throw new Error('[taskOrder] Duplicate category in reorder payload');
    }
    categoryIds.add(group.categoryId);

    group.taskIds.forEach((id, order) => {
      if (desired.has(id)) {
        throw new Error('[taskOrder] Duplicate task in reorder payload');
      }
      desired.set(id, { id, categoryId: group.categoryId, order });
    });
  }

  const current = tasks.filter(
    (task) =>
      !task.isDeleted &&
      task.userId === userId &&
      task.date === date &&
      categoryIds.has(task.categoryId)
  );

  if (
    current.length !== desired.size ||
    current.some((task) => !desired.has(task.id))
  ) {
    throw new Error('[taskOrder] Task groups changed while reordering');
  }

  return current.map((task) => {
    const assignment = desired.get(task.id);
    if (!assignment) {
      throw new Error('[taskOrder] Missing task assignment');
    }
    return assignment;
  });
}
