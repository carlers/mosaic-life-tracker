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

export type NewTaskPosition = 'top' | 'bottom';

export function getNewTaskOrder(
  siblings: readonly Pick<TaskDocument, 'order'>[],
  position: NewTaskPosition
): number {
  if (position === 'top') return 0;
  return (
    siblings.reduce(
      (maximum, candidate) => Math.max(maximum, candidate.order ?? 0),
      -1
    ) + 1
  );
}

type JsonBackedTaskDocument = TaskDocument & {
  toJSON?: (withMetaFields?: boolean) => TaskDocument;
};

export function materializeTaskDocument(
  task: TaskDocument
): TaskDocument {
  const jsonTask = task as JsonBackedTaskDocument;
  if (typeof jsonTask.toJSON !== 'function') {
    return task;
  }

  return { ...jsonTask.toJSON() };
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

export function buildBulkMoveTaskOrderGroups(
  tasks: readonly TaskDocument[],
  selectedTaskIds: readonly string[],
  destinationCategoryId: string,
  categoryIds: readonly string[]
): TaskOrderGroup[] {
  if (selectedTaskIds.length === 0) return [];

  if (!categoryIds.includes(destinationCategoryId)) {
    throw new Error('[taskOrder] Invalid destination category');
  }

  const selected = new Set(selectedTaskIds);
  if (selected.size !== selectedTaskIds.length) {
    throw new Error('[taskOrder] Duplicate selected task');
  }

  const placement = buildTaskPlacement(tasks, categoryIds);
  const liveTaskIds = new Set(
    categoryIds.flatMap((categoryId) => placement[categoryId] ?? [])
  );
  for (const taskId of selected) {
    if (!liveTaskIds.has(taskId)) {
      throw new Error('[taskOrder] Selected task changed while moving');
    }
  }

  const incomingTaskIds = categoryIds.flatMap((categoryId) =>
    categoryId === destinationCategoryId
      ? []
      : (placement[categoryId] ?? []).filter((taskId) => selected.has(taskId))
  );
  if (incomingTaskIds.length === 0) return [];

  const nextPlacement: TaskPlacement = { ...placement };
  for (const categoryId of categoryIds) {
    if (categoryId === destinationCategoryId) continue;
    const currentTaskIds = placement[categoryId] ?? [];
    if (!currentTaskIds.some((taskId) => selected.has(taskId))) continue;
    nextPlacement[categoryId] = currentTaskIds.filter(
      (taskId) => !selected.has(taskId)
    );
  }
  nextPlacement[destinationCategoryId] = [
    ...(placement[destinationCategoryId] ?? []),
    ...incomingTaskIds,
  ];

  return categoryIds
    .filter((categoryId) => {
      const current = placement[categoryId] ?? [];
      const next = nextPlacement[categoryId] ?? [];
      if (current.length !== next.length) return true;
      return current.some((taskId, index) => taskId !== next[index]);
    })
    .map((categoryId) => ({
      categoryId,
      taskIds: nextPlacement[categoryId] ?? [],
    }));
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
