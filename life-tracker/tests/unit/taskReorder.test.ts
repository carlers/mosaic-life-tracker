import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import {
  buildAffectedTaskOrderGroups,
  buildRenderedTasksByCategory,
  categoryStartDropId,
  diaryTaskDropId,
  parseDropTarget,
  projectTaskPlacement,
  stableMixedTaskDropId,
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

  it('does not commit an old hover projection after an outside release and can drag again', () => {
    const snapshot = { cat_a: ['a1', 'a2'], cat_b: ['b1'] };
    const hovered = projectTaskPlacement(snapshot, 'a1', taskInsertDropId('cat_b', 'b1', 'after'));
    expect(hovered).toEqual({ cat_a: ['a2'], cat_b: ['b1', 'a1'] });

    // A canceled/outside drop has no target; the stored snapshot is unchanged.
    expect(projectTaskPlacement(snapshot, 'a1', 'outside')).toBeNull();
    expect(snapshot).toEqual({ cat_a: ['a1', 'a2'], cat_b: ['b1'] });
    expect(projectTaskPlacement(snapshot, 'a2', taskGapDropId('cat_b', 0)))
      .toEqual({ cat_a: ['a1'], cat_b: ['a2', 'b1'] });
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
  it('targets either half of a diary card even when no free gap exists above it', () => {
    const before=diaryTaskDropId('cat_a',0,'before');
    const after=diaryTaskDropId('cat_a',0,'after');
    expect(parseDropTarget(before)).toEqual({
      categoryId:'cat_a',position:'index',index:0,diarySide:'before'
    });
    expect(parseDropTarget(after)).toEqual({
      categoryId:'cat_a',position:'index',index:0,diarySide:'after'
    });
    expect(projectTaskPlacement({cat_a:['a1','a2']},'a2',before))
      .toEqual({cat_a:['a2','a1']});
    expect(projectTaskPlacement({cat_a:['a1','a2']},'a1',diaryTaskDropId('cat_a',1,'after')))
      .toEqual({cat_a:['a1','a2']});
    expect(projectTaskPlacement({cat_a:['a1','a2']},'a1',diaryTaskDropId('cat_a',1,'before')))
      .toEqual({cat_a:['a1','a2']});
    expect(parseDropTarget('task-diary-insert:cat_a:oops:before')).toBeNull();
    expect(parseDropTarget('task-diary-insert:cat_a:0:neither')).toBeNull();
  });

  it('keeps mixed note/task slots stable when projected gaps move painted rows', () => {
    // Rows captured once after the dragged task leaves normal flow.
    const geometry = [
      { categoryId: 'a', rect: { left: 0, right: 320, top: 100, bottom: 318 },
        rows: [
          { kind: 'note' as const, id: 'note_a', midpoint: 148 },
          { kind: 'task' as const, id: 'task_a', midpoint: 200 },
          { kind: 'task' as const, id: 'task_b', midpoint: 258 },
        ] },
      { categoryId: 'b', rect: { left: 0, right: 320, top: 338, bottom: 400 },
        rows: [{ kind: 'task' as const, id: 'task_c', midpoint: 373 }] },
    ];
    const hit = (y: number, liveTop = 100) =>
      stableMixedTaskDropId(geometry, { x: 125, y }, { id: 'a', top: liveTop });
    // Moving task_a by the note-sized gap must not switch to after-task_a.
    for (const y of [185, 187, 195])
      expect(hit(y)).toBe(taskInsertDropId('a', 'task_a', 'before'));
    expect(hit(203)).toBe(taskInsertDropId('a', 'task_b', 'before'));
    // Rebase when the entire category shifts due to an earlier gap/scroll.
    expect(hit(275, 180)).toBe(taskInsertDropId('a', 'task_a', 'before'));
    expect(hit(385, 180)).toBe(taskInsertDropId('a', 'task_b', 'after'));
    expect(hit(115)).toBe(taskInsertDropId('a', 'diary_note_note_a', 'before'));
    expect(stableMixedTaskDropId(geometry, { x: 125, y: 370 },
      { id: 'b', top: 338 })).toBe(taskInsertDropId('b', 'task_c', 'before'));
    expect(stableMixedTaskDropId(geometry, { x: 500, y: 370 },
      { id: 'b', top: 338 })).toBeNull();
  });

});
