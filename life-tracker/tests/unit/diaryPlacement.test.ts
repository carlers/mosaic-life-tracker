import { describe, expect, it } from 'vitest';
import { diaryPlacementKey, normalizeDiaryPlacement, placementFromTaskDrop } from '../../src/lib/diaryPlacement';
describe('Diary placement invariants', () => {
  it('uses synced default when custom placement is absent or invalid', () => {
    expect(normalizeDiaryPlacement(null, 'bottom')).toEqual({ kind: 'bottom' });
    expect(normalizeDiaryPlacement({ kind:'slot',categoryId:'',index:4 }, 'top')).toEqual({ kind: 'top' });
    expect(diaryPlacementKey('2026-10-12')).toBe('diaryPlacement:2026-10-12');
  });
  it('maps category insertion boundaries without changing task IDs', () => {
    const tasks=['t1','t2'];
    expect(placementFromTaskDrop({categoryId:'c',position:'before',taskId:'t2'},tasks)).toEqual({kind:'slot',categoryId:'c',index:1});
    expect(placementFromTaskDrop({categoryId:'c',position:'after',taskId:'t2'},tasks)).toEqual({kind:'slot',categoryId:'c',index:2});
    expect(placementFromTaskDrop({categoryId:'c',position:'index',index:200},tasks)).toEqual({kind:'slot',categoryId:'c',index:2});
    expect(tasks).toEqual(['t1','t2']);
  });
});
