import { describe, expect, it } from 'vitest';
import { canAddNewTaskToCategory, categoriesForDay, retirementStateForDay, validLocalDateKey } from '../../src/lib/categoryLifecycle';

const cat = (retiredOn = '', isDeleted = false) =>
  ({ id: 'original', retiredOn, isDeleted });
const task = (date: string) =>
  ({ categoryId: 'original', date, isDeleted: false });

describe('historical category retirement (#857)', () => {
  it('validates owner calendar dates including leap days', () => {
    expect(validLocalDateKey('2028-02-29')).toBe(true);
    expect(validLocalDateKey('2026-02-29')).toBe(false);
    expect(validLocalDateKey('2026-13-01')).toBe(false);
    expect(validLocalDateKey('2026-11-01T00:00:00Z')).toBe(false);
  });
  it('retains cutoff-day and earlier categories while hiding empty later categories', () => {
    expect(retirementStateForDay(cat('2026-11-01'), '2026-10-31', false)).toBe('historical');
    expect(retirementStateForDay(cat('2026-11-01'), '2026-11-01', false)).toBe('historical');
    expect(retirementStateForDay(cat('2026-11-01'), '2026-11-02', false)).toBe('hidden');
    expect(retirementStateForDay(cat('2026-11-01'), '2026-11-02', true)).toBe('existing-tasks-only');
  });
  it('retains future and Backlogs tasks without offering retired category for new assignments', () => {
    expect(categoriesForDay([cat('2026-11-01')], [task('2026-11-05')], '2026-11-05')[0]?.state).toBe('existing-tasks-only');
    expect(categoriesForDay([cat('2026-11-01')], [task('')], '')[0]?.state).toBe('existing-tasks-only');
    expect(categoriesForDay([cat('2026-11-01')], [], '')).toEqual([]);
    expect(canAddNewTaskToCategory(cat('2026-11-01'), '2026-11-01')).toBe(true);
    expect(canAddNewTaskToCategory(cat('2026-11-01'), '2026-11-02')).toBe(false);
    expect(canAddNewTaskToCategory(cat('2026-11-01'), '')).toBe(false);
  });
  it('keeps active categories and suppresses deleted ones', () => {
    expect(categoriesForDay([cat()], [], '2026-11-30')).toHaveLength(1);
    expect(categoriesForDay([cat('2026-11-01', true)], [task('2026-10-31')], '2026-10-31')).toHaveLength(0);
  });
  it('includes received shared-task placements in future', () => {
    expect(categoriesForDay([cat('2026-11-01')], [], '2026-11-05', ['original'])[0]?.state).toBe('existing-tasks-only');
  });
});
