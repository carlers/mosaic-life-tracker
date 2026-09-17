import { useMemo } from 'react';
import type { TaskDocument } from '../db/schema';

export function useTasksByDate(
  tasks: TaskDocument[]
): Map<string, TaskDocument[]> {
  return useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const task of tasks) {
      const list = map.get(task.date);
      if (list) {
        list.push(task);
      } else {
        map.set(task.date, [task]);
      }
    }
    return map;
  }, [tasks]);
}
