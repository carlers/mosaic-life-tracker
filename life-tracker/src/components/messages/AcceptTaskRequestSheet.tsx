import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { BottomSheet } from '../ui/BottomSheet';
import { useCategories } from '../../hooks/useCategories';
import { canAddNewTaskToCategory } from '../../lib/categoryLifecycle';
import { transitionTaskRequest, taskRequestOperationId, type TaskRequestItem } from '../../lib/taskRequests';

interface Props {
  item:TaskRequestItem | null;
  onClose:()=>void;
  onAccepted:(next:TaskRequestItem)=>void;
}
export const AcceptTaskRequestSheet:React.FC<Props>=({item,onClose,onAccepted})=>{
  const {categories} = useCategories(Boolean(item));
  const [categoryId,setCategoryId]=useState('');
  const [date,setDate]=useState('');
  const [backlog,setBacklog]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const command=useRef('');
  useEffect(()=>{
    if(!item) return;
    setCategoryId('');setDate(item.suggestedDate||format(new Date(),'yyyy-MM-dd'));
    setBacklog(false);setBusy(false);setError('');command.current='';
  },[item?.id, item?.suggestedDate]);
  const chosenDate=backlog?'':date;
  const eligible=useMemo(()=>categories.filter(cat=>!cat.isDeleted &&
    canAddNewTaskToCategory(cat,chosenDate)),[categories,chosenDate]);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!item||busy) return;
    if(!command.current) command.current=taskRequestOperationId();
    setBusy(true);setError('');
    try {
      const next=await transitionTaskRequest({
        operation:'accept',requestId:item.id,operationId:command.current,
        expectedRevision:item.revision,categoryId,
        date:chosenDate,ownerLocalDate:format(new Date(),'yyyy-MM-dd'),
      });
      onAccepted(next);onClose();
    }catch(e){setError(e instanceof Error?e.message:'Task request could not be accepted');}
    finally{setBusy(false);}
  };
  return <BottomSheet isOpen={Boolean(item)} onClose={onClose} title="Accept task" height="auto" backdropBlur>
    <form onSubmit={event=>void submit(event)} className="space-y-4 px-4 pb-8 pt-2">
      <p className="break-words font-medium">{item?.title}</p>
      <p className="text-xs text-secondary">This creates a new private task in your account. Your friend cannot see how you categorize or complete it.</p>
      <label className="block text-sm text-secondary">Date
        <input aria-label="Task date" type="date" value={date} disabled={busy||backlog}
          onChange={event=>{setDate(event.target.value);setCategoryId('');command.current='';}}
          className="mt-2 w-full rounded-xl bg-surfaceHighlight p-3 text-foreground" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={backlog} disabled={busy}
          onChange={event=>{setBacklog(event.target.checked);setCategoryId('');command.current='';}} />
        Save to Backlog (no date)
      </label>
      <label className="block text-sm text-secondary">Your category
        <select aria-label="Category" required value={categoryId} disabled={busy}
          onChange={event=>{setCategoryId(event.target.value);command.current='';}}
          className="mt-2 w-full rounded-xl bg-surfaceHighlight p-3 text-foreground">
          <option value="">Select a category</option>
          {eligible.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      {!eligible.length && <p className="text-xs text-secondary">No active category is available for this date. Create or restore one in Category Manager, then return to this request.</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy||!categoryId||(!backlog&&!date)}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-black disabled:opacity-50">{busy?'Accepting…':'Add task'}</button>
    </form>
  </BottomSheet>;
};
