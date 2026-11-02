import { describe, expect, it } from 'vitest';
import { findTasksWithoutActiveCategory } from '../../src/lib/categoryOrphans';

const task = (id: string, categoryId: string, userId = 'owner', date = '2026-10-31', isDeleted = false) =>
  ({ id, categoryId, userId, date, isDeleted, title: id, completed: false });
const category = (id: string, userId = 'owner', isDeleted = false) =>
  ({ id, userId, isDeleted });

describe('read-only category orphan inventory', () => {
  it('finds owner tasks with tombstoned or missing categories across dates and Backlogs', () => {
    const tasks = [
      task('valid', 'live'), task('old', 'removed', 'owner', '2026-10-30'),
      task('backlog', 'missing', 'owner', ''), task('other', 'removed', 'other'),
      task('already-deleted', 'removed', 'owner', '', true),
    ];
    const snapshot = JSON.stringify(tasks);
    expect(findTasksWithoutActiveCategory(tasks, [
      category('live'), category('removed', 'owner', true), category('removed', 'other'),
    ], 'owner').map(row => row.id)).toEqual(['backlog', 'old']);
    expect(JSON.stringify(tasks)).toBe(snapshot);
  });
  it('does not expose tasks when the owner is missing or switched', () => {
    const tasks = [task('mine', 'missing'), task('foreign', 'missing', 'other')];
    expect(findTasksWithoutActiveCategory(tasks, [], null)).toEqual([]);
    expect(findTasksWithoutActiveCategory(tasks, [], 'other').map(t => t.id)).toEqual(['foreign']);
  });
});
