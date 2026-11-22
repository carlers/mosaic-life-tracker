import { addMonths, format, startOfMonth } from 'date-fns';
import type { DiaryDocument, TaskDocument } from '../db/schema';

export type CompactActivityZoom = 'month' | 'half-year' | 'year';
export type CompactActivityMode = 'todo' | 'diary';
export const TODO_COMPACT_ZOOM_KEY = 'todoCompactActivityZoom';
export const DIARY_COMPACT_ZOOM_KEY = 'diaryCompactActivityZoom';
export const TODO_COMPACT_CATEGORY_KEY = 'todoCompactCategoryFilterIds';

export function resolveCompactActivityZoom(value: unknown): CompactActivityZoom {
  return value === 'year' || value === 'half-year' ? value : 'month';
}

export function compactActivityPeriodMonths(date: Date, zoom: CompactActivityZoom): Date[] {
  const year = date.getFullYear();
  const start = zoom === 'year'
    ? new Date(year, 0, 1)
    : zoom === 'half-year'
      ? new Date(year, date.getMonth() < 6 ? 0 : 6, 1)
      : startOfMonth(date);
  const count = zoom === 'year' ? 12 : zoom === 'half-year' ? 6 : 1;
  return Array.from({ length: count }, (_, index) => addMonths(start, index));
}

export function compactActivityPeriodStep(zoom: CompactActivityZoom): number {
  return zoom === 'year' ? 12 : zoom === 'half-year' ? 6 : 1;
}

export function compactActivityPeriodTitle(date: Date, zoom: CompactActivityZoom): string {
  if (zoom === 'month') return format(date, 'MMMM yyyy');
  if (zoom === 'year') return format(date, 'yyyy');
  const months = compactActivityPeriodMonths(date, zoom);
  return format(months[0], 'MMM') + '–' + format(months[5], 'MMM yyyy');
}

export function nextCompactActivityZoom(
  zoom: CompactActivityZoom, direction: 'in' | 'out',
): CompactActivityZoom {
  if (direction === 'out') return zoom === 'month' ? 'half-year' : 'year';
  return zoom === 'year' ? 'half-year' : 'month';
}

/** Accept only real owner-local calendar dates. Malformed archived rows cannot create fake activity. */
function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Pure one-pass aggregation: no cards, images, diary body content, or received shared tasks. */
export function compactActivityCounts(
  mode: CompactActivityMode,
  tasks: readonly Pick<TaskDocument, 'date' | 'categoryId' | 'isDeleted'>[],
  diaryEntries: readonly Pick<DiaryDocument, 'date' | 'isDeleted'>[],
  categoryIds: readonly string[] = [],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const selected = categoryIds.length > 0 ? new Set(categoryIds) : null;
  const records = mode === 'diary' ? diaryEntries : tasks;
  for (const record of records) {
    if (record.isDeleted || !isCalendarDay(record.date)) continue;
    if (mode === 'todo' && selected &&
      (!('categoryId' in record) || typeof record.categoryId !== 'string' || !selected.has(record.categoryId))) continue;
    counts.set(record.date, (counts.get(record.date) ?? 0) + 1);
  }
  return counts;
}

export function compactActivityIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return count <= 6 ? 3 : 4;
}
