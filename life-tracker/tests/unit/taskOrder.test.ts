import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import {
  buildBulkMoveTaskOrderGroups,
  buildTaskOrderAssignments,
  buildTaskPlacement,
  getNewTaskOrder,
  isTaskPlacementCompatible,
  materializeTaskDocument,
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
  it('places new tasks at the requested end without renumbering siblings', () => {
    const siblings = [
      task('first', 'cat_a', 0),
      task('middle', 'cat_a', 3),
      task('last', 'cat_a', 7),
    ];

    expect(getNewTaskOrder(siblings, 'top')).toBe(0);
    expect(getNewTaskOrder(siblings, 'bottom')).toBe(8);
    expect(getNewTaskOrder([], 'top')).toBe(0);
    expect(getNewTaskOrder([], 'bottom')).toBe(0);
  });

  it('rejects optimistic placement with missing, duplicate, or unknown tasks', () => {
    const live = {
      cat_a: ['a1', 'a2'],
      cat_b: ['b1'],
    };

    expect(
      isTaskPlacementCompatible(
        { cat_a: ['a2'], cat_b: ['b1', 'a1'] },
        live,
        ['cat_a', 'cat_b']
      )
    ).toBe(true);
    expect(
      isTaskPlacementCompatible(
        { cat_a: ['a1'], cat_b: ['b1'] },
        live,
        ['cat_a', 'cat_b']
      )
    ).toBe(false);
    expect(
      isTaskPlacementCompatible(
        { cat_a: ['a1', 'a1'], cat_b: ['b1'] },
        live,
        ['cat_a', 'cat_b']
      )
    ).toBe(false);
    expect(
      isTaskPlacementCompatible(
        { cat_a: ['a1', 'a2'], cat_b: ['b1'], cat_other: ['ghost'] },
        live,
        ['cat_a', 'cat_b']
      )
    ).toBe(false);
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

  it('materializes RxDocument-backed tasks without losing schema fields', () => {
    const plain = {
      ...task('legacy', 'cat_a', 0),
      title: 'Legacy task',
      memo: 'memo',
      image: 'image_1',
      reactions: '[{"emoji":"👍","userId":"user_2"}]',
    };
    const rxLike = new Proxy({} as TaskDocument, {
      get(_target, property) {
        if (property === 'toJSON') {
          return () => ({ ...plain });
        }
        return plain[property as keyof TaskDocument];
      },
    });

    expect({ ...rxLike }).toEqual({});
    expect(materializeTaskDocument(rxLike)).toEqual(plain);
    expect(materializeTaskDocument(plain)).toBe(plain);
  });

  it('keeps duplicate legacy orders deterministic until a completed reorder normalizes them', () => {
    const tasks = [
      { ...task('older', 'cat_a', 0), createdAt: '2026-09-01T00:00:00.000Z' },
      { ...task('newer', 'cat_a', 0), createdAt: '2026-09-02T00:00:00.000Z' },
      { ...task('third', 'cat_a', 0), createdAt: '2026-08-31T00:00:00.000Z' },
    ];

    expect(buildTaskPlacement(tasks, ['cat_a'])).toEqual({
      cat_a: ['newer', 'older', 'third'],
    });
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


  it('builds a deterministic multi-category bulk move in visible category order', () => {
    const tasks = [
      task('a1', 'cat_a', 0),
      task('a2', 'cat_a', 1),
      task('b1', 'cat_b', 0),
      task('b2', 'cat_b', 1),
      task('c1', 'cat_c', 0),
    ];

    expect(
      buildBulkMoveTaskOrderGroups(
        tasks,
        ['b2', 'a1', 'c1'],
        'cat_b',
        ['cat_a', 'cat_b', 'cat_c']
      )
    ).toEqual([
      { categoryId: 'cat_a', taskIds: ['a2'] },
      { categoryId: 'cat_b', taskIds: ['b1', 'b2', 'a1', 'c1'] },
      { categoryId: 'cat_c', taskIds: [] },
    ]);
  });

  it('keeps selected tasks already in the destination in place', () => {
    const tasks = [
      task('a1', 'cat_a', 0),
      task('b1', 'cat_b', 0),
      task('b2', 'cat_b', 1),
    ];

    expect(
      buildBulkMoveTaskOrderGroups(
        tasks,
        ['b1', 'a1'],
        'cat_b',
        ['cat_a', 'cat_b']
      )
    ).toEqual([
      { categoryId: 'cat_a', taskIds: [] },
      { categoryId: 'cat_b', taskIds: ['b1', 'b2', 'a1'] },
    ]);
  });

  it('fails closed for stale selections or invalid destinations and no-ops when all tasks are already there', () => {
    const tasks = [
      task('a1', 'cat_a', 0),
      task('b1', 'cat_b', 0),
    ];

    expect(() =>
      buildBulkMoveTaskOrderGroups(
        tasks,
        ['missing'],
        'cat_b',
        ['cat_a', 'cat_b']
      )
    ).toThrow(/changed while moving/);

    expect(() =>
      buildBulkMoveTaskOrderGroups(
        tasks,
        ['a1'],
        'missing',
        ['cat_a', 'cat_b']
      )
    ).toThrow(/Invalid destination category/);

    expect(
      buildBulkMoveTaskOrderGroups(
        tasks,
        ['b1'],
        'cat_b',
        ['cat_a', 'cat_b']
      )
    ).toEqual([]);
  });
});
