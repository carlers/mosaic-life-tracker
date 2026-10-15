import { describe, expect, it } from 'vitest';
import { toggleCategoryDaySelection } from '../../src/lib/categoryDaySelection';

const rows = [
  { id: 'selected', categoryId: 'work', date: '2026-10-15', userId: 'me', isDeleted: false },
  { id: 'unselected', categoryId: 'work', date: '2026-10-15', userId: 'me', isDeleted: false },
  { id: 'different-date', categoryId: 'work', date: '2026-10-16', userId: 'me', isDeleted: false },
  { id: 'other-category', categoryId: 'play', date: '2026-10-15', userId: 'me', isDeleted: false },
  { id: 'other-account', categoryId: 'work', date: '2026-10-15', userId: 'other', isDeleted: false },
  { id: 'deleted', categoryId: 'work', date: '2026-10-15', userId: 'me', isDeleted: true },
];

describe('category selection for one calendar day', () => {
  it('fills partial selections without selecting different dates/accounts/categories/deletions', () => {
    const original = new Set(['selected', 'other-category']);
    const result = toggleCategoryDaySelection(original, rows, 'work', '2026-10-15', 'me');
    expect([...result].sort()).toEqual(['other-category', 'selected', 'unselected']);
    expect([...original]).toEqual(['selected', 'other-category']);
  });

  it('deselects only the selected category when all eligible tasks were selected', () => {
    const result = toggleCategoryDaySelection(
      new Set(['selected', 'unselected', 'other-category', 'different-date']),
      rows, 'work', '2026-10-15', 'me'
    );
    expect([...result].sort()).toEqual(['different-date', 'other-category']);
  });

  it('keeps selection unchanged for an empty or unscoped category/date/identity', () => {
    for (const [cat, day, account] of [
      ['missing', '2026-10-15', 'me'], ['work', '', 'me'],
      ['work', '2026-10-15', ''],
    ]) expect(toggleCategoryDaySelection(new Set(['selected']), rows, cat, day, account))
      .toEqual(new Set(['selected']));
  });
});
