import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import {
  buildAffectedTaskOrderGroups,
  buildRenderedTasksByCategory,
  categoryStartDropId,
  projectTaskPlacement,
  taskGapDropId,
  taskInsertDropId,
  taskPlacementsEqual,
} from '../../src/components/home/views/taskReorder';

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

describe('task reorder projection', () => {
  it('projects before/after targets without mutating the drag snapshot', () => {
    const snapshot = {
      cat_a: ['a1', 'a2', 'a3'],
      cat_b: ['b1', 'b2'],
    };

    expect(
      projectTaskPlacement(
        snapshot,
        'a1',
        taskInsertDropId('cat_a', 'a3', 'after')
      )
    ).toEqual({
      cat_a: ['a2', 'a3', 'a1'],
      cat_b: ['b1', 'b2'],
    });

    expect(
      projectTaskPlacement(
        snapshot,
        'a2',
        taskInsertDropId('cat_b', 'b2', 'before')
      )
    ).toEqual({
      cat_a: ['a1', 'a3'],
      cat_b: ['b1', 'a2', 'b2'],
    });

    expect(snapshot).toEqual({
      cat_a: ['a1', 'a2', 'a3'],
      cat_b: ['b1', 'b2'],
    });
  });

  it('projects category-start and exact-gap targets, including empty categories', () => {
    const snapshot = {
      cat_a: ['a1', 'a2'],
      cat_b: ['b1'],
      cat_empty: [],
    };

    expect(
      projectTaskPlacement(snapshot, 'a2', categoryStartDropId('cat_b'))
    ).toEqual({
      cat_a: ['a1'],
      cat_b: ['a2', 'b1'],
      cat_empty: [],
    });

    expect(
      projectTaskPlacement(snapshot, 'a1', taskGapDropId('cat_empty', 0))
    ).toEqual({
      cat_a: ['a2'],
      cat_b: ['b1'],
      cat_empty: ['a1'],
    });
  });

  it('rejects stale or malformed drop targets', () => {
    const snapshot = {
      cat_a: ['a1'],
      cat_b: ['b1'],
    };

    expect(projectTaskPlacement(snapshot, 'missing', categoryStartDropId('cat_b'))).toBeNull();
    expect(projectTaskPlacement(snapshot, 'a1', categoryStartDropId('unknown'))).toBeNull();
    expect(projectTaskPlacement(snapshot, 'a1', 'task-gap:cat_b:not-a-number')).toBeNull();
    expect(projectTaskPlacement(snapshot, 'a1', 'unknown-target')).toBeNull();
  });

  it('compares placements and builds only the affected persistence groups', () => {
    const snapshot = {
      cat_a: ['a1', 'a2'],
      cat_b: ['b1'],
      cat_c: ['c1'],
    };
    const finalPlacement = {
      cat_a: ['a2'],
      cat_b: ['b1', 'a1'],
      cat_c: ['c1'],
    };

    expect(
      taskPlacementsEqual(snapshot, { ...snapshot, cat_a: ['a1', 'a2'] }, [
        'cat_a',
        'cat_b',
        'cat_c',
      ])
    ).toBe(true);
    expect(
      taskPlacementsEqual(snapshot, finalPlacement, [
        'cat_a',
        'cat_b',
        'cat_c',
      ])
    ).toBe(false);
    expect(
      buildAffectedTaskOrderGroups(snapshot, finalPlacement, 'a1')
    ).toEqual([
      { categoryId: 'cat_a', taskIds: ['a2'] },
      { categoryId: 'cat_b', taskIds: ['b1', 'a1'] },
    ]);
  });

  it('renders projected category/order overrides from plain task snapshots', () => {
    const tasks = [
      task('a1', 'cat_a', 0),
      task('a2', 'cat_a', 1),
      task('b1', 'cat_b', 0),
    ];

    const rendered = buildRenderedTasksByCategory(
      tasks,
      {
        cat_a: ['a2'],
        cat_b: ['b1', 'a1'],
      },
      ['cat_a', 'cat_b']
    );

    expect(rendered.get('cat_a')).toEqual([
      expect.objectContaining({ id: 'a2', categoryId: 'cat_a', order: 0 }),
    ]);
    expect(rendered.get('cat_b')).toEqual([
      tasks[2],
      expect.objectContaining({ id: 'a1', categoryId: 'cat_b', order: 1 }),
    ]);
  });
});
