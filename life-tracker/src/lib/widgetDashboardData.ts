import type { CategoryDocument, DiaryDocument, TaskDocument } from '../db/schema';
import { getLocalTodayKey } from './todayWidget';

export interface DayProgress {
  key: string;
  completed: number;
  total: number;
}
export interface WeeklyProgress {
  completed: number;
  total: number;
  percentage: number;
  days: DayProgress[];
}
export interface CategoryLoad {
  id: string;
  name: string;
  color: string;
  count: number;
}

/** Owner-local calendar-day stepping, safe around DST and timezone offsets. */
function localKeysEndingOn(now: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    getLocalTodayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1 + index)));
}

export function selectTodayDiaryEntries(
  entries: readonly DiaryDocument[], ownerId: string, now: Date
): DiaryDocument[] {
  if (!ownerId) return [];
  const today = getLocalTodayKey(now);
  return entries.filter(entry =>
    entry.userId === ownerId && !entry.isDeleted && entry.date === today
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export type CategoryRangeDays = 7 | 30 | 365;
export type WidgetProgressPeriod = 'week' | 'month' | 'year';

export function selectCategoryLoadsForDays(
  tasks: readonly TaskDocument[], categories: readonly CategoryDocument[],
  ownerId: string, now: Date, range: CategoryRangeDays
): CategoryLoad[] {
  if (!ownerId) return [];
  const days = new Set(localKeysEndingOn(now, range === 30 || range === 365 ? range : 7));
  const ownCategories = categories.filter(c => c.userId === ownerId && !c.isDeleted);
  const byId = new Map(ownCategories.map(c => [c.id, c] as const));
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.userId !== ownerId || task.isDeleted || !days.has(task.date) ||
        !byId.has(task.categoryId)) continue;
    counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1);
  }
  return ownCategories
    .map(c => ({ id: c.id, name: c.name, color: c.color, count: counts.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count ||
      (byId.get(a.id)!.order - byId.get(b.id)!.order) ||
      a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function selectWeeklyProgress(
  tasks: readonly TaskDocument[], ownerId: string, now: Date,
  weekStartsOnSunday: boolean
): WeeklyProgress {
  const weekday = now.getDay();
  const firstOffset = weekStartsOnSunday ? weekday : (weekday + 6) % 7;
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - firstOffset);
  const days: DayProgress[] = Array.from({ length: 7 }, (_, index) => ({
    key: getLocalTodayKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + index)),
    completed: 0,
    total: 0,
  }));
  if (ownerId) {
    const index = new Map(days.map((day, i) => [day.key, i] as const));
    for (const task of tasks) {
      if (task.isDeleted || task.userId !== ownerId) continue;
      const target = index.get(task.date);
      if (target === undefined) continue;
      days[target].total += 1;
      if (task.completed) days[target].completed += 1;
    }
  }
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  return { total, completed, percentage: total ? Math.round(100 * completed / total) : 0, days };
}


/** Retain the original 7-day selector for callers and existing contracts. */
export function selectLastSevenDayCategoryLoads(
  tasks: readonly TaskDocument[], categories: readonly CategoryDocument[],
  ownerId: string, now: Date
): CategoryLoad[] {
  return selectCategoryLoadsForDays(tasks, categories, ownerId, now, 7);
}

export interface ProgressBucket extends DayProgress {
  label: string;
}
export interface PeriodProgress {
  completed: number;
  total: number;
  percentage: number;
  buckets: ProgressBucket[];
}

/** Calendar-aligned, owner-only ranges. Month groups by calendar week; year groups by month. */
export function selectTaskPeriodProgress(
  tasks: readonly TaskDocument[], ownerId: string, now: Date,
  weekStartsOnSunday: boolean, period: WidgetProgressPeriod
): PeriodProgress {
  if (period === 'week') {
    const weekly = selectWeeklyProgress(tasks, ownerId, now, weekStartsOnSunday);
    return {
      completed: weekly.completed, total: weekly.total, percentage: weekly.percentage,
      buckets: weekly.days.map(day => {
        const [year, month, date] = day.key.split('-').map(Number);
        return { ...day, label: new Date(year, month - 1, date)
          .toLocaleDateString(undefined, { weekday: 'narrow' }) };
      }),
    };
  }
  const year = now.getFullYear();
  const month = now.getMonth();
  const buckets: ProgressBucket[] = [];
  const dateToBucket = new Map<string, number>();
  if (period === 'month') {
    const offset = (new Date(year, month, 1).getDay() - (weekStartsOnSunday ? 0 : 1) + 7) % 7;
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= lastDate; day++) {
      const slot = Math.floor((day - 1 + offset) / 7);
      if (!buckets[slot]) buckets[slot] = {
        key: getLocalTodayKey(new Date(year, month, day)), label: 'W' + (slot + 1),
        completed: 0, total: 0,
      };
      dateToBucket.set(getLocalTodayKey(new Date(year, month, day)), slot);
    }
  } else {
    for (let m = 0; m < 12; m++) {
      buckets.push({
        key: getLocalTodayKey(new Date(year, m, 1)),
        label: new Date(year, m, 1).toLocaleDateString(undefined, { month: 'short' }),
        completed: 0, total: 0,
      });
    }
  }
  if (ownerId) {
    const yearPrefix = String(year) + '-';
    for (const task of tasks) {
      if (task.userId !== ownerId || task.isDeleted) continue;
      const index = period === 'month'
        ? dateToBucket.get(task.date)
        : task.date.startsWith(yearPrefix) && /^\d{4}-\d{2}-\d{2}$/.test(task.date)
          ? Number(task.date.slice(5, 7)) - 1 : undefined;
      if (index === undefined || index < 0 || index >= buckets.length) continue;
      // The generated calendar keys guard month/day validity in month mode.
      if (period === 'year') {
        const date = Number(task.date.slice(8, 10));
        if (date < 1 || date > new Date(year, index + 1, 0).getDate()) continue;
      }
      buckets[index].total += 1;
      if (task.completed) buckets[index].completed += 1;
    }
  }
  const total = buckets.reduce((sum, item) => sum + item.total, 0);
  const completed = buckets.reduce((sum, item) => sum + item.completed, 0);
  return { completed, total, percentage: total ? Math.round(100 * completed / total) : 0, buckets };
}
