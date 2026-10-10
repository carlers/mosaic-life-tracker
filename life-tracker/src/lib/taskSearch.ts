import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { TaskDocument } from '../db/schema';
import { isScheduledTaskDate } from './taskPlacement';

export type TaskSearchDateFilter =
  | 'any'
  | 'today'
  | 'week'
  | 'month'
  | 'custom';

export interface TaskSearchOptions {
  query: string;
  categoryIds: readonly string[];
  dateFilter: TaskSearchDateFilter;
  customStart?: string;
  customEnd?: string;
  now?: Date;
  limit?: number;
}

export interface TaskSearchOutput {
  results: TaskDocument[];
  total: number;
}

const DEFAULT_RESULT_LIMIT = 50;

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function matchesDate(
  taskDate: string,
  dateFilter: TaskSearchDateFilter,
  now: Date,
  customStart = '',
  customEnd = ''
): boolean {
  if (dateFilter === 'any') return taskDate === '' || isScheduledTaskDate(taskDate);
  if (!isScheduledTaskDate(taskDate)) return false;

  if (dateFilter === 'today') {
    return taskDate === dateKey(now);
  }

  if (dateFilter === 'week') {
    const start = dateKey(startOfWeek(now, { weekStartsOn: 0 }));
    const end = dateKey(endOfWeek(now, { weekStartsOn: 0 }));
    return taskDate >= start && taskDate <= end;
  }

  if (dateFilter === 'month') {
    const start = dateKey(startOfMonth(now));
    const end = dateKey(endOfMonth(now));
    return taskDate >= start && taskDate <= end;
  }

  let start = customStart;
  let end = customEnd;
  if (start && end && start > end) {
    [start, end] = [end, start];
  }
  if (start && taskDate < start) return false;
  if (end && taskDate > end) return false;
  return true;
}

function matchRank(title: string, query: string): number | null {
  if (!query) return 0;
  const normalizedTitle = title.toLocaleLowerCase();
  if (!normalizedTitle.includes(query)) return null;
  if (normalizedTitle === query) return 0;
  return normalizedTitle.startsWith(query) ? 1 : 2;
}

export function hasTaskSearchCriteria(options: TaskSearchOptions): boolean {
  const hasCustomDate =
    options.dateFilter === 'custom' &&
    Boolean(options.customStart || options.customEnd);

  return (
    options.query.trim().length > 0 ||
    options.categoryIds.length > 0 ||
    (options.dateFilter !== 'any' &&
      (options.dateFilter !== 'custom' || hasCustomDate))
  );
}

export function filterAndRankTasks(
  tasks: readonly TaskDocument[],
  options: TaskSearchOptions
): TaskSearchOutput {
  const query = options.query.trim().toLocaleLowerCase();
  const now = options.now ?? new Date();
  const today = dateKey(now);
  const categoryIds = new Set(options.categoryIds);
  const limit = Math.max(1, options.limit ?? DEFAULT_RESULT_LIMIT);

  const matches: Array<{ task: TaskDocument; rank: number }> = [];

  for (const task of tasks) {
    if (categoryIds.size > 0 && !categoryIds.has(task.categoryId)) continue;
    if (
      !matchesDate(
        task.date,
        options.dateFilter,
        now,
        options.customStart,
        options.customEnd
      )
    ) {
      continue;
    }

    const rank = matchRank(task.title, query);
    if (rank === null) continue;
    matches.push({ task, rank });
  }

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;

    const aFuture = a.task.date >= today;
    const bFuture = b.task.date >= today;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;

    if (a.task.date !== b.task.date) {
      return aFuture
        ? a.task.date.localeCompare(b.task.date)
        : b.task.date.localeCompare(a.task.date);
    }

    const titleOrder = a.task.title.localeCompare(b.task.title);
    return titleOrder || a.task.id.localeCompare(b.task.id);
  });

  return {
    total: matches.length,
    results: matches.slice(0, limit).map(({ task }) => task),
  };
}
