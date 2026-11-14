import {describe, expect, it} from 'vitest';
import type {CategoryDocument,TaskDocument} from '../../src/db/schema';
import {previewBulkMutationCommand,freezeMutationPlan,executeMutation,undoMutation,
 type MutationDraft} from '../../src/lib/taskBulkMutations';
import type {BulkMoveStore,FrozenMoveRow,MovePatch} from '../../src/lib/taskBulkCommandExecution';
const cats:CategoryDocument[]=[
  {id:'school',name:'School',userId:'owner',isDeleted:false,color:'red',
    order:0,visibility:'private',updatedAt:''},
  {id:'family',name:'Family',userId:'owner',isDeleted:false,color:'red',
    order:1,visibility:'private',updatedAt:''},
  {id:'other',name:'School',userId:'intruder',isDeleted:false,color:'red',
    order:0,visibility:'private',updatedAt:''},
];
const task=(id:string,date='2026-11-01',completed=false,userId='owner'):TaskDocument=>({
  id,userId,categoryId:'school',date,completed,completedAt:completed?'2026-10-30T00:00:00Z':'',
  updatedAt:'2026-11-01T01:00:00.000Z',visibility:'private',
  title:id,order:0,createdAt:'',isDeleted:false,
});
function setup(source:TaskDocument[]) {
  const map=new Map(source.map(t=>[t.id,{...t}]));
  const store:BulkMoveStore={
    currentOwner:()=> 'owner',
    readTask:async id=>map.get(id)??null,
    readCategory:async id=>cats.find(c=>c.id===id)??null,
    comparePatch:async(before:FrozenMoveRow,patch:MovePatch)=>{
      const t=map.get(before.id);
      if(!t||t.userId!==before.userId||t.categoryId!==before.categoryId||
          t.date!==before.date||t.completed!==before.completed||
          t.completedAt!==before.completedAt||t.isDeleted!==before.isDeleted||
          t.visibility!==before.visibility||t.updatedAt!==before.updatedAt)return false;
      map.set(t.id,{...t,...patch});
      return true;
    },
  };
  const draft=(input:string)=>previewBulkMutationCommand(input,'owner',cats,source)!;
  const freeze=(input:string,ids:string[])=>freezeMutationPlan(draft(input),ids);
  return{map,store,draft,freeze};
}

describe('owner-only confirmed task mutation parser and executor',()=>{
  it('never includes another owner, and refuses unsupported natural-language commands',()=>{
    const {draft}=setup([task('mine'),task('secret','2026-11-01',false,'intruder')]);
    const d=draft('delete all tasks in School');
    expect(d.status).toBe('preview');
    if(d.status==='preview')expect(d.matches.map(t=>t.id)).toEqual(['mine']);
    expect(draft('delete the oldest three tasks in School').status).toBe('unsupported');
    expect(previewBulkMutationCommand('Delete all tasks in School',null,cats,[])).toMatchObject({
      status:'needs_review',
    });
    expect(previewBulkMutationCommand('call a friend','owner',cats,[])).toBeNull();
  });
  it('sets completedAt on completion and restores it on guarded undo',async()=>{
    const {map,store,freeze}=setup([task('a')]);
    const plan=freeze('complete all unfinished tasks in School',['a']);
    const result=await executeMutation(plan,store);
    expect(result.applied).toHaveLength(1);
    expect(map.get('a')?.completed).toBe(true);
    expect(map.get('a')?.completedAt).toBeTruthy();
    const undone=await undoMutation(plan,result,store);
    expect(undone.applied).toHaveLength(1);
    expect(map.get('a')?.completed).toBe(false);
    expect(map.get('a')?.completedAt).toBe('');
  });
  it('reschedules exact ISO dates and excludes destination no-ops',async()=>{
    const {map,store,draft,freeze}=setup([task('a'),task('b','2026-11-03')]);
    const d=draft('reschedule all unfinished tasks in School to 2026-11-03');
    expect(d.status).toBe('preview');
    if(d.status==='preview')expect(d.noOps.map(t=>t.id)).toEqual(['b']);
    const plan=freeze('reschedule all unfinished tasks in School to 2026-11-03',['a']);
    await executeMutation(plan,store);
    expect(map.get('a')?.date).toBe('2026-11-03');
    expect(draft('reschedule all unfinished tasks in School to 2026-02-31').status)
      .toBe('needs_review');
  });
  it('soft-deletes with tombstones, and refuses undo after an intervening edit',async()=>{
    const {map,store,freeze}=setup([task('a'),task('b')]);
    const plan=freeze('delete all tasks in School',['a','b']);
    const result=await executeMutation(plan,store);
    expect(result.applied).toHaveLength(2);
    expect(map.get('a')?.isDeleted).toBe(true);
    expect(map.get('b')?.isDeleted).toBe(true);
    const changed=map.get('b')!;
    map.set('b',{...changed,updatedAt:'newer-change'});
    const undone=await undoMutation(plan,result,store);
    expect(undone.applied.map(v=>v.before.id)).toEqual(['a']);
    expect(undone.conflicts).toEqual(['b']);
    expect(map.get('a')?.isDeleted).toBe(false);
    expect(map.get('b')?.isDeleted).toBe(true);
  });
  it('isolates partial failures, validates owner scope and honors cancel',async()=>{
    const {store,freeze}=setup([task('a'),task('b'),task('c')]);
    const plan=freeze('delete all tasks in School',['a','b','c']);
    const original=store.comparePatch;
    store.comparePatch=async(before,after)=>{
      if(before.id==='b')throw Error('offline');
      return original(before,after);
    };
    const steps:number[]=[];
    const result=await executeMutation(plan,store,{
      cancelled:()=>steps.length>=2,
      onProgress:n=>steps.push(n),
    });
    expect(result.applied.map(t=>t.before.id)).toEqual(['a']);
    expect(result.failures).toEqual(['b']);
    expect(result.cancelled).toBe(true);
    expect(steps).toEqual([1,2]);
    expect(()=>freezeMutationPlan({status:'unsupported',reason:''} as MutationDraft,['a']))
      .toThrow();
  });
  it('reviews School tasks across dates then moves selected tasks to tomorrow',async()=>{
    const {map,store}=setup([task('school-today','2026-11-15'),task('school-backlog','')]);
    const draft=previewBulkMutationCommand('move all my school tasks to tomorrow',
      'owner',cats,[...map.values()],new Date(2026,10,15,12));
    expect(draft?.status).toBe('preview');
    if(!draft||draft.status!=='preview')return;
    expect(draft.targetDate).toBe('2026-11-16');
    expect(draft.matches).toHaveLength(2);
    const result=await executeMutation(freezeMutationPlan(draft,['school-today']),store);
    expect(result.applied).toHaveLength(1);
    expect(map.get('school-today')?.date).toBe('2026-11-16');
    expect(map.get('school-backlog')?.date).toBe('');
  });
  it('moves last-week tasks from multiple owner categories to next Monday with guarded undo',async()=>{
    const source=[
      task('school-last','2026-11-02'),
      {...task('family-last','2026-11-08'),categoryId:'family'},
      task('school-this','2026-11-09'),
      task('foreign-last','2026-11-03',false,'intruder'),
    ];
    const {map,store}=setup(source);
    const d=previewBulkMutationCommand('move all my tasks from last week to next Monday',
      'owner',cats,source,new Date(2026,10,15,12));
    expect(d?.status).toBe('preview');
    if(!d||d.status!=='preview')return;
    expect(d.category).toBeNull();
    expect(d.matches.map(x=>x.id)).toEqual(['school-last','family-last']);
    const plan=freezeMutationPlan(d,['school-last','family-last']);
    expect(plan.categoryId).toBeNull();
    const out=await executeMutation(plan,store);
    expect(out.applied).toHaveLength(2);
    expect(map.get('family-last')?.date).toBe('2026-11-16');
    expect((await undoMutation(plan,out,store)).applied).toHaveLength(2);
    expect(map.get('school-last')?.date).toBe('2026-11-02');
  });
  it('only soft-deletes Family tasks today and refuses cross-owner rows',async()=>{
    const family={...task('family','2026-11-15'),categoryId:'family'};
    const source=[family,task('school','2026-11-15'),{...family,id:'foreign',userId:'intruder'}];
    const {map,store}=setup(source);
    const d=previewBulkMutationCommand('delete all my family tasks today',
      'owner',cats,source,new Date(2026,10,15,12));
    expect(d?.status).toBe('preview');
    if(!d||d.status!=='preview')return;
    expect(d.matches.map(x=>x.id)).toEqual(['family']);
    const plan=freezeMutationPlan(d,['family']);
    const result=await executeMutation(plan,store);
    expect(result.applied).toHaveLength(1);
    expect(map.get('family')?.isDeleted).toBe(true);
    expect(map.get('school')?.isDeleted).toBe(false);
    expect(map.get('foreign')?.isDeleted).toBe(false);
  });
  it('refuses nonsensical date destinations rather than converting them to category moves',()=>{
    const d=previewBulkMutationCommand('move all my School tasks to 2026-02-31',
      'owner',cats,[task('a')],new Date(2026,10,15,12));
    expect(d?.status).toBe('needs_review');
  });

});
