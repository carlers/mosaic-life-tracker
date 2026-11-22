import type { CategoryDocument, TaskDocument } from '../db/schema';

// Owner-scoped useSettings row; absence or malformed values are treated as All.
export const CALENDAR_CATEGORY_FILTER_SETTING_KEY = 'calendarCategoryFilterIds';
const MAX_SAVED_IDS = 256;
const CATEGORY_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/;

export function resolveCalendarCategoryFilterIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && CATEGORY_ID.test(item)) ids.add(item);
    if (ids.size === MAX_SAVED_IDS) break;
  }
  return [...ids];
}

export function availableCalendarCategoryFilterIds(
  saved: readonly string[],
  categories: readonly Pick<CategoryDocument, 'id' | 'isDeleted'>[]
): string[] {
  if (saved.length === 0) return [];
  return saved.filter(id => categories.some(category => !category.isDeleted && category.id === id));
}

/** Presentation only. Never pass the returned array to Day View or task mutations. */
export function filterCalendarPreviewTasks(
  tasks: TaskDocument[],
  selectedCategoryIds: readonly string[]
): TaskDocument[] {
  if (selectedCategoryIds.length === 0) return tasks;
  const selected = new Set(selectedCategoryIds);
  return tasks.filter(task => selected.has(task.categoryId));
}
