import { describe, expect, it } from 'vitest';
import { canAddNewTaskToCategory, categoriesForDay, categoryLifecycleStatus, retirementStateForDay, validCategoryDateRange, validLocalDateKey } from '../../src/lib/categoryLifecycle';

const cat = (retiredOn = '', isDeleted = false, startedOn = '') =>
  ({ id: 'original', retiredOn, startedOn, isDeleted });
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
  it('enforces inclusive start and retirement boundaries', () => {
    const category = cat('2026-11-10', false, '2026-11-05');
    expect(canAddNewTaskToCategory(category, '2026-11-04')).toBe(false);
    expect(canAddNewTaskToCategory(category, '2026-11-05')).toBe(true);
    expect(canAddNewTaskToCategory(category, '2026-11-10')).toBe(true);
    expect(canAddNewTaskToCategory(category, '2026-11-11')).toBe(false);
  });

  it('classifies future starts and preserves existing tasks outside the interval', () => {
    const category = cat('', false, '2026-11-12');
    expect(categoryLifecycleStatus(category, '2026-11-11')).toBe('upcoming');
    expect(canAddNewTaskToCategory(category, '2026-11-11')).toBe(false);
    expect(retirementStateForDay(category, '2026-11-11', true)).toBe('existing-tasks-only');
    expect(retirementStateForDay(category, '2026-11-11', false)).toBe('hidden');
  });

  it('allows Backlogs only after start and before any retirement cutoff', () => {
    expect(canAddNewTaskToCategory(cat('', false, '2026-11-10'), '', '2026-11-11')).toBe(true);
    expect(canAddNewTaskToCategory(cat('', false, '2026-11-12'), '', '2026-11-11')).toBe(false);
    expect(canAddNewTaskToCategory(cat('2026-11-12', false, '2026-11-10'), '', '2026-11-11')).toBe(false);
  });

  it('rejects malformed and inverted lifecycle ranges', () => {
    expect(validCategoryDateRange('2026-02-30', '')).toBe(false);
    expect(validCategoryDateRange('2026-11-12', '2026-11-11')).toBe(false);
    expect(canAddNewTaskToCategory(cat('2026-11-11', false, '2026-11-12'), '2026-11-12')).toBe(false);
  });

});
