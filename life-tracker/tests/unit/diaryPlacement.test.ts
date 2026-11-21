import { describe, expect, it } from 'vitest';
import { anchoredDiaryPlacement, diaryAfterTaskMove, diaryPlacementKey, diarySlotIndex, normalizeDiaryPlacement, placementFromTaskDrop, resolveDiaryDragRelease, sameDiaryPlacement } from '../../src/lib/diaryPlacement';
describe('Diary placement invariants', () => {
  it('recognizes identical targets without confusing categories, side or anchor changes', () => {
    expect(sameDiaryPlacement(null, null)).toBe(true);
    expect(sameDiaryPlacement(null, {kind:'top'})).toBe(false);
    expect(sameDiaryPlacement({kind:'top'}, {kind:'top'})).toBe(true);
    expect(sameDiaryPlacement({kind:'top'}, {kind:'bottom'})).toBe(false);
    expect(sameDiaryPlacement({kind:'slot',categoryId:'a',index:1},
      {kind:'slot',categoryId:'a',index:1})).toBe(true);
    expect(sameDiaryPlacement({kind:'slot',categoryId:'a',index:1},
      {kind:'slot',categoryId:'b',index:1})).toBe(false);
    expect(sameDiaryPlacement({kind:'slot',categoryId:'a',index:1},
      {kind:'before',categoryId:'a',taskId:'a1',index:1})).toBe(false);
    expect(sameDiaryPlacement({kind:'before',categoryId:'a',taskId:'a1',index:1},
      {kind:'before',categoryId:'a',taskId:'a1',index:1})).toBe(true);
    expect(sameDiaryPlacement({kind:'before',categoryId:'a',taskId:'a1',index:1},
      {kind:'after',categoryId:'a',taskId:'a1',index:1})).toBe(false);
    expect(sameDiaryPlacement({kind:'before',categoryId:'a',taskId:'a1',index:1},
      {kind:'before',categoryId:'a',taskId:'a2',index:1})).toBe(false);
  });
  it('commits the projected fifth-position diary gap despite a null or stale release collision', () => {
    const tasks = ['a', 'b', 'c', 'd', 'e', 'f'];
    const projected = placementFromTaskDrop(
      { categoryId: 'work', position: 'after', taskId: 'd' }, tasks);
    const former = placementFromTaskDrop(
      { categoryId: 'work', position: 'after', taskId: 'a' }, tasks);
    expect(projected).toEqual({ kind: 'after', categoryId: 'work', taskId: 'd', index: 4 });
    // The reflowed gap consumes the droppable; release target is null.
    expect(resolveDiaryDragRelease(false, true, projected, null)).toEqual(projected);
    // Another drop zone slides below the stationary pointer at release.
    expect(resolveDiaryDragRelease(false, true, projected, former)).toEqual(projected);
    // A rapid release before the first valid hover still honors the direct hit.
    expect(resolveDiaryDragRelease(false, true, null, projected)).toEqual(projected);
  });

  it('does not save a stale diary preview on cancellation or release outside the day', () => {
    const projected = { kind: 'after' as const, categoryId: 'work', taskId: 'd', index: 4 };
    expect(resolveDiaryDragRelease(true, true, projected, projected)).toBeNull();
    expect(resolveDiaryDragRelease(false, false, projected, null)).toBeNull();
    expect(resolveDiaryDragRelease(false, false, projected, projected)).toBeNull();
    expect(resolveDiaryDragRelease(false, true, null, null)).toBeNull();
  });

  it('uses synced default when custom placement is absent or invalid', () => {
    expect(normalizeDiaryPlacement(null, 'bottom')).toEqual({ kind: 'bottom' });
    expect(normalizeDiaryPlacement({ kind:'slot',categoryId:'',index:4 }, 'top')).toEqual({ kind: 'top' });
    expect(diaryPlacementKey('2026-10-12')).toBe('diaryPlacement:2026-10-12');
  });
  it('maps category insertion boundaries without changing task IDs', () => {
    const tasks=['t1','t2'];
    expect(placementFromTaskDrop({categoryId:'c',position:'before',taskId:'t2'},tasks)).toEqual({kind:'after',categoryId:'c',taskId:'t1',index:1});
    expect(placementFromTaskDrop({categoryId:'c',position:'after',taskId:'t2'},tasks)).toEqual({kind:'after',categoryId:'c',taskId:'t2',index:2});
    expect(placementFromTaskDrop({categoryId:'c',position:'index',index:200},tasks)).toEqual({kind:'after',categoryId:'c',taskId:'t2',index:2});
    expect(tasks).toEqual(['t1','t2']);
  });

  it('keeps the diary with its neighbors when new tasks are inserted before it', () => {
    const placement = anchoredDiaryPlacement('c', 2, ['a','b','c']);
    expect(placement).toEqual({kind:'after',categoryId:'c',taskId:'b',index:2});
    expect(diarySlotIndex(placement,['new','a','b','c'])).toBe(3);
    expect(diarySlotIndex(placement,['a','c'])).toBe(2);
    const first = anchoredDiaryPlacement('c',0,['a','b']);
    expect(first).toEqual({kind:'before',categoryId:'c',taskId:'a',index:0});
    expect(diarySlotIndex(first,['new','a','b'])).toBe(1);
    expect(normalizeDiaryPlacement(first,'bottom')).toEqual(first);
  });
  it('moves a task across the diary without pinning the diary to a fixed rank', () => {
    const original={c:['a','b','c']};
    const diary=anchoredDiaryPlacement('c',2,original.c);
    const down={c:['a','c','b']};
    expect(diaryAfterTaskMove(diary,original,down,'b'))
      .toEqual({kind:'after',categoryId:'c',taskId:'a',index:1});
    const up={c:['c','a','b']};
    expect(diaryAfterTaskMove(diary,original,up,'c'))
      .toEqual({kind:'after',categoryId:'c',taskId:'b',index:3});
  });
  it('lets a task drop above or below the diary even when diary is first', () => {
    const original={c:['a','b']};
    const projected={c:['b','a']};
    const top=anchoredDiaryPlacement('c',0,original.c);
    expect(diaryAfterTaskMove(top,original,projected,'b','before'))
      .toEqual({kind:'after',categoryId:'c',taskId:'b',index:1});
    expect(diaryAfterTaskMove(top,original,projected,'b','after'))
      .toEqual({kind:'before',categoryId:'c',taskId:'b',index:0});
  });
  it('keeps mixed ordering across categories and respects absent/deleted anchors', () => {
    const prior={work:['a','b'],home:['c']};
    const removed={work:['b'],home:['a','c']};
    const diary=anchoredDiaryPlacement('work',1,prior.work);
    expect(diaryAfterTaskMove(diary,prior,removed,'a'))
      .toEqual({kind:'before',categoryId:'work',taskId:'b',index:0});
    expect(diarySlotIndex({kind:'before',categoryId:'work',taskId:'gone',index:1},['b'])).toBe(1);
    expect(diarySlotIndex({kind:'slot',categoryId:'work',index:10},['b'])).toBe(1);
    expect(normalizeDiaryPlacement({kind:'after',categoryId:'work',taskId:'$',index:1},'top'))
      .toEqual({kind:'top'});
  });
});
