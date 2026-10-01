import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import {
  buildTaskOrderAssignments,
  buildTaskPlacement,
  moveTaskInPlacement,
} from '../../src/lib/taskOrder';

const task = (
  id: string,
  categoryId: string,
  order: number
): TaskDocument => ({
  id,
  title: id,
  completed: false,
  categoryId,
  order,
  date: '2026-09-15',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  userId: 'user_1',
  isDeleted: false,
  visibility: 'private',
});

describe('task ordering', () => {
  it('moves a task between categories without mutating the source placement', () => {
    const placement = {
      cat_a: ['a1', 'a2'],
      cat_b: ['b1', 'b2'],
    };

    const next = moveTaskInPlacement(placement, 'a1', 'cat_b', 1);

    expect(next).toEqual({
      cat_a: ['a2'],
      cat_b: ['b1', 'a1', 'b2'],
    });
    expect(placement).toEqual({
      cat_a: ['a1', 'a2'],
      cat_b: ['b1', 'b2'],
    });
  });

  it('supports moving into an empty category and emptying the source category', () => {
    expect(
      moveTaskInPlacement(
        { cat_a: ['a1'], cat_empty: [] },
        'a1',
        'cat_empty',
        0
      )
    ).toEqual({
      cat_a: [],
      cat_empty: ['a1'],
    });
  });

  it('builds normalized assignments across both affected categories', () => {
    const current = [
      task('a1', 'cat_a', 0),
      task('a2', 'cat_a', 1),
      task('b1', 'cat_b', 0),
    ];

    expect(
      buildTaskOrderAssignments(current, 'user_1', '2026-09-15', [
        { categoryId: 'cat_a', taskIds: ['a2'] },
        { categoryId: 'cat_b', taskIds: ['b1', 'a1'] },
      ])
    ).toEqual(
      expect.arrayContaining([
        { id: 'a2', categoryId: 'cat_a', order: 0 },
        { id: 'b1', categoryId: 'cat_b', order: 0 },
        { id: 'a1', categoryId: 'cat_b', order: 1 },
      ])
    );
  });

  it('fails closed if a concurrent task makes the affected groups stale', () => {
    const current = [
      task('a1', 'cat_a', 0),
      task('a2', 'cat_a', 1),
      task('b1', 'cat_b', 0),
    ];

    expect(() =>
      buildTaskOrderAssignments(current, 'user_1', '2026-09-15', [
        { categoryId: 'cat_a', taskIds: ['a2'] },
        { categoryId: 'cat_b', taskIds: ['a1'] },
      ])
    ).toThrow(/changed while reordering/);
  });

  it('preserves the existing deterministic within-category ordering', () => {
    const tasks = [
      task('later', 'cat_a', 1),
      task('first', 'cat_a', 0),
      task('other', 'cat_b', 0),
    ];

    expect(buildTaskPlacement(tasks, ['cat_a', 'cat_b'])).toEqual({
      cat_a: ['first', 'later'],
      cat_b: ['other'],
    });
  });
});
