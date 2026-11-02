import type { CategoryDocument, TaskDocument } from '../db/schema';

export type RetirableCategory = Pick<CategoryDocument, 'id' | 'isDeleted' | 'retiredOn'>;
type RetirableTask = Pick<TaskDocument, 'categoryId' | 'date' | 'isDeleted'>;
export type CategoryDayState = 'active' | 'historical' | 'existing-tasks-only' | 'hidden';

/** Owner-calendar date, not a UTC midnight; rejects impossible dates. */
export function validLocalDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** Historical tasks retain category identity through its inclusive last-active date. */
export function retirementStateForDay(
  category: RetirableCategory, date: string, hasTasksOnDay: boolean
): CategoryDayState {
  if (category.isDeleted) return 'hidden';
  const lastActive = category.retiredOn || '';
  if (!lastActive) return 'active';
  if (!validLocalDateKey(lastActive)) return 'hidden';
  if (date !== '' && validLocalDateKey(date) && date <= lastActive) return 'historical';
  return hasTasksOnDay ? 'existing-tasks-only' : 'hidden';
}

/** New assignments to retired categories cannot silently create hidden tasks. */
export function canAddNewTaskToCategory(category: RetirableCategory, date: string): boolean {
  if (category.isDeleted) return false;
  const lastActive = category.retiredOn || '';
  return !lastActive || (date !== '' && validLocalDateKey(date) &&
    validLocalDateKey(lastActive) && date <= lastActive);
}

export function categoriesForDay<T extends RetirableCategory>(
  categories: readonly T[], tasks: readonly RetirableTask[], date: string,
  extraOccupiedCategoryIds: readonly string[] = []
): Array<{category: T; state: Exclude<CategoryDayState, 'hidden'>}> {
  const occupied = new Set<string>(extraOccupiedCategoryIds);
  for (const task of tasks) {
    if (!task.isDeleted && task.date === date) occupied.add(task.categoryId);
  }
  return categories.flatMap(category => {
    const state = retirementStateForDay(category, date, occupied.has(category.id));
    return state === 'hidden' ? [] : [{category, state}];
  });
}
