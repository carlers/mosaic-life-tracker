import { useMemo } from 'react';
import type { TaskDocument } from '../db/schema';

export function useTasksByDate(
  tasks: TaskDocument[],
  categoryIds?: readonly string[]
): Map<string, TaskDocument[]> {
  return useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    const selected = categoryIds?.length ? new Set(categoryIds) : null;
    for (const task of tasks) {
      if (selected && !selected.has(task.categoryId)) continue;
      const list = map.get(task.date);
      if (list) {
        list.push(task);
      } else {
        map.set(task.date, [task]);
      }
    }
    return map;
  }, [tasks, categoryIds]);
}
