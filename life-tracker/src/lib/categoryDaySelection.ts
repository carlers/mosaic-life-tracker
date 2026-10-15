import type { TaskDocument } from '../db/schema';

type EligibleTask = Pick<TaskDocument, 'id' | 'categoryId' | 'date' | 'userId' | 'isDeleted'>;

/** Toggle only owned, active, non-deleted tasks in one category on one date. */
export function toggleCategoryDaySelection(
  current: ReadonlySet<string>,
  tasks: readonly EligibleTask[],
  categoryId: string,
  dateStr: string,
  userId: string,
): Set<string> {
  const next = new Set(current);
  if (!categoryId || !dateStr || !userId) return next;
  const scoped = tasks.filter(task => !task.isDeleted &&
    task.categoryId === categoryId && task.date === dateStr && task.userId === userId);
  if (scoped.length === 0) return next;
  const allSelected = scoped.every(task => current.has(task.id));
  for (const task of scoped) {
    if (allSelected) next.delete(task.id);
    else next.add(task.id);
  }
  return next;
}
