import type { TaskDocument } from '../db/schema';

export type CategoryTaskMove = Pick<TaskDocument, 'id' | 'date' | 'order' | 'createdAt' | 'visibility'>;
export type CategoryTaskMoveAssignment = { id: string; categoryId: string; order: number; visibility: TaskDocument['visibility'] };

/**
 * Append tasks to their destination in each original day/Backlogs group.
 * Never change task IDs, completion, dates, attachments, or linked content.
 * Preserve inherited source-category privacy with an explicit task override.
 */
export function planCategoryTaskMoves(
  sourceTasks: readonly CategoryTaskMove[],
  destinationTasks: readonly CategoryTaskMove[],
  destinationId: string,
  sourceVisibility: TaskDocument['visibility']
): CategoryTaskMoveAssignment[] {
  const maxByDay = new Map<string, number>();
  for (const task of destinationTasks) {
    maxByDay.set(task.date, Math.max(maxByDay.get(task.date) ?? -1, task.order ?? 0));
  }
  const ordered = [...sourceTasks].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.order ?? 0) - (b.order ?? 0) ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id));
  return ordered.map(task => {
    const order = (maxByDay.get(task.date) ?? -1) + 1;
    maxByDay.set(task.date, order);
    return {
      id: task.id,
      categoryId: destinationId,
      order,
      visibility: task.visibility || sourceVisibility,
    };
  });
}
