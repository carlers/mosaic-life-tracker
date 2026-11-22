import type { TaskDocument } from '../db/schema';
import { validLocalDateKey } from './categoryLifecycle';

export const CATEGORY_VIEW_SELECTED_SETTING_KEY = 'categoryViewSelectedCategory';
export const CATEGORY_VIEW_STICKY_ADD_SETTING_KEY = 'categoryViewStickyAdd';
export const CATEGORY_VIEW_ORDER_SETTING_KEY = 'categoryViewDateOrder';
export const CATEGORY_VIEW_FILTER_SETTING_KEY = 'categoryViewCompletionFilter';
export const CATEGORY_VIEW_LEFT_SWIPE_SETTING_KEY = 'categoryViewTaskSwipeLeft';
export const CATEGORY_VIEW_RIGHT_SWIPE_SETTING_KEY = 'categoryViewTaskSwipeRight';
export const CATEGORY_VIEW_HEADER_SWIPE_SETTING_KEY = 'categoryViewHeaderSwipe';

export type CategoryDateOrder = 'newest' | 'oldest';
export type CategoryCompletionFilter = 'all' | 'incomplete' | 'completed';
export type CategorySwipeAction = 'off' | 'reveal';

export function resolveCategoryOrder(value: unknown): CategoryDateOrder {
  return value === 'oldest' ? 'oldest' : 'newest';
}
export function resolveCategoryFilter(value: unknown): CategoryCompletionFilter {
  return value === 'completed' || value === 'incomplete' ? value : 'all';
}
export function resolveCategorySwipe(value: unknown, fallback: CategorySwipeAction): CategorySwipeAction {
  return value === 'off' || value === 'reveal' ? value : fallback;
}

export interface CategoryDateGroup { date: string; tasks: TaskDocument[]; }
export interface CategoryTaskGroups {
  today: TaskDocument[];
  past: CategoryDateGroup[];
  upcoming: CategoryDateGroup[];
  undated: TaskDocument[];
  invalid: TaskDocument[];
}
/**
 * Category-first timeline without changing persisted task order. No Calendar-day scans:
 * one pass through owned tasks, date groups sorted once; undated and corrupt legacy
 * dates remain visible rather than silently disappearing.
 */
export function projectCategoryTasks(
  tasks: readonly TaskDocument[],
  categoryId: string,
  ownerId: string,
  today: string,
  filter: CategoryCompletionFilter,
  order: CategoryDateOrder,
): CategoryTaskGroups {
  const byDate = new Map<string, TaskDocument[]>();
  const undated: TaskDocument[] = [];
  const invalid: TaskDocument[] = [];
  const sorted = (items: TaskDocument[]) => items.sort(
    (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
  for (const task of tasks) {
    if (task.isDeleted || task.userId !== ownerId || task.categoryId !== categoryId ||
      (filter === 'completed' && !task.completed) ||
      (filter === 'incomplete' && task.completed)) continue;
    if (task.date === '') { undated.push(task); continue; }
    if (!validLocalDateKey(task.date)) { invalid.push(task); continue; }
    const items = byDate.get(task.date) ?? [];
    items.push(task);
    byDate.set(task.date, items);
  }
  const todayTasks = sorted(byDate.get(today) ?? []);
  const past: CategoryDateGroup[] = [];
  const upcoming: CategoryDateGroup[] = [];
  for (const [date, items] of byDate) {
    if (date === today) continue;
    (date < today ? past : upcoming).push({ date, tasks: sorted(items) });
  }
  past.sort((a, b) => order === 'newest'
    ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return { today: todayTasks, past, upcoming, undated: sorted(undated), invalid: sorted(invalid) };
}
