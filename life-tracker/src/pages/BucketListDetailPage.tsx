import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Circle, Link2, Plus, Pencil, Trash2, CalendarDays, ArrowUpRight, Sparkles } from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { MosaicSelect } from '../components/ui/MosaicSelect';
import { getCategoryLabelColor } from '../constants/colors';
import { ConfirmSheet } from '../components/ui/ConfirmSheet';
import { useBucketList } from '../hooks/useBucketList';
import { useBucketTaskLinks } from '../hooks/useBucketTaskLinks';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';
import { useTaskImage } from '../hooks/useTaskImage';
import { useFeatureEnabled } from '../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../lib/featureControls';
import { LinkedTaskPhoto } from './LinkedTaskPhoto';

// PhotoSwipe is only downloaded when a linked task photo is opened.
const ImageViewer = lazy(() => import('../components/home/views/ImageViewer').then(({ ImageViewer }) => ({ default: ImageViewer })));

type EditorMode = 'none' | 'edit' | 'createTask' | 'linkTask';
export function BucketListDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate(), location = useLocation();
  const { items, editItem, setAchieved, deleteItem } = useBucketList();
  const stepCreationEnabled = useFeatureEnabled('mosaic_disable_bucket_step_creation');
  const stepLinkingEnabled = useFeatureEnabled('mosaic_disable_bucket_step_linking');
  const achievementEnabled = useFeatureEnabled('mosaic_disable_bucket_achievement');
  const { links, setLinked } = useBucketTaskLinks();
  const { tasks, addTask, toggleTaskCompletion } = useTasks();
  const { categories } = useCategories();
  const goal = items.find(item => item.id === id);
  const [mode, setMode] = useState<EditorMode>('none');
  const [name, setName] = useState(''), [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState(''), [categoryId, setCategoryId] = useState(''), [date, setDate] = useState('');
  const [search, setSearch] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingCreatedTask, setPendingCreatedTask] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const categoryMap = useMemo(() => new Map(categories.map(cat => [cat.id, cat])), [categories]);
  const ownedTasks = useMemo(() => tasks.filter(task => !task.isDeleted), [tasks]);
  const activeLinks = useMemo(() => links.filter(link => link.bucketListId === id), [links,id]);
  const linkedIds = useMemo(() => new Set(activeLinks.map(link => link.taskId)), [activeLinks]);
  const linkedTasks = useMemo(() => ownedTasks.filter(task => linkedIds.has(task.id))
    .sort((a,b) => Number(a.completed) - Number(b.completed) || a.createdAt.localeCompare(b.createdAt)), [ownedTasks,linkedIds]);
  const done = linkedTasks.filter(task=>task.completed).length;
  const viewingTask = linkedTasks.find(task => task.id === viewingTaskId);
  const { imageUrl: viewingImageUrl, isLoading: viewingImageLoading } = useTaskImage(viewingTask?.image, !!viewingTask?.image);
  const availableTasks = useMemo(() => ownedTasks.filter(task => !linkedIds.has(task.id) &&
    (task.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) ||
    (categoryMap.get(task.categoryId)?.name ?? '').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    .slice(0,60), [ownedTasks,linkedIds,search,categoryMap]);
  const back = () => hasExpectedRouteParent(location.key,location.state,'/bucket-list') ? navigate(-1) : navigate('/bucket-list',{replace:true});
  const run = async (fn: () => Promise<void>) => { setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } };
  const openEdit = () => { if (!goal) return; setName(goal.title); setNote(goal.description); setMode('edit'); setError(''); };
  const openTask = () => {
    if (!isFeatureEnabled('mosaic_disable_bucket_step_creation') || !isFeatureEnabled('mosaic_disable_bucket_step_linking')) return;
    setTaskTitle('');setCategoryId(categories[0]?.id??'');setDate('');setPendingCreatedTask(null);
    setMode('createTask');setError('');
  };
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault(); if (!goal||busy) return; setBusy(true);
    try { await run(async()=>{await editItem(goal.id,name,note);setMode('none');}); } finally {setBusy(false);}
  };
  const saveTask = async (e: FormEvent) => {
    e.preventDefault(); if (!goal||busy || !isFeatureEnabled('mosaic_disable_bucket_step_creation') || !isFeatureEnabled('mosaic_disable_bucket_step_linking')) return;
    setBusy(true);setError('');
    try {
      let taskId = pendingCreatedTask;
      if (!taskId) {
        const selected = categories.find(c => c.id === categoryId && !c.isDeleted);
        if (!selected) throw new Error('Choose an existing task category.');
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid date.');
        taskId = (await addTask({
          title: taskTitle.trim(), completed: false, categoryId: selected.id,
          date, visibility: date === '' ? 'private' : '',
        })) ?? null;
        if (!taskId) throw new Error('Could not create the task.');
        setPendingCreatedTask(taskId);
      }
      await setLinked(goal.id,taskId,true);
      setPendingCreatedTask(null);setMode('none');
      setMessage('Task created and linked. You can find it in '+(date?'Calendar.':'Backlogs.'));
    } catch (cause) {setError(cause instanceof Error?cause.message:'Unable to link task.');}
    finally {setBusy(false);}
  };
  const goToTask = (taskId: string, taskDate: string) => {
    if (taskDate === '') navigate('/backlog',{state:{parentPath:'/home',focusTaskId:taskId}});
    else navigate('/home',{state:{bucketLinkedFocusTaskId:taskId,bucketLinkedFocusDate:taskDate}});
  };
  return <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
    <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <button aria-label="Back to Bucket List" onClick={back} className="rounded-xl p-2 focus-visible:ring-2 focus-visible:ring-current"><ArrowLeft size={19}/></button>
      <span className="flex-1 text-sm font-medium text-muted-foreground">Bucket List</span>
      {goal && <button aria-label="Edit aspiration" onClick={openEdit} className="rounded-xl p-2 focus-visible:ring-2 focus-visible:ring-current"><Pencil size={19}/></button>}
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-8">
      <div className="mx-auto max-w-2xl">
        {!goal ? <p role="status" className="text-sm text-muted-foreground">Opening aspiration…</p> : <>
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground"><Sparkles size={14}/>{goal.achieved?'LIVED':'SOMEDAY'}</div>
            <h1 className="mb-3 text-3xl font-semibold leading-tight tracking-tight">{goal.title}</h1>
            {goal.description && <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">{goal.description}</p>}
            {goal.achieved && goal.achievedAt && <p className="mt-3 text-xs text-muted-foreground">Achieved {new Date(goal.achievedAt).toLocaleDateString()}</p>}
          </div>
          <div className="mb-8 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex-1 font-medium">{goal.achieved?'A memory worth keeping':'This dream is yours to live'}</span>
              {achievementEnabled && <button type="button" disabled={busy} onClick={()=>void run(async()=>{if (!isFeatureEnabled("mosaic_disable_bucket_achievement")) return; await setAchieved(goal.id,!goal.achieved);setMessage(goal.achieved?'Aspiration reopened.':'You lived it. ✨');})}
                className="rounded-xl bg-surfaceHighlight px-4 py-2 text-sm font-semibold disabled:opacity-50">{goal.achieved?'Reopen':'I lived it'}</button>}
            </div>
          </div>
          <section aria-label="Steps toward this dream">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Steps toward this dream</h2>
                <p className="mt-1 text-sm text-muted-foreground">{linkedTasks.length?done+' of '+linkedTasks.length+' tasks complete':'Little steps add up. No pressure or deadlines.'}</p></div>
            </div>
            {linkedTasks.length > 0 && <ul className="mb-5 space-y-2">{linkedTasks.map(task=>{
              const category=categoryMap.get(task.categoryId);
              return <li key={task.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3" style={{borderLeftWidth:3,borderLeftColor:category?.color??'var(--border)'}}>
                <button type="button" aria-label={(task.completed?'Reopen ':'Complete ')+task.title} aria-pressed={task.completed}
                  onClick={()=>void run(()=>toggleTaskCompletion(task.id,!task.completed))}
                  className="mt-1 shrink-0 rounded-full p-1 focus-visible:ring-2 focus-visible:ring-current">{task.completed?<Check size={18}/>:<Circle size={18}/>}</button>
                <button type="button" className="min-w-0 flex-1 text-left focus-visible:underline" onClick={()=>goToTask(task.id,task.date)}>
                  <span className={`block text-sm font-medium ${task.completed?'text-muted-foreground line-through':''}`}>{task.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{category?.name??'Uncategorized'} · {task.date?new Date(task.date+'T12:00:00').toLocaleDateString():'Backlog'}</span>
                </button>
                {task.image && <LinkedTaskPhoto task={task} onView={(selected) => setViewingTaskId(selected.id)} />}
                <button type="button" aria-label={'Unlink '+task.title} title="Unlink task (does not delete it)" onClick={()=>void run(async()=>{await setLinked(goal.id,task.id,false);setMessage('Task unlinked. It remains in Mosaic.');})}
                  className="rounded-lg p-1.5 text-muted-foreground focus-visible:ring-2 focus-visible:ring-current"><Link2 size={16}/></button>
                <ArrowUpRight size={14} className="mt-2 shrink-0 text-muted-foreground" aria-hidden="true"/>
              </li>;
            })}</ul>}
            <div className="grid grid-cols-2 gap-3">
              {stepCreationEnabled && stepLinkingEnabled && <button type="button" onClick={openTask} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surfaceHighlight px-3 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-current"><Plus size={17}/> New task</button>}
              {stepLinkingEnabled && <button type="button" onClick={()=>{if (!isFeatureEnabled("mosaic_disable_bucket_step_linking")) return; setSearch('');setError('');setMode('linkTask');}} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-current"><Link2 size={17}/> Link existing</button>}
            </div>
          </section>
          <button type="button" onClick={()=>setConfirmDelete(true)} className="mt-12 flex items-center gap-2 text-sm text-muted-foreground focus-visible:underline"><Trash2 size={16}/> Delete aspiration</button>
        </>}
        {error && mode==='none' && <p role="alert" className="mt-5 text-sm text-red-500">{error}</p>}
        {message && <div role="status" className="mt-5 rounded-xl bg-surfaceHighlight px-3 py-3 text-sm">{message}</div>}
      </div>
    </main>
    {viewingTaskId && (viewingTask?.image && viewingImageUrl
      ? <Suspense fallback={
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black" role="status" aria-label="Opening task photo">
          <span className="text-sm text-white">Opening photo…</span>
        </div>
      }>
        <ImageViewer isOpen imageUrl={viewingImageUrl} taskTitle={viewingTask.title} taskDate={viewingTask.date} onClose={() => setViewingTaskId(null)}/>
      </Suspense>
      : <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black px-6" role="dialog" aria-modal="true" aria-label="Task photo">
        <div className="text-center text-white">
          <p className="mb-4 text-sm" role="status">{viewingImageLoading ? 'Loading photo…' : 'Photo unavailable on this device'}</p>
          <button type="button" className="rounded-xl bg-white/20 px-4 py-2 text-sm font-medium" onClick={() => setViewingTaskId(null)}>Close</button>
        </div>
      </div>
    )}
    <BottomSheet isOpen={mode==='edit'} onClose={()=>setMode('none')} title="Edit aspiration" height="auto" preventDismiss={busy}>
      <form onSubmit={saveEdit} className="space-y-4 px-4 pb-9 pt-3">
        <label htmlFor="goal-title" className="block text-sm">Your dream</label>
        <input id="goal-title" maxLength={255} required value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        <label htmlFor="goal-note" className="block text-sm">A note to yourself</label>
        <textarea id="goal-note" maxLength={2000} rows={3} value={note} onChange={e=>setNote(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-surfaceHighlight px-4 py-3 font-semibold">Save changes</button>
      </form>
    </BottomSheet>
    <BottomSheet isOpen={mode==='createTask' && stepCreationEnabled && stepLinkingEnabled} onClose={()=>setMode('none')} title="A step toward your dream" height="auto" preventDismiss={busy}>
      <form onSubmit={saveTask} className="space-y-4 px-4 pb-9 pt-3">
        <label htmlFor="goal-new-task" className="block text-sm">Task</label>
        <input id="goal-new-task" autoFocus required maxLength={255} value={taskTitle} disabled={Boolean(pendingCreatedTask)} onChange={e=>setTaskTitle(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-3" placeholder="Research the trip"/>
        <span className="block text-sm">Category</span>
        <MosaicSelect
          id="goal-new-category"
          label="Category for new task"
          value={categoryId}
          disabled={Boolean(pendingCreatedTask)}
          onChange={setCategoryId}
          className="w-full"
          placeholder="Choose a category"
          options={[
            { value: '', label: 'Choose a category' },
            ...categories.filter(category => !category.isDeleted).map(category => ({
              value: category.id, label: category.name, color: category.color,
              textColor: getCategoryLabelColor(category.color),
            })),
          ]}
        />
        <label htmlFor="goal-new-date" className="flex items-center gap-2 text-sm"><CalendarDays size={16}/> Date (optional; leave empty for Backlog)</label>
        <input id="goal-new-date" type="date" value={date} disabled={Boolean(pendingCreatedTask)} onChange={e=>setDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        {pendingCreatedTask && <p className="text-sm text-muted-foreground">Task created. Retry linking without creating a duplicate.</p>}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button disabled={busy||(!pendingCreatedTask&&!taskTitle.trim())} className="w-full rounded-xl bg-surfaceHighlight px-4 py-3 font-semibold disabled:opacity-50">{pendingCreatedTask?'Retry linking task':'Create and link task'}</button>
      </form>
    </BottomSheet>
    <BottomSheet isOpen={mode==='linkTask' && stepLinkingEnabled} onClose={()=>setMode('none')} title="Link existing tasks" height="full">
      <div className="flex h-full min-h-0 flex-col px-4 pb-9 pt-3">
        <label htmlFor="goal-task-search" className="mb-2 block text-sm">Find a task in your Calendar or Backlogs</label>
        <input id="goal-task-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title or category" className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-3"/>
        {error && <p role="alert" className="mb-3 text-sm text-red-500">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {availableTasks.length===0 && <p className="py-8 text-center text-sm text-muted-foreground">No available tasks found.</p>}
          <ul className="space-y-2">{availableTasks.map(task=><li key={task.id}>
            <button type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-current"
              onClick={()=>void run(async()=>{if(!goal || !isFeatureEnabled('mosaic_disable_bucket_step_linking'))return;await setLinked(goal.id,task.id,true);setMessage('Linked '+task.title);})}>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{task.title}</span>
              <span className="block text-xs text-muted-foreground">{categoryMap.get(task.categoryId)?.name??'Uncategorized'} · {task.date||'Backlog'} · {task.completed?'Done':'To do'}</span></span>
              <Plus size={17} className="shrink-0"/>
            </button>
          </li>)}</ul>
        </div>
        <button type="button" className="mt-3 rounded-xl bg-surfaceHighlight px-4 py-3 font-medium" onClick={()=>setMode('none')}>Done</button>
      </div>
    </BottomSheet>
    <ConfirmSheet isOpen={confirmDelete} onClose={()=>setConfirmDelete(false)} title="Delete aspiration?"
      message="The dream and its private task links will be removed. Linked tasks stay in your Calendar and Backlogs." confirmLabel="Delete aspiration" destructive
      onConfirm={()=>{if(!goal)return;setConfirmDelete(false);void run(async()=>{await deleteItem(goal.id);back();});}}/>
  </div>;
}
export default BucketListDetailPage;
