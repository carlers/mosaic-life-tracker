import { describe, expect, it } from 'vitest';
import type { ActivityDocument, ActivityTaskLinkDocument, CategoryDocument, TaskDocument } from '../../src/db/schema';
import {
  suggestWorkoutCategory, buildWorkoutPresentation, workoutRowId,
  buildWorkoutOrderAssignments, mixedDiarySlotIndex,
} from '../../src/lib/workoutDayPlacement';

const when = '2026-11-18T07:30:00Z';
const cat = (id:string,name:string,owner='owner_A'):CategoryDocument => ({
  id,name,userId:owner,color:'#FFBE0B',order:0,visibility:'private',
  isDeleted:false,updatedAt:when,
});
const task = (id:string,categoryId='cat_workout',owner='owner_A'):TaskDocument => ({
  id,title:'Gym',completed:false,categoryId,order:0,tags:'',date:'2026-11-18',
  userId:owner,isDeleted:false,visibility:'private',
  createdAt:when,updatedAt:when,
});
const workout = (id:string,extra:Partial<ActivityDocument>={}):ActivityDocument => ({
  id,userId:'owner_A',title:'Run',sport:'Run',localDate:'2026-11-18',
  completedAt:when,distanceMeters:5000,elapsedSeconds:1700,
  source:'synthetic',fingerprint:'a'.repeat(64),createdAt:when,updatedAt:when,
  isDeleted:false,categoryId:'cat_workout',order:0.5,...extra,
});
const link = (activityId:string,taskId:string,owner='owner_A'):ActivityTaskLinkDocument => ({
  id:'link_'+activityId,userId:owner,activityId,taskId,createdAt:when,updatedAt:when,isDeleted:false,
});

describe('workout Day View presentation and placement',()=>{
  it('recommends an existing sport-relevant category, retaining an explicitly remembered choice',()=>{
    const categories=[cat('cat_fitness','Fitness'),cat('cat_run','Running'),cat('cat_generic','Workout')];
    expect(suggestWorkoutCategory(categories,'Run')?.id).toBe('cat_run');
    expect(suggestWorkoutCategory(categories,'Yoga')?.id).toBe('cat_generic');
    expect(suggestWorkoutCategory(categories,'Run','cat_fitness')?.id).toBe('cat_fitness');
    expect(suggestWorkoutCategory([cat('cat_food','Dinner')],'Run')).toBeNull();
  });
  it('keeps only own same-day workouts; linked activity renders once beneath its original task',()=>{
    const w1=workout('wa_1'),w2=workout('wa_2'),
      foreign=workout('wa_other',{userId:'owner_B'});
    const projection=buildWorkoutPresentation(
      [w1,w2,foreign,workout('wa_restricted',{source:'ifttt_strava_csv'})],
      [link('wa_1','task_one'),link('wa_other','task_one','owner_B')],
      [task('task_one')],[cat('cat_workout','Workout')],'owner_A','2026-11-18'
    );
    expect(projection.proxies.map(row=>row.id)).toEqual([workoutRowId('wa_2')]);
    expect(projection.linkedByTask.get('task_one')?.map(row=>row.id)).toEqual(['wa_1']);
    expect(projection.unassigned).toHaveLength(0);
    expect(projection.proxies[0].completed).toBe(true);
    expect(projection.proxies[0].visibility).toBe('private');
  });
  it('keeps old uncategorized workouts visible until owner picks a category',()=>{
    const projection=buildWorkoutPresentation([workout('wa_old',{categoryId:''})],
      [],[],[cat('cat_workout','Workout')],'owner_A','2026-11-18');
    expect(projection.unassigned.map(row=>row.id)).toEqual(['wa_old']);
    expect(projection.proxies).toHaveLength(0);
  });
  it('stores workout placement between canonical task ranks without putting workout IDs into task writes',()=>{
    const idA=workoutRowId('wa_1'),idB=workoutRowId('wa_2');
    const groups=[{categoryId:'cat_workout',taskIds:[idA,'task_one',idB,'task_two']},
      {categoryId:'cat_other',taskIds:['task_three']}];
    const assignments=buildWorkoutOrderAssignments(groups,
      new Set(['task_one','task_two','task_three']),new Set([idA,idB]));
    expect(assignments).toEqual([
      {activityId:'wa_1',categoryId:'cat_workout',order:-0.5},
      {activityId:'wa_2',categoryId:'cat_workout',order:0.5},
    ]);
    expect(()=>buildWorkoutOrderAssignments(
      [{categoryId:'cat_workout',taskIds:[idA,idA]}],
      new Set<string>(),new Set([idA]))).toThrow(/Duplicate/);
  });
  it('counts real task anchors rather than virtual rows for diary positions',()=>{
    const rows=[{id:workoutRowId('wa_1')}, {id:'task_one'},
      {id:workoutRowId('wa_2')},{id:'task_two'}] as TaskDocument[];
    expect(mixedDiarySlotIndex(rows,0)).toBe(1);
    expect(mixedDiarySlotIndex(rows,1)).toBe(3);
    expect(mixedDiarySlotIndex(rows,2)).toBe(4);
  });
});
