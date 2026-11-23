import { describe, expect, it } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import { getLocalTodayKey, getTodayWidgetProgress, selectTodayWidgetTasks } from '../../src/lib/todayWidget';

const category = (id: string, order: number, userId = 'owner'): CategoryDocument => ({
  id, order, userId, name: id, color: '#999999', visibility: 'private',
  isDeleted: false, updatedAt: '',
});
const task = (id: string, overrides: Partial<TaskDocument> = {}): TaskDocument => ({
  id, title: id, completed: false, categoryId: 'a', order: 0,
  date: '2026-11-23', createdAt: '2026-11-23T00:00:00Z',
  updatedAt: '', userId: 'owner', isDeleted: false, visibility: 'private',
  ...overrides,
});

describe('Today widget owner-local projection', () => {
  it('uses local calendar parts, not UTC date serialization', () => {
    expect(getLocalTodayKey(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
    expect(getLocalTodayKey(new Date(2026, 10, 24, 0, 1))).toBe('2026-11-24');
  });

  it('shows owned nondeleted tasks for one date, both complete and incomplete', () => {
    const input = [
      task('today'), task('finished', { completed: true }),
      task('yesterday', { date: '2026-11-22' }),
      task('backlog', { date: '' }),
      task('friend', { userId: 'friend' }),
      task('deleted', { isDeleted: true }),
    ];
    expect(selectTodayWidgetTasks(input, [category('a', 0)], 'owner', '2026-11-23').map(t => t.id))
      .toEqual(['finished', 'today']);
    expect(selectTodayWidgetTasks(input, [category('a', 0)], '', '2026-11-23')).toEqual([]);
  });

  it('uses category order, task order and deterministic tie-breaking, without mutating input', () => {
    const input = [
      task('b2', { categoryId: 'b', order: 2 }),
      task('a2', { categoryId: 'a', order: 2 }),
      task('a1', { categoryId: 'a', order: 1 }),
      task('b1', { categoryId: 'b', order: 1 }),
      task('orphan', { categoryId: 'missing', order: 1 }),
    ];
    expect(selectTodayWidgetTasks(input, [category('a', 4), category('b', 2)], 'owner', '2026-11-23').map(t => t.id))
      .toEqual(['b1', 'b2', 'a1', 'a2', 'orphan']);
    expect(input[0]?.id).toBe('b2');
  });

  it('handles zero, partial and full progress without NaN', () => {
    expect(getTodayWidgetProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 });
    expect(getTodayWidgetProgress([task('a'), task('b', { completed: true })])).toEqual({
      completed: 1, total: 2, percentage: 50,
    });
    expect(getTodayWidgetProgress([task('a', { completed: true })]).percentage).toBe(100);
  });
});
