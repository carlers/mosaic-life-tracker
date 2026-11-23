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

export function selectLastSevenDayCategoryLoads(
  tasks: readonly TaskDocument[], categories: readonly CategoryDocument[],
  ownerId: string, now: Date
): CategoryLoad[] {
  if (!ownerId) return [];
  const days = new Set(localKeysEndingOn(now, 7));
  const ownCategories = categories.filter(c => c.userId === ownerId && !c.isDeleted);
  const byId = new Map(ownCategories.map(c => [c.id, c] as const));
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.userId !== ownerId || task.isDeleted || !days.has(task.date) ||
        !byId.has(task.categoryId)) continue;
    counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1);
  }
  return ownCategories.filter(c => counts.has(c.id))
    .map(c => ({ id: c.id, name: c.name, color: c.color, count: counts.get(c.id)! }))
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
