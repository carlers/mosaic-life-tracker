import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  owner: 'owner_A',
  activities: new Map<string, Row>(),
  links: new Map<string, Row>(),
  tasks: new Map<string, Row>(),
}));

function collection(map: Map<string, Row>) {
  return {
    findOne: (id: string) => ({ exec: async () => {
      const item = map.get(id);
      if (!item) return null;
      return { ...item, incrementalPatch: async (patch: Row) => { map.set(id, { ...item, ...patch }); } };
    }}),
    find: ({ selector }: { selector: Row }) => ({ exec: async () =>
      [...map.entries()].filter(([,value]) => Object.entries(selector).every(([key,val])=>value[key]===val))
        .map(([id,item])=>({ ...item, incrementalPatch: async (patch: Row) => { map.set(id,{ ...map.get(id),...patch }); } })) }),
    insert: async (row: Row) => {
      if (map.has(String(row.id))) throw new Error('Duplicate');
      map.set(String(row.id),{...row});
    },
  };
}
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    activities: collection(state.activities),
    activityTaskLinks: collection(state.links),
    tasks: collection(state.tasks),
  }),
}));
vi.mock('../../src/lib/accountWorkScope',()=>({
  captureAccountWorkGeneration:(id:string)=>id===state.owner?5:null,
  isAccountWorkCurrent:(id:string,n:number)=>id===state.owner&&n===5,
}));
import { assertWorkoutSourceRights, deleteWorkout, importWorkoutRows, setWorkoutTaskLinked, updateWorkoutTitle } from '../../src/lib/workoutActivity';
import type { WorkoutPreviewRow } from '../../src/lib/workoutCsv';

const row: WorkoutPreviewRow = {
  line: 2, title: 'Independent run', sport: 'Run', localDate: '2026-11-18',
  completedAt: '2026-11-18T07:30:00+08:00', distanceMeters: 5000,
  elapsedSeconds: 1740, elapsedPaceSecondsPerKm:348,
  state:'valid',issue:null,
};
describe('offline owner-only workout activity',()=>{
  beforeEach(()=>{
    state.owner='owner_A';
    state.activities.clear(); state.links.clear(); state.tasks.clear();
    vi.stubGlobal('crypto',webcrypto);
  });
  it('rejects IFTTT/Strava-derived retention', async()=>{
    expect(()=>assertWorkoutSourceRights('ifttt_strava_csv')).toThrow(/rights/);
    await expect(importWorkoutRows('owner_A',[row],'ifttt_strava_csv')).rejects.toThrow(/rights/);
    expect(state.activities.size).toBe(0);
  });
  it('is idempotent across imports and tombstones, and edits only own records',async()=>{
    expect(await importWorkoutRows('owner_A',[row],'synthetic')).toMatchObject({inserted:1,alreadyPresent:0});
    const id=[...state.activities.keys()][0];
    expect(id).toMatch(/^wa_[a-f0-9]{32}$/);
    expect(await importWorkoutRows('owner_A',[row],'synthetic')).toMatchObject({inserted:0,alreadyPresent:1});
    await updateWorkoutTitle('owner_A',id,'Edited title');
    expect(state.activities.get(id)?.title).toBe('Edited title');
    await deleteWorkout('owner_A',id);
    expect(state.activities.get(id)?.isDeleted).toBe(true);
    expect(await importWorkoutRows('owner_A',[row],'synthetic')).toMatchObject({inserted:0,alreadyPresent:1});
    expect(state.activities.get(id)?.isDeleted).toBe(true);
    await expect(updateWorkoutTitle('owner_B',id,'Wrong owner')).rejects.toThrow();
  });
  it('retains portable fingerprints after a cross-owner restore', async () => {
    const sourceRow = {...row};
    await importWorkoutRows('owner_A',[sourceRow],'synthetic');
    const saved = [...state.activities.values()][0];
    state.owner='owner_B';
    state.activities.clear();
    state.activities.set('w_restored', { ...saved, id:'w_restored', userId:'owner_B' });
    const repeat = await importWorkoutRows('owner_B',[sourceRow],'synthetic');
    expect(repeat.inserted).toBe(0);
    expect(repeat.alreadyPresent).toBe(1);
    expect(state.activities.size).toBe(1);
  });
  it('links only owner tasks without mutating tasks, and unlinks on deletion',async()=>{
    await importWorkoutRows('owner_A',[row],'synthetic');
    const activityId=[...state.activities.keys()][0];
    state.tasks.set('task_one',{id:'task_one',userId:'owner_A',isDeleted:false,title:'Training',date:'2026-11-18',completed:false});
    await setWorkoutTaskLinked('owner_A',activityId,'task_one',true);
    expect(state.links.size).toBe(1);
    expect([...state.links.values()][0].isDeleted).toBe(false);
    await setWorkoutTaskLinked('owner_A',activityId,'task_one',true);
    expect(state.links.size).toBe(1);
    await setWorkoutTaskLinked('owner_A',activityId,'task_one',false);
    expect([...state.links.values()][0].isDeleted).toBe(true);
    await setWorkoutTaskLinked('owner_A',activityId,'task_one',true);
    await deleteWorkout('owner_A',activityId);
    expect([...state.links.values()][0].isDeleted).toBe(true);
    expect(state.tasks.get('task_one')?.completed).toBe(false);
  });
  it('stops on account switch and blocks other-owned task access',async()=>{
    state.tasks.set('foreign',{id:'foreign',userId:'owner_B',isDeleted:false});
    await importWorkoutRows('owner_A',[row],'synthetic');
    const id=[...state.activities.keys()][0];
    await expect(setWorkoutTaskLinked('owner_A',id,'foreign',true)).rejects.toThrow(/owner task unavailable/);
    state.owner='owner_B';
    await expect(deleteWorkout('owner_A',id)).rejects.toThrow(/Sign in/);
    expect(state.activities.get(id)?.isDeleted).toBe(false);
  });
});
