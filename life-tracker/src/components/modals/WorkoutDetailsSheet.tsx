import React, { useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import type { ActivityDocument, ActivityTaskLinkDocument, TaskDocument } from '../../db/schema';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { MosaicSelect } from '../ui/MosaicSelect';
import { MosaicCategorySelect } from '../ui/MosaicCategorySelect';
import { WorkoutMetrics, WorkoutDetailHeader } from '../ui/WorkoutMetrics';
import { useCategories } from '../../hooks/useCategories';
import { useSettings } from '../../hooks/useSettings';
import { suggestWorkoutCategory } from '../../lib/workoutDayPlacement';
import { updateWorkoutCategory, updateWorkoutTitle, deleteWorkout, setWorkoutTaskLinked } from '../../lib/workoutActivity';

interface WorkoutDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  activity?: ActivityDocument;
  tasks: readonly TaskDocument[];
  links: readonly ActivityTaskLinkDocument[];
  userId: string;
}
const CREATE_CATEGORY = '__create_workout__';

const WorkoutDetailsEditor: React.FC<Omit<WorkoutDetailsSheetProps, 'isOpen'> & {
  activity: ActivityDocument;
}> = ({ activity, tasks, links, userId, onClose }) => {
  const { categories, addCategory } = useCategories(true);
  const { getSetting, setSetting } = useSettings();
  const suggested = suggestWorkoutCategory(categories, activity.sport,
    String(getSetting('defaultWorkoutCategoryId', '')));
  const [title, setTitle] = useState(activity.title);
  const [categoryId, setCategoryId] = useState(activity.categoryId || '');
  const [linkedTaskChoice, setLinkedTaskChoice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = categoryId || activity.categoryId || suggested?.id || CREATE_CATEGORY;
  const attached = links.filter(link => !link.isDeleted && link.activityId === activity.id &&
    tasks.some(task => task.id === link.taskId && task.userId === userId && !task.isDeleted));
  const availableTasks = tasks.filter(task => task.userId === userId && !task.isDeleted &&
    task.date === activity.localDate).slice(0, 150);
  const submit = async (action: () => Promise<void>) => {
    if (busy || !userId) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Workout update failed.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5 px-4 pb-10 pt-3">
    <WorkoutDetailHeader title={activity.title} sport={activity.sport}/>

    <section className="mosaic-material-panel rounded-2xl border border-border/60 px-4 py-5"
      aria-label="Workout measurements">
      <WorkoutMetrics activity={activity} variant="sheet"/>
    </section>

    {error && <p role="alert" className="rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-300">{error}</p>}

    <section className="space-y-3" aria-label="Edit workout">
      <div className="space-y-1.5">
        <label htmlFor="workout-edit-title" className="block text-sm font-semibold text-secondary">Title</label>
        <input id="workout-edit-title" value={title} maxLength={255} disabled={busy}
          onChange={event => setTitle(event.target.value)}
          className="mosaic-material-control w-full rounded-xl px-3 py-3 text-base text-primary"/>
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-secondary">Category</label>
        <MosaicCategorySelect label="Workout category" value={chosen} onChange={setCategoryId}
          disabled={busy} variant="default" className="w-full"
          options={[
            ...categories.filter(category => !category.isDeleted).map(category => ({
              value: category.id, label: category.name, color: category.color,
            })),
            {value: CREATE_CATEGORY, label: 'Create private Workout category'},
          ]}/>
        {!activity.categoryId && <p className="text-xs text-secondary">
          Choose a category to display this workout among tasks.
        </p>}
      </div>
      <Button className="w-full" disabled={busy || !title.trim()} onClick={() => void submit(async () => {
        if (title.trim() !== activity.title) await updateWorkoutTitle(userId, activity.id, title.trim());
        const nextId = chosen === CREATE_CATEGORY ? await addCategory({
          name: 'Workout', color: '#FFBE0B', visibility: 'private', startedOn: '',
          order: categories.reduce((high, category) => Math.max(high, category.order), -1) + 1,
        }) : chosen;
        if (nextId !== activity.categoryId) await updateWorkoutCategory(userId, activity.id, nextId);
        await setSetting('defaultWorkoutCategoryId', nextId);
        setCategoryId(nextId);
      })}>Save changes</Button>
    </section>

    <section className="space-y-3 border-t border-border/60 pt-4" aria-label="Linked task">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Link2 size={16} aria-hidden="true"/> Linked task
      </div>
      {attached.map(link => <div key={link.id}
        className="flex items-center justify-between gap-2 rounded-xl bg-surfaceHighlight px-3 py-3">
        <span className="min-w-0 truncate text-sm">
          {tasks.find(task => task.id === link.taskId)?.title ?? 'Linked task'}
        </span>
        <Button variant="ghost" disabled={busy} onClick={() => void submit(
          () => setWorkoutTaskLinked(userId, activity.id, link.taskId, false))}>Unlink</Button>
      </div>)}
      {attached.length === 0 && availableTasks.length > 0 &&
        <div className="flex items-center gap-2">
          <MosaicSelect label="Task to link" value={linkedTaskChoice}
            onChange={setLinkedTaskChoice} variant="default" className="min-w-0 flex-1"
            options={[{value: '', label: 'Choose a task on this day'},
              ...availableTasks.map(task => ({value: task.id, label: task.title}))]}/>
          <Button disabled={busy || !linkedTaskChoice} onClick={() => void submit(
            () => setWorkoutTaskLinked(userId, activity.id, linkedTaskChoice, true))}>Link</Button>
        </div>}
      {attached.length === 0 && availableTasks.length === 0 &&
        <p className="text-sm text-secondary">No tasks on this day.</p>}
    </section>

    <section className="border-t border-border/60 pt-4">
      {!confirmDelete
        ? <Button variant="ghost" className="text-red-400" disabled={busy}
            onClick={() => setConfirmDelete(true)}><Trash2 size={16}/> Delete workout</Button>
        : <div className="space-y-2">
            <p className="text-sm text-red-300">Delete this workout and unlink its task?</p>
            <div className="flex items-center gap-2">
              <Button variant="danger" disabled={busy} onClick={() => void submit(async () => {
                await deleteWorkout(userId, activity.id); onClose();
              })}>Delete</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          </div>}
    </section>
  </div>;
};
export const WorkoutDetailsSheet: React.FC<WorkoutDetailsSheetProps> = ({
  isOpen, onClose, onExitComplete, activity, tasks, links, userId,
}) => <BottomSheet isOpen={isOpen} onClose={onClose}
  onExitComplete={onExitComplete} title="Workout details" height="auto" pullDownToDismiss>
  {activity
    ? <WorkoutDetailsEditor key={activity.id} activity={activity} onClose={onClose}
        tasks={tasks} links={links} userId={userId}/>
    : <p role="status" className="px-4 py-6 text-sm text-secondary">Loading workout…</p>}
</BottomSheet>;
export default WorkoutDetailsSheet;
