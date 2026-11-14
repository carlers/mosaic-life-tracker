import {describe,expect,it} from 'vitest';
import type {CategoryDocument,TaskDocument} from '../../src/db/schema';
import {previewTaskClipboardCommand,formatTasksForClipboard} from '../../src/lib/taskBulkClipboard';
const owner = 'owner';
const categories:CategoryDocument[]=[{id:'school',userId:owner,name:'School',color:'#fff',
  order:0,visibility:'private',isDeleted:false,updatedAt:''}];
const task=(id:string,date:string,ownerId=owner):TaskDocument=>({id,title:id,date,
  categoryId:'school',userId:ownerId,order:0,visibility:'private',createdAt:'',
  updatedAt:'2026-11-15T00:00:00Z',completed:false,isDeleted:false});
const now=new Date(2026,10,15,12);
describe('explicit clipboard command without data mutation',()=>{
  it('previews only owner tasks for today and formats only after direct request',()=>{
    const d=previewTaskClipboardCommand('copy all my tasks today to my clipboard',owner,categories,
      [task('own','2026-11-15'),task('yesterday','2026-11-14'),
       task('foreign','2026-11-15','other')],now);
    expect(d?.status).toBe('preview');
    if(!d||d.status!=='preview')return;
    expect(d.matches.map(t=>t.id)).toEqual(['own']);
    expect(formatTasksForClipboard(d,owner)).toContain('own (2026-11-15)');
    expect(()=>formatTasksForClipboard(d,'other')).toThrow();
  });
  it('rejects unsupported instructions and prevents copying over 100 rows',()=>{
    expect(previewTaskClipboardCommand('copy my password','owner',categories,[],now)?.status)
      .toBe('unsupported');
    const tasks=Array.from({length:101},(_,i)=>task('task'+i,'2026-11-15'));
    expect(previewTaskClipboardCommand('copy all tasks today to clipboard',owner,categories,tasks,now)?.status)
      .toBe('needs_review');
  });
});
