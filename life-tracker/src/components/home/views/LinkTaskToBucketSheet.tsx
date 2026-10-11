import { useMemo, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import type { TaskDocument } from '../../../db/schema';
import { BottomSheet } from '../../ui/BottomSheet';
import { useBucketList } from '../../../hooks/useBucketList';
import { useBucketTaskLinks } from '../../../hooks/useBucketTaskLinks';

export function LinkTaskToBucketSheet({ task, isOpen, onClose }: {
  task: TaskDocument | null; isOpen: boolean; onClose: () => void;
}) {
  const { items, isLoading: goalsLoading } = useBucketList();
  const { links, setLinked, isLoading: linksLoading } = useBucketTaskLinks(isOpen);
  const [error, setError] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const linkedIds = useMemo(() => new Set(links.filter(link => link.taskId === task?.id).map(link => link.bucketListId)), [links,task?.id]);
  const goals = useMemo(() => [...items].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),[items]);
  const toggle = async (goalId: string, linked: boolean) => {
    if (!task||working) return;
    setWorking(goalId);setError('');
    try { await setLinked(goalId,task.id,!linked); }
    catch(e){setError(e instanceof Error?e.message:'Could not update the link.');}
    finally {setWorking(null);}
  };
  return <BottomSheet isOpen={isOpen && !!task} onClose={onClose} title="Link to Bucket List" height="auto" preventDismiss={!!working}>
    <div className="max-h-[65vh] overflow-y-auto px-4 pb-9 pt-3">
      <p className="mb-4 text-sm text-muted-foreground">Add this task to one or more dreams. It stays in its current category and date.</p>
      {goalsLoading||linksLoading ? <p role="status" className="text-sm text-muted-foreground">Loading dreams…</p>
        : goals.length===0?<p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Add a dream in Bucket List first.</p>
        : <ul className="space-y-2">{goals.map(goal=>{
          const linked=linkedIds.has(goal.id);
          return <li key={goal.id}>
            <button type="button" aria-pressed={linked} disabled={!!working} onClick={()=>void toggle(goal.id,linked)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-current disabled:opacity-50">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{goal.title}</span>
              {linked?<Check size={18} aria-label="Linked"/>:<Link2 size={18} className="text-muted-foreground"/>}
            </button>
          </li>;
        })}</ul>}
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-surfaceHighlight px-4 py-3 font-medium">Done</button>
    </div>
  </BottomSheet>;
}
