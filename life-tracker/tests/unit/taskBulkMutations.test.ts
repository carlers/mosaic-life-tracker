import {describe, expect, it} from 'vitest';
import type {CategoryDocument,TaskDocument} from '../../src/db/schema';
import {previewBulkMutationCommand,freezeMutationPlan,executeMutation,undoMutation,
 type MutationDraft} from '../../src/lib/taskBulkMutations';
import type {BulkMoveStore,FrozenMoveRow,MovePatch} from '../../src/lib/taskBulkCommandExecution';
const cats:CategoryDocument[]=[
  {id:'school',name:'School',userId:'owner',isDeleted:false,color:'red',
    order:0,visibility:'private',updatedAt:''},
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
});
