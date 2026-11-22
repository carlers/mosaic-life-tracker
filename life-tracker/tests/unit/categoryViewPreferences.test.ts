import { describe, expect, it } from 'vitest';
import { projectCategoryTasks, resolveCategoryFilter, resolveCategoryOrder, resolveCategorySwipe } from '../../src/lib/categoryViewPreferences';
import type { TaskDocument } from '../../src/db/schema';

const task = (id: string, date: string, completed = false, categoryId = 'school', userId = 'owner'): TaskDocument => ({
  id, title: id, date, completed, categoryId, userId, visibility: '',
  order: 1, createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z', isDeleted: false,
});

describe('Category View category-first projection (#2278)', () => {
  const tasks = [
    task('today', '2026-11-22'), task('past-old', '2026-11-10', true),
    task('past-new', '2026-11-21'), task('future', '2026-12-01'),
    task('undated', ''), task('invalid', '2026-02-30'),
    task('wrong-category', '2026-11-22', false, 'work'),
    task('other-user', '2026-11-22', false, 'school', 'different-owner'),
    { ...task('deleted', '2026-11-22'), isDeleted: true },
  ];
  it('starts at today, retains dated history, future, backlog and invalid legacy rows', () => {
    const groups = projectCategoryTasks(tasks, 'school', 'owner', '2026-11-22', 'all', 'newest');
    expect(groups.today.map(t => t.id)).toEqual(['today']);
    expect(groups.past.map(g => g.date)).toEqual(['2026-11-21', '2026-11-10']);
    expect(groups.upcoming.map(g => g.date)).toEqual(['2026-12-01']);
    expect(groups.undated.map(t => t.id)).toEqual(['undated']);
    expect(groups.invalid.map(t => t.id)).toEqual(['invalid']);
  });
  it('sorts oldest-first without rewriting canonical tasks or date orders', () => {
    const before = JSON.stringify(tasks);
    const groups = projectCategoryTasks(tasks, 'school', 'owner', '2026-11-22', 'all', 'oldest');
    expect(groups.past.map(g => g.date)).toEqual(['2026-11-10', '2026-11-21']);
    expect(JSON.stringify(tasks)).toEqual(before);
  });
  it('applies completion filtering without leaking another category or owner', () => {
    const completed = projectCategoryTasks(tasks, 'school', 'owner', '2026-11-22', 'completed', 'newest');
    expect(completed.past.flatMap(g => g.tasks.map(t => t.id))).toEqual(['past-old']);
    expect(completed.today).toEqual([]);
    const incomplete = projectCategoryTasks(tasks, 'school', 'owner', '2026-11-22', 'incomplete', 'newest');
    expect(incomplete.past.flatMap(g => g.tasks.map(t => t.id))).toEqual(['past-new']);
  });
  it('sanitizes unknown preference values', () => {
    expect(resolveCategoryOrder('unsupported')).toBe('newest');
    expect(resolveCategoryFilter('unsupported')).toBe('all');
    expect(resolveCategorySwipe('unsupported', 'off')).toBe('off');
    expect(resolveCategorySwipe('reveal', 'off')).toBe('reveal');
  });
});
