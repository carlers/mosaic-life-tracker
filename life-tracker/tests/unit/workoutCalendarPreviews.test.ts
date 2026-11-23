import { describe, expect, it } from 'vitest';
import type { ActivityDocument, ActivityTaskLinkDocument, TaskDocument } from '../../src/db/schema';
import { buildWorkoutCalendarPreviews } from '../../src/lib/workoutCalendarPreviews';

const now = '2026-11-18T07:30:00+08:00';
const categories = {
  cat_run: { name: 'Running', color: '#EAB308' },
  cat_gym: { name: 'Gym', color: '#22C55E' },
};
const workout = (id: string, data: Partial<ActivityDocument> = {}): ActivityDocument => ({
  id, userId: 'owner', title: 'Morning Run', sport: 'Run',
  localDate: '2026-11-18', completedAt: now,
  distanceMeters: 5000, elapsedSeconds: 1740,
  source: 'synthetic', fingerprint: id.padEnd(64,'a'),
  categoryId: 'cat_run', order: 0,
  createdAt: now, updatedAt: now, isDeleted: false, ...data,
});
const task = (id: string, data: Partial<TaskDocument> = {}): TaskDocument => ({
  id, userId: 'owner', title: 'Morning run', categoryId: 'cat_run',
  date: '2026-11-18', order: 0, completed: false, visibility: 'private',
  createdAt: now, updatedAt: now, isDeleted: false, ...data,
});
const link = (activityId: string, taskId: string, userId='owner'): ActivityTaskLinkDocument => ({
  id: 'ln_'+activityId, activityId, taskId, userId, isDeleted: false,
  createdAt: now, updatedAt: now,
});

describe('owner-only workout Calendar grid projections', () => {
  it('renders permitted standalone completed activities once on their own dates', () => {
    const map = buildWorkoutCalendarPreviews([workout('w1'), workout('w2',{order:1})],
      [],[], 'owner', [], categories, '');
    expect(map.get('2026-11-18')?.map(r=>r.id)).toEqual(['w1','w2']);
  });
  it('never adds the workout twice when its live owner task is linked', () => {
    const map = buildWorkoutCalendarPreviews([workout('w1'),workout('w2')],
      [link('w1','task1')],[task('task1')],'owner',[],categories,'');
    expect(map.get('2026-11-18')?.map(r=>r.id)).toEqual(['w2']);
  });
  it('restores a standalone preview when the task is deleted', () => {
    const map = buildWorkoutCalendarPreviews([workout('w1')],[link('w1','task1')],
      [task('task1',{isDeleted:true})],'owner',[],categories,'');
    expect(map.get('2026-11-18')?.map(r=>r.id)).toEqual(['w1']);
  });
  it('fences account, category, text filters, tombstones and prohibited source rights', () => {
    const rows=[workout('good'),workout('otherOwner',{userId:'other'}),
      workout('deleted',{isDeleted:true}),
      workout('missingCat',{categoryId:'deleted_cat'}),
      workout('restricted',{source:'ifttt_strava_csv'}),
      workout('gym',{categoryId:'cat_gym',title:'Weights'})];
    expect(buildWorkoutCalendarPreviews(rows,[],[], 'owner',['cat_run'],categories,'morning')
      .get('2026-11-18')?.map(r=>r.id)).toEqual(['good']);
    expect(buildWorkoutCalendarPreviews(rows,[],[], 'other',[],categories,'')
      .get('2026-11-18')?.map(r=>r.id)).toEqual(['otherOwner']);
    expect(buildWorkoutCalendarPreviews(rows,[],[], '',[],categories,'').size).toBe(0);
  });
  it('does not allow a foreign-owned linked task to hide an owner workout', () => {
    const rows=[workout('good')];
    const map=buildWorkoutCalendarPreviews(rows,[link('good','foreign','other')],
      [task('foreign',{userId:'other'})],'owner',[],categories,'');
    expect(map.get('2026-11-18')?.map(r=>r.id)).toEqual(['good']);
  });
});
