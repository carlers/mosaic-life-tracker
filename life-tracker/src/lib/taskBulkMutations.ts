import type {CategoryDocument, TaskDocument} from '../db/schema';
import type {BulkMoveStore, FrozenMoveRow, MovePatch} from './taskBulkCommandExecution';
import {isValidCommandDate} from './taskCommands';

type MutationKind = 'complete' | 'reschedule' | 'delete';
export type MutationDraft =
  | {status:'preview'; ownerId:string; kind:MutationKind; category:CategoryDocument;
     matches:TaskDocument[]; noOps:TaskDocument[]; targetDate?:string;
     completionFilter:boolean | null; overdueOnly:boolean}
  | {status:'needs_review' | 'unsupported'; reason:string};

export type MutationPlan = {ownerId:string; kind:MutationKind; categoryId:string;
  targetDate?:string; rows:FrozenMoveRow[]};
export type MutationRecord = {before:FrozenMoveRow; after:MovePatch};
export type MutationOutcome = {applied:MutationRecord[]; conflicts:string[];
  failures:string[]; noOps:string[]; cancelled:boolean};

function todayLocal():string {
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0')].join('-');
}
function tomorrowLocal() {
  const d=new Date();d.setDate(d.getDate()+1);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0')].join('-');
}

/** Strict grammar. Unrecognized natural language cannot silently become a task write. */
export function previewBulkMutationCommand(input:string,ownerId:string|null,
  categories:readonly CategoryDocument[],tasks:readonly TaskDocument[]):MutationDraft|null {
  const line=input.trim().replace(/\s+/g,' ');
  let kind:MutationKind;
  let categoryName:string;
  let targetDate:string|undefined;
  let completionFilter:boolean|null=null;
  let overdueOnly=false;
  let match=/^complete all (?:unfinished|uncompleted|incomplete) tasks in (.+)$/i.exec(line);
  if(match){kind='complete';categoryName=match[1];completionFilter=false;}
  else if((match=/^complete (?:my |all )?overdue tasks in (.+)$/i.exec(line))){
    kind='complete';categoryName=match[1];completionFilter=false;overdueOnly=true;
  }else if((match=/^reschedule all (?:unfinished|uncompleted|incomplete) tasks in (.+?) to (\d{4}-\d{2}-\d{2}|tomorrow)$/i.exec(line))){
    kind='reschedule';categoryName=match[1];completionFilter=false;
    targetDate=match[2].toLowerCase()==='tomorrow'?tomorrowLocal():match[2];
    if(!isValidCommandDate(targetDate))return{status:'needs_review',
      reason:'Choose a valid future/scheduled calendar date.'};
  }else if((match=/^(?:delete|remove) all tasks in (.+)$/i.exec(line))){
    kind='delete';categoryName=match[1];
  }else{
    if(/^(?:complete|reschedule|delete|remove)\s/i.test(line))return{
      status:'unsupported',reason:'Unsupported bulk instruction. Nothing was changed.'};
    return null;
  }
  if(!ownerId)return{status:'needs_review',reason:'Sign in before reviewing tasks.'};
  const matching=categories.filter(c=>c.userId===ownerId&&!c.isDeleted&&
    c.name.trim().toLocaleLowerCase()===categoryName.trim().toLocaleLowerCase());
  if(matching.length!==1)return{status:'needs_review',
    reason:'Choose an unambiguous existing owned category.'};
  const category=matching[0],now=todayLocal();
  const matches=tasks.filter(t=>t.userId===ownerId&&!t.isDeleted&&
    t.categoryId===category.id&&(completionFilter===null||t.completed===completionFilter)&&
    (!overdueOnly||(t.date!==''&&t.date<now))).sort((a,b)=>
      a.date.localeCompare(b.date)||a.order-b.order||a.id.localeCompare(b.id));
  const noOps=kind==='reschedule'?matches.filter(t=>t.date===targetDate):[];
  return{status:'preview',ownerId,kind,category,matches,noOps,targetDate,
    completionFilter,overdueOnly};
}

const MAX=20;
function frozen(t:TaskDocument):FrozenMoveRow {
  return{id:t.id,userId:t.userId,categoryId:t.categoryId,date:t.date,
    completed:t.completed,completedAt:t.completedAt,visibility:t.visibility,
    updatedAt:t.updatedAt,isDeleted:t.isDeleted};
}
export function freezeMutationPlan(draft:MutationDraft,selectedIds:readonly string[]):MutationPlan {
  if(draft.status!=='preview')throw Error('Review a supported mutation first.');
  const ids=new Set(selectedIds);
  if(!ids.size||ids.size>MAX||ids.size!==selectedIds.length||
    [...ids].some(id=>!draft.matches.some(t=>t.id===id)&&
      !draft.noOps.some(t=>t.id===id)))throw Error('Select 1–20 exact reviewed tasks.');
  const rows=draft.matches.filter(t=>ids.has(t.id)&&!draft.noOps.some(n=>n.id===t.id))
    .map(frozen);
  if(!rows.length||rows.length>MAX||rows.some(t=>t.userId!==draft.ownerId||
    t.isDeleted||t.categoryId!==draft.category.id))throw Error('Invalid owner task scope.');
  return{ownerId:draft.ownerId,kind:draft.kind,categoryId:draft.category.id,
    targetDate:draft.targetDate,rows};
}
function matches(t:TaskDocument|null,b:FrozenMoveRow){
  return Boolean(t&&t.id===b.id&&t.userId===b.userId&&t.categoryId===b.categoryId&&
    t.date===b.date&&t.completed===b.completed&&t.completedAt===b.completedAt&&
    t.visibility===b.visibility&&t.isDeleted===b.isDeleted&&t.updatedAt===b.updatedAt);
}
function timestamp(previous:string) {
  const a=Date.parse(previous),n=Date.now();
  return new Date(Number.isFinite(a)?Math.max(n,a+1):n).toISOString();
}

export async function executeMutation(plan:MutationPlan,store:BulkMoveStore,
  options:{cancelled?:()=>boolean;onProgress?:(done:number,total:number)=>void}={}):Promise<MutationOutcome> {
  if(!plan.ownerId||!plan.categoryId||!plan.rows.length||plan.rows.length>MAX||
      new Set(plan.rows.map(t=>t.id)).size!==plan.rows.length ||
      (plan.kind==='reschedule'&&!isValidCommandDate(plan.targetDate??''))) {
    throw Error('Invalid mutation plan');
  }
  if(store.currentOwner()!==plan.ownerId)throw Error('Account changed.');
  const category=await store.readCategory(plan.categoryId);
  if(!category||category.userId!==plan.ownerId||category.isDeleted)
    throw Error('Source category is unavailable.');
  const out:MutationOutcome={applied:[],conflicts:[],failures:[],noOps:[],cancelled:false};
  for(const before of plan.rows){
    if(options.cancelled?.()||store.currentOwner()!==plan.ownerId){
      out.cancelled=true;break;
    }
    try {
      const src=await store.readCategory(plan.categoryId);
      if(!src||src.userId!==plan.ownerId||src.isDeleted||
        before.userId!==plan.ownerId||before.isDeleted||
        before.categoryId!==plan.categoryId||
        !matches(await store.readTask(before.id),before)){
        out.conflicts.push(before.id);continue;
      }
      const updatedAt=timestamp(before.updatedAt);
      let after:MovePatch={updatedAt};
      if(plan.kind==='complete'){
        if(before.completed){out.noOps.push(before.id);continue;}
        after={updatedAt,completed:true,completedAt:updatedAt};
      }else if(plan.kind==='reschedule'){
        if(before.date===plan.targetDate){out.noOps.push(before.id);continue;}
        after={updatedAt,date:plan.targetDate};
      }else if(plan.kind==='delete'){
        after={updatedAt,isDeleted:true};
      }
      if(await store.comparePatch(before,after))out.applied.push({before,after});
      else out.conflicts.push(before.id);
    }catch{out.failures.push(before.id);}
    finally {options.onProgress?.(out.applied.length+out.noOps.length+
      out.conflicts.length+out.failures.length,plan.rows.length);}
  }
  return out;
}

/** Only compensate rows whose complete postimage still matches this operation. */
export async function undoMutation(plan:MutationPlan,result:MutationOutcome,
  store:BulkMoveStore):Promise<MutationOutcome>{
  const out:MutationOutcome={applied:[],conflicts:[],failures:[],noOps:[],cancelled:false};
  for(const record of [...result.applied].reverse()){
    if(store.currentOwner()!==plan.ownerId){out.cancelled=true;break;}
    try{
      const src=await store.readCategory(plan.categoryId);
      const current=await store.readTask(record.before.id);
      if(!src||src.userId!==plan.ownerId||src.isDeleted||!current||
        current.userId!==plan.ownerId||current.updatedAt!==record.after.updatedAt||
        Object.entries(record.after).some(([key,value])=>
          current[key as keyof TaskDocument]!==value)){
        out.conflicts.push(record.before.id);continue;
      }
      const before=frozen(current);
      const restored:MovePatch={updatedAt:timestamp(before.updatedAt)};
      if(plan.kind==='complete'){
        restored.completed=record.before.completed;
        restored.completedAt=record.before.completedAt??'';
      }else if(plan.kind==='reschedule')restored.date=record.before.date;
      else restored.isDeleted=record.before.isDeleted;
      if(await store.comparePatch(before,restored))out.applied.push({before,after:restored});
      else out.conflicts.push(before.id);
    }catch{out.failures.push(record.before.id);}
  }
  return out;
}
