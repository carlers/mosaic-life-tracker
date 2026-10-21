import { describe, expect, it } from 'vitest';
import {
  categoriesForDay, categoryDeletionCount, retirementStateForDay,
  validLocalDateKey,
} from '../../src/lib/categoryLifecycle';

describe('historical category lifecycle (#857)', () => {
  const category = { id: 'study', isDeleted: false, retiredOn: '2026-10-21' };

  it('uses an inclusive owner-local date cutoff and accepts leap days', () => {
    expect(validLocalDateKey('2024-02-29')).toBe(true);
    expect(validLocalDateKey('2025-02-29')).toBe(false);
    expect(validLocalDateKey('2026-10-32')).toBe(false);
    expect(retirementStateForDay(category, '2026-10-20', false)).toBe('historical');
    expect(retirementStateForDay(category, '2026-10-21', false)).toBe('historical');
    expect(retirementStateForDay(category, '2026-10-22', false)).toBe('hidden');
  });

  it('does not make future tasks disappear or permit new future tasks', () => {
    const entries = categoriesForDay(
      [category, { id: 'work', isDeleted: false }],
      [{ categoryId: 'study', date: '2026-10-22', isDeleted: false }],
      '2026-10-22',
    );
    expect(entries).toEqual([
      { category, state: 'existing-tasks-only', canAddTasks: false },
      { category: { id: 'work', isDeleted: false }, state: 'normal', canAddTasks: true },
    ]);
  });

  it('preserves findability for undated backlog tasks without new assignment', () => {
    expect(categoriesForDay([category], [
      { categoryId: 'study', date: '', isDeleted: false },
    ], '')).toEqual([{ category, state: 'existing-tasks-only', canAddTasks: false }]);
    expect(categoriesForDay([category], [], '')).toEqual([]);
  });

  it('restored categories return to ordinary dates without altering task IDs', () => {
    expect(retirementStateForDay({ ...category, retiredOn: '' }, '2028-10-22', false)).toBe('normal');
    expect(retirementStateForDay({ ...category, isDeleted: true }, '2020-10-22', true)).toBe('hidden');
  });

  it('counts all active category tasks across dates before destructive deletion', () => {
    const all = [
      { categoryId: 'study', date: '2026-01-01', isDeleted: false },
      { categoryId: 'study', date: '', isDeleted: false },
      { categoryId: 'study', date: '2028-01-01', isDeleted: false },
      { categoryId: 'study', date: '2020-01-01', isDeleted: true },
      { categoryId: 'work', date: '2026-01-01', isDeleted: false },
    ];
    expect(categoryDeletionCount('study', all)).toBe(3);
    expect(all.map(t => t.categoryId)).toEqual(['study', 'study', 'study', 'study', 'work']);
  });

  it('refuses corrupt cutoffs instead of hiding old tasks silently', () => {
    expect(() => retirementStateForDay({ ...category, retiredOn: '2026-02-30' },
      '2026-10-22', false)).toThrow(/invalid/i);
  });
});
