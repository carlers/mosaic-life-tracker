import { describe, expect, it } from 'vitest';
import { resolveDiaryDragHit, resolveDiaryReleaseHit, type DiaryDragHitRegion } from './diaryDropGeometry';

const regions: DiaryDragHitRegion[] = [
  { categoryId: 'a', rect: { left: 0, right: 320, top: 100, bottom: 210 },
    rows: [
      { kind: 'note', id: 'first', midpoint: 152 },
      { kind: 'task', id: 'a-task', midpoint: 184 },
      { kind: 'note', id: 'last', midpoint: 205 },
    ] },
  { categoryId: 'b', rect: { left: 0, right: 320, top: 230, bottom: 350 },
    rows: [{ kind: 'task', id: 'b-task', midpoint: 277 }] },
];

describe('captured Diary note drag boundaries', () => {
  it('inserts immediately after the first category pill, before its first note', () => {
    expect(resolveDiaryDragHit(null, regions, 120, 116, 'moving')).toEqual({
      kind: 'category', drop: { categoryId: 'a', position: 'note', noteId: 'first', side: 'before' },
    });
  });
  it('can insert after the last note, including the lower half of the category margin', () => {
    expect(resolveDiaryDragHit(null, regions, 120, 216, 'moving')).toEqual({
      kind: 'category', drop: { categoryId: 'a', position: 'note', noteId: 'last', side: 'after' },
    });
  });
  it('can insert before the first task in the next category across the same margin', () => {
    expect(resolveDiaryDragHit(null, regions, 120, 225, 'moving')).toEqual({
      kind: 'category', drop: { categoryId: 'b', position: 'before', taskId: 'b-task' },
    });
  });
  it('excludes the source note even when it is the only row', () => {
    expect(resolveDiaryDragHit(null, [regions[0]], 120, 205, 'last')).toEqual({
      kind: 'category', drop: { categoryId: 'a', position: 'after', taskId: 'a-task' },
    });
  });
  it('accepts a completely empty category and stays out of distant outside space', () => {
    const empty: DiaryDragHitRegion[] = [
      { categoryId: 'empty', rect: { left: 0, right: 320, top: 150, bottom: 184 }, rows: [] },
    ];
    expect(resolveDiaryDragHit(null, empty, 120, 167, 'n')).toEqual({
      kind: 'category', drop: { categoryId: 'empty', position: 'start' },
    });
    expect(resolveDiaryDragHit(null, empty, 120, 250, 'n')).toBeNull();
  });
  it('keeps the grouped Diary region highest priority but does not extend it over a category', () => {
    const group = { left: 0, right: 320, top: 40, bottom: 95 };
    expect(resolveDiaryDragHit(group, regions, 120, 85, 'moving')).toEqual({ kind: 'group' });
    expect(resolveDiaryDragHit(group, regions, 120, 116, 'moving')?.kind).toBe('category');
  });
  it('follows the currently painted next category when a preceding ghost shifts its header', () => {
    // The next category starts at 230 in the captured layout, but the
    // preceding destination gap can move its live pill down by 80px.
    // Live category identity must override the obsolete captured y-band.
    const hit = resolveDiaryDragHit(null, regions, 120, 314, 'moving', 'b');
    expect(hit).toEqual({
      kind: 'category',
      drop: { categoryId: 'b', position: 'before', taskId: 'b-task' },
    });
  });
  it('stably selects a first task immediately beneath a category pill', () => {
    const firstTask: DiaryDragHitRegion = {
      categoryId: 'first-task',
      rect: { left: 0, right: 320, top: 400, bottom: 480 },
      rows: [{ kind: 'task', id: 'only-task', midpoint: 454 }],
    };
    for (const y of [401, 418, 437]) {
      expect(resolveDiaryDragHit(null, [firstTask], 120, y, 'moving')).toEqual({
        kind: 'category',
        drop: { categoryId: 'first-task', position: 'before', taskId: 'only-task' },
      });
    }
  });

  it('ignores a category margin separated by a large diary group', () => {
    const far: DiaryDragHitRegion[] = [regions[0],
      { ...regions[1], rect: { ...regions[1].rect, top: 380 } }];
    expect(resolveDiaryDragHit(null, far, 120, 260, 'moving')).toBeNull();
  });
});

describe('Diary release uses the visible drag gap instead of shifted edge geometry', () => {
  const firstTask = { categoryId: 'second', position: 'before' as const, taskId: 'first' };
  const lastNote = { categoryId: 'first', position: 'note' as const,
    noteId: 'last', side: 'after' as const };
  it('commits the exact retained top slot when the gap shifts the first row beneath the pointer', () => {
    const shifted = { kind: 'category' as const, drop:
      { categoryId: 'second', position: 'after' as const, taskId: 'first' } };
    expect(resolveDiaryReleaseHit(shifted, firstTask,
      { x: 110, y: 375 }, { x: 110, y: 375 }, true)).toEqual({
      kind: 'category', drop: firstTask,
    });
  });
  it('commits a last-note gap even when the next category pill now covers release', () => {
    const shifted = { kind: 'category' as const,
      drop: { categoryId: 'second', position: 'start' as const } };
    expect(resolveDiaryReleaseHit(shifted, lastNote,
      { x: 120, y: 207 }, { x: 120, y: 211 }, true)).toEqual({
      kind: 'category', drop: lastNote,
    });
  });
  it('does not use an earlier hover when the pointer has moved to a new target', () => {
    const next = { kind: 'category' as const,
      drop: { categoryId: 'second', position: 'start' as const } };
    expect(resolveDiaryReleaseHit(next, lastNote,
      { x: 120, y: 207 }, { x: 120, y: 260 }, true)).toEqual(next);
  });
  it('does not commit outside the workspace or mask an actual return to the group', () => {
    expect(resolveDiaryReleaseHit(null, lastNote,
      { x: 120, y: 207 }, { x: 600, y: 700 }, false)).toBeNull();
    expect(resolveDiaryReleaseHit({ kind: 'group' }, lastNote,
      { x: 120, y: 207 }, { x: 120, y: 300 }, true)).toEqual({ kind: 'group' });
    // A stationary pointer is still over its visible gap even when the
    // grouped card itself moves underneath it as adjacent rows reflow.
    expect(resolveDiaryReleaseHit({ kind: 'group' }, lastNote,
      { x: 120, y: 207 }, { x: 120, y: 207 }, true)).toEqual({
      kind: 'category', drop: lastNote,
    });
  });
});
