import { describe, expect, it } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import {
  availableCalendarCategoryFilterIds,
  filterCalendarPreviewTasks,
  resolveCalendarCategoryFilterIds,
} from '../../src/lib/calendarCategoryFilter';

const cat = (id: string, isDeleted = false) => ({ id, isDeleted }) as CategoryDocument;
const task = (id: string, categoryId: string) => ({ id, categoryId, date: '2026-11-22' }) as TaskDocument;

describe('calendar category preview filter', () => {
  it('treats empty and malformed saved settings as all categories and returns the input array unchanged', () => {
    const tasks = [task('a', 'school')];
    expect(resolveCalendarCategoryFilterIds(null)).toEqual([]);
    expect(resolveCalendarCategoryFilterIds('school')).toEqual([]);
    expect(filterCalendarPreviewTasks(tasks, [])).toBe(tasks);
  });

  it('deduplicates and validates saved IDs without assuming names are unique', () => {
    expect(resolveCalendarCategoryFilterIds(['school', 'school', false, '../bad', 'work', '']))
      .toEqual(['school', 'work']);
  });

  it('uses OR across categories and leaves the original tasks and order intact', () => {
    const original = [task('a', 'school'), task('b', 'work'), task('c', 'home'), task('d', 'school')];
    const visible = filterCalendarPreviewTasks(original, ['school', 'home']);
    expect(visible.map(item => item.id)).toEqual(['a', 'c', 'd']);
    expect(original.map(item => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps historical/retired categories and removes deleted and unknown IDs', () => {
    const categories = [cat('school'), cat('retired'), cat('deleted', true)];
    expect(availableCalendarCategoryFilterIds(['retired', 'missing', 'deleted', 'school'], categories))
      .toEqual(['retired', 'school']);
    expect(availableCalendarCategoryFilterIds(['deleted'], categories)).toEqual([]);
  });
});
