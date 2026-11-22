import type { CategoryDocument, TaskDocument } from '../db/schema';

// Owner-scoped useSettings row; absence or malformed values are treated as All.
export const CALENDAR_CATEGORY_FILTER_SETTING_KEY = 'calendarCategoryFilterIds';
/** Only current owner category IDs may affect the visible Calendar. Bound malformed settings. */
export function selectCalendarCategoryIds(
  saved: unknown,
  categories: readonly Pick<CategoryDocument, 'id' | 'isDeleted'>[]
): string[] {
  if (!Array.isArray(saved)) return [];
  const selected = new Set(saved.slice(0, 256));
  return categories.filter(category => !category.isDeleted && selected.has(category.id))
    .map(category => category.id);
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
