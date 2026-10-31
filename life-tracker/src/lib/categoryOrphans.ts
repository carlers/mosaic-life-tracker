import type { CategoryDocument, TaskDocument } from '../db/schema';

type ScopedTask = Pick<TaskDocument, 'id' | 'userId' | 'categoryId' | 'title' | 'date' | 'completed' | 'isDeleted'>;
type ScopedCategory = Pick<CategoryDocument, 'id' | 'userId' | 'isDeleted'>;

/** Read-only, owner-scoped inventory: never rewrite category IDs or widen access. */
export function findTasksWithoutActiveCategory<T extends ScopedTask>(
  tasks: readonly T[],
  categories: readonly ScopedCategory[],
  ownerId: string | null | undefined
): T[] {
  if (!ownerId) return [];
  const validIds = new Set(categories.filter(category =>
    category.userId === ownerId && !category.isDeleted
  ).map(category => category.id));
  return tasks.filter(task =>
    task.userId === ownerId && !task.isDeleted && !validIds.has(task.categoryId)
  ).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
