import { describe, expect, it } from 'vitest';
import { resolveDiaryDragHit, type DiaryDragHitRegion } from './diaryDropGeometry';

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
  it('ignores a category margin separated by a large diary group', () => {
    const far: DiaryDragHitRegion[] = [regions[0],
      { ...regions[1], rect: { ...regions[1].rect, top: 380 } }];
    expect(resolveDiaryDragHit(null, far, 120, 260, 'moving')).toBeNull();
  });
});
