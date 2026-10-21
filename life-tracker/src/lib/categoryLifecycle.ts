/**
 * #857 — date-effective category retirement contract.
 *
 * The category's identity and historical task records never change when it
 * retires. This is pure display/selection logic; persistence and cross-provider
 * CAS must be accepted before the feature is exposed in the application UI.
 */
export interface RetirableCategory {
  id: string;
  isDeleted: boolean;
  /** Owner-local inclusive YYYY-MM-DD cutoff, or empty for active. */
  retiredOn?: string;
}

export interface RetirableTask {
  categoryId: string;
  date: string;
  isDeleted: boolean;
}

export type CategoryDayState = 'normal' | 'historical' | 'existing-tasks-only' | 'hidden';

export function validLocalDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function retirementStateForDay(
  category: RetirableCategory,
  date: string,
  hasTasksOnDay: boolean,
): CategoryDayState {
  if (category.isDeleted) return 'hidden';
  const cutoff = category.retiredOn ?? '';
  if (!cutoff) return 'normal';
  if (!validLocalDateKey(cutoff)) throw new Error('Invalid category retirement cutoff');
  if (date === '') return hasTasksOnDay ? 'existing-tasks-only' : 'hidden';
  if (!validLocalDateKey(date)) throw new Error('Invalid date for category retirement');
  if (date <= cutoff) return 'historical';
  // Existing future tasks stay findable/editable. They never get silently
  // stranded, but the category is no longer offered for NEW future tasks.
  return hasTasksOnDay ? 'existing-tasks-only' : 'hidden';
}

export function categoriesForDay<T extends RetirableCategory>(
  categories: readonly T[],
  tasks: readonly RetirableTask[],
  date: string,
): Array<{ category: T; state: Exclude<CategoryDayState, 'hidden'>; canAddTasks: boolean }> {
  const occupied = new Set(tasks.filter(task => !task.isDeleted && task.date === date)
    .map(task => task.categoryId));
  const result: Array<{ category: T; state: Exclude<CategoryDayState, 'hidden'>; canAddTasks: boolean }> = [];
  for (const category of categories) {
    const state = retirementStateForDay(category, date, occupied.has(category.id));
    if (state !== 'hidden') {
      result.push({ category, state, canAddTasks: state !== 'existing-tasks-only' });
    }
  }
  return result;
}

export function categoryDeletionCount(
  categoryId: string,
  tasks: readonly RetirableTask[],
): number {
  return tasks.filter(task => task.categoryId === categoryId && !task.isDeleted).length;
}
