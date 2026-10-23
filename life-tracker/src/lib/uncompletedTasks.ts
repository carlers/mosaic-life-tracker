import { format, isValid, parseISO } from 'date-fns';
import type { TaskDocument } from '../db/schema';

export type UncompletedSectionId = 'overdue' | 'today' | 'upcoming' | 'backlog' | 'unknown';
export interface UncompletedSection {
  id: UncompletedSectionId;
  title: string;
  tasks: TaskDocument[];
}

export function isScheduledDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = parseISO(date);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === date;
}

/** Read-only owner view: never alters a task's date, order, or category. */
export function groupUncompletedTasks(
  tasks: readonly TaskDocument[], ownerId: string | undefined, today: string,
): UncompletedSection[] {
  const sections: UncompletedSection[] = [
    { id: 'overdue', title: 'Overdue', tasks: [] },
    { id: 'today', title: 'Today', tasks: [] },
    { id: 'upcoming', title: 'Upcoming', tasks: [] },
    { id: 'backlog', title: 'No date · Backlogs', tasks: [] },
    { id: 'unknown', title: 'Invalid date', tasks: [] },
  ];
  if (!ownerId) return [];

  for (const task of tasks) {
    if (task.userId !== ownerId || task.isDeleted || task.completed) continue;
    const sectionIndex = task.date === '' ? 3
      : !isScheduledDateKey(task.date) ? 4
      : task.date < today ? 0
      : task.date === today ? 1 : 2;
    sections[sectionIndex].tasks.push(task);
  }

  for (const section of sections) {
    section.tasks.sort((a, b) => {
      if (a.date !== b.date) {
        return section.id === 'overdue'
          ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      }
      if (a.order !== b.order) return a.order - b.order;
      const byCreated = b.createdAt.localeCompare(a.createdAt);
      return byCreated || a.id.localeCompare(b.id);
    });
  }
  return sections.filter(section => section.tasks.length > 0);
}
