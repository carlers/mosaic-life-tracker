import { describe, expect, it } from 'vitest';
import type { CategoryDocument } from '../../src/db/schema';
import {
  selectCalendarCategoryIds,
} from '../../src/lib/calendarCategoryFilter';

const cat = (id: string, isDeleted = false) => ({ id, isDeleted }) as CategoryDocument;

describe('calendar category preview filter', () => {
  it('treats empty and malformed saved settings as all categories and returns the input array unchanged', () => {
    expect(selectCalendarCategoryIds(null, [cat('school')])).toEqual([]);
    expect(selectCalendarCategoryIds('school', [cat('school')])).toEqual([]);
  });

  it('deduplicates and validates saved IDs without assuming names are unique', () => {
    expect(selectCalendarCategoryIds(['school', 'school', false, '../bad', 'work', ''],
      [cat('school'), cat('work')])).toEqual(['school', 'work']);
  });

  it('keeps historical/retired categories and removes deleted and unknown IDs', () => {
    const categories = [cat('school'), cat('retired'), cat('deleted', true)];
    expect(selectCalendarCategoryIds(['retired', 'missing', 'deleted', 'school'], categories))
      .toEqual(['school', 'retired']);
    expect(selectCalendarCategoryIds(['deleted'], categories)).toEqual([]);
  });
});
