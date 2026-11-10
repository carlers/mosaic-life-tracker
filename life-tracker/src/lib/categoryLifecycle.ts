import type { CategoryDocument, TaskDocument } from '../db/schema';

export type RetirableCategory = Pick<
  CategoryDocument,
  'id' | 'isDeleted' | 'startedOn' | 'retiredOn'
>;
type RetirableTask = Pick<TaskDocument, 'categoryId' | 'date' | 'isDeleted'>;
export type CategoryDayState = 'active' | 'historical' | 'existing-tasks-only' | 'hidden';
export type CategoryLifecycleStatus = 'active' | 'upcoming' | 'retired' | 'invalid';

/** Owner-calendar date, not a UTC midnight; rejects impossible dates. */
export function validLocalDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Format today's date using the same local calendar as Day View. */
export function localTodayDateKey(now = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Both inclusive lifecycle bounds must be valid and ordered. */
export function validCategoryDateRange(startedOn = '', retiredOn = ''): boolean {
  return (!startedOn || validLocalDateKey(startedOn)) &&
    (!retiredOn || validLocalDateKey(retiredOn)) &&
    (!startedOn || !retiredOn || startedOn <= retiredOn);
}

export function categoryLifecycleStatus(
  category: RetirableCategory,
  today = localTodayDateKey()
): CategoryLifecycleStatus {
  const startedOn = category.startedOn || '';
  const retiredOn = category.retiredOn || '';
  if (category.isDeleted || !validLocalDateKey(today) ||
      !validCategoryDateRange(startedOn, retiredOn)) return 'invalid';
  if (startedOn && startedOn > today) return 'upcoming';
  if (retiredOn && retiredOn < today) return 'retired';
  return 'active';
}

/**
 * A date-less Backlogs task uses the owner's current local date for its
 * lifecycle eligibility, but an existing Backlogs task is never hidden.
 */
export function canAddNewTaskToCategory(
  category: RetirableCategory,
  date: string,
  today = localTodayDateKey()
): boolean {
  if (category.isDeleted) return false;
  const startedOn = category.startedOn || '';
  const retiredOn = category.retiredOn || '';
  if (!validCategoryDateRange(startedOn, retiredOn)) return false;
  if (date === '') {
    return !retiredOn && (!startedOn || (validLocalDateKey(today) && startedOn <= today));
  }
  if (!validLocalDateKey(date)) return false;
  return (!startedOn || date >= startedOn) && (!retiredOn || date <= retiredOn);
}

export function retirementStateForDay(
  category: RetirableCategory,
  date: string,
  hasTasksOnDay: boolean
): CategoryDayState {
  if (category.isDeleted) return 'hidden';
  if (!canAddNewTaskToCategory(category, date)) {
    return hasTasksOnDay ? 'existing-tasks-only' : 'hidden';
  }
  return category.retiredOn && date !== '' ? 'historical' : 'active';
}

export function categoriesForDay<T extends RetirableCategory>(
  categories: T[],
  tasks: RetirableTask[],
  date: string,
  extraOccupiedCategoryIds: string[] = []
): Array<{ category: T; state: Exclude<CategoryDayState, 'hidden'> }> {
  const occupied = new Set<string>(extraOccupiedCategoryIds);
  for (const task of tasks) {
    if (!task.isDeleted && task.date === date) occupied.add(task.categoryId);
  }
  return categories.flatMap(category => {
    const state = retirementStateForDay(category, date, occupied.has(category.id));
    return state === 'hidden' ? [] : [{ category, state }];
  });
}
