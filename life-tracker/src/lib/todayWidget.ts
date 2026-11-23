import type { CategoryDocument, TaskDocument } from '../db/schema';

/** Calendar dates are owner-device local, not UTC dates or server timestamps. */
export function getLocalTodayKey(now: Date = new Date()): string {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

/** Projection of existing owned tasks only; no independent subscription or write. */
export function selectTodayWidgetTasks(
  tasks: readonly TaskDocument[],
  categories: readonly CategoryDocument[],
  ownerId: string,
  dayKey: string
): TaskDocument[] {
  if (!ownerId) return [];
  const categoryOrder = new Map(
    categories
      .filter(c => c.userId === ownerId && !c.isDeleted)
      .map(c => [c.id, c.order] as const)
  );
  return tasks
    .filter(t => t.userId === ownerId && !t.isDeleted && t.date === dayKey)
    .sort((a, b) =>
      (categoryOrder.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrder.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER) ||
      a.categoryId.localeCompare(b.categoryId) ||
      a.order - b.order ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
    );
}

export function getTodayWidgetProgress(tasks: readonly Pick<TaskDocument, 'completed'>[]) {
  const total = tasks.length;
  const completed = tasks.reduce((count, task) => count + (task.completed ? 1 : 0), 0);
  return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
}
