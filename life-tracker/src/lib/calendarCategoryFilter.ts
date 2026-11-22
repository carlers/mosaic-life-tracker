import type { CategoryDocument } from '../db/schema';

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

