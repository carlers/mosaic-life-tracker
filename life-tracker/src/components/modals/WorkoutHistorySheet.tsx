import React, { useMemo, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { MosaicSelect } from '../ui/MosaicSelect';
import { useWorkouts } from '../../hooks/useWorkouts';
import { deleteWorkout, setWorkoutTaskLinked, updateWorkoutTitle, updateWorkoutCategory } from '../../lib/workoutActivity';
import { useCategories } from '../../hooks/useCategories';
import { useSettings } from '../../hooks/useSettings';
import { suggestWorkoutCategory } from '../../lib/workoutDayPlacement';
import { formatWorkoutPace, workoutElapsedPace } from '../../lib/workoutCsv';

export interface WorkoutHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional day-view filter; never shows a different user's workouts. */
  date?: string;
  /** Open the selected activity directly from its Day View card. */
  focusActivityId?: string;
}
export const WorkoutHistorySheet: React.FC<WorkoutHistorySheetProps> = ({ isOpen, onClose, date, focusActivityId }) => {
  const { categories, addCategory } = useCategories(isOpen);
  const { getSetting, setSetting } = useSettings();
  const { workouts, links, tasks, userId, isLoading } = useWorkouts(isOpen);
  const [activeId, setActiveId] = useState<string | null>(focusActivityId ?? null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editTouched, setEditTouched] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayed = useMemo(
    () => workouts.filter(row => (!date || row.localDate === date) &&
      (!focusActivityId || row.id === focusActivityId))
      .sort((a,b) => b.localDate.localeCompare(a.localDate) || b.completedAt.localeCompare(a.completedAt)),
    [workouts, date, focusActivityId]
  );
  const taskMap = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const act = displayed.find(row => row.id === activeId);
  // The focused sheet is keyed by activity; editor values derive from live
  // data until changed by the user, including after asynchronous hydration.
  const availableTasks = tasks.filter(task => act && task.date === act.localDate)
    .sort((a,b) => a.title.localeCompare(b.title)).slice(0,150);
  const handle = async (work: () => Promise<void>) => {
    if (busy || !userId) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Workout change failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={date ? 'Workouts · ' + date : 'Workout history'} height="full">
      <div className="space-y-3 px-4 pt-3 pb-8">
        <p className="text-xs text-gray-400">
          Private workouts stored on this device. Not shared with friends or attached to a task automatically.
          Back up your data before clearing browser storage.
        </p>
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        {isLoading && <p role="status" className="text-sm text-gray-400">Loading your workouts…</p>}
        {!isLoading && displayed.length === 0 && (
          <p className="text-sm text-gray-400">No saved workouts{date ? ' on this day' : ''}.</p>
        )}
        {displayed.map(row => {
          const active = row.id === activeId;
          const attached = links.filter(link => link.activityId === row.id && taskMap.has(link.taskId));
          return <section key={row.id} className="mosaic-material-panel rounded-xl border border-white/10 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium text-sm text-white">{row.title}</p>
                <p className="text-xs text-gray-400">{row.sport} · {row.localDate} · {row.source === 'synthetic' ? 'Fictional sample' : 'User CSV'}</p>
              </div>
              <Button type="button" variant="ghost" aria-expanded={active} onClick={() => {
                setActiveId(active ? null : row.id);
                setSelectedTask('');
                setEditValue(row.title);
                setEditTouched(false);
                setSelectedCategory(row.categoryId ?? '');
                setDeleteId(null);
                setError(null);
              }}>{active ? 'Close' : 'Manage'}</Button>
            </div>
            <p className="text-xs tabular-nums text-gray-300">
              {(row.distanceMeters / 1000).toFixed(2)} km · {Math.round(row.elapsedSeconds)} sec · {' '}
              {formatWorkoutPace(workoutElapsedPace(row.distanceMeters, row.elapsedSeconds))} elapsed pace
            </p>
            {attached.length > 0 && <div className="space-y-1">
              {attached.map(link => <div className="flex items-center justify-between gap-2 text-xs" key={link.id}>
                <span className="min-w-0 truncate text-gray-300">Linked task: {taskMap.get(link.taskId)?.title}</span>
                {active && <button type="button" disabled={busy}
                  className="text-emerald-400 underline"
                  onClick={() => void handle(() => setWorkoutTaskLinked(userId, row.id, link.taskId, false))}>Unlink</button>}
              </div>)}
            </div>}
            {active && <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="text-xs text-gray-400 block" htmlFor={'workout-title-' + row.id}>Workout title</label>
              <div className="flex gap-2">
                <input id={'workout-title-' + row.id}
                  value={editTouched ? editValue : row.title} maxLength={255} disabled={busy}
                  onChange={e => { setEditTouched(true); setEditValue(e.currentTarget.value); }}
                  className="mosaic-material-control min-w-0 flex-1 rounded-lg px-3 py-2 text-sm text-white" />
                <Button disabled={busy || !(editTouched ? editValue : row.title).trim()}
                  type="button" onClick={() => void handle(async () => {
                    await updateWorkoutTitle(userId, row.id, editTouched ? editValue : row.title);
                    setEditTouched(false);
                  })}>Save</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Workout category</p>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <MosaicSelect
                      label="Workout category"
                      value={selectedCategory || row.categoryId ||
                        suggestWorkoutCategory(categories, row.sport,
                          String(getSetting('defaultWorkoutCategoryId', '')))?.id || '__create_workout__'}
                      onChange={setSelectedCategory}
                      options={[
                        ...categories.map(cat => ({value: cat.id,label: cat.name})),
                        {value:'__create_workout__',label:'Create private Workout category'},
                      ]}
                      variant="compact"
                    />
                  </div>
                  <Button type="button" disabled={busy} onClick={() => void handle(async () => {
                    const chosen = selectedCategory || row.categoryId ||
                      suggestWorkoutCategory(categories, row.sport,
                        String(getSetting('defaultWorkoutCategoryId', '')))?.id || '__create_workout__';
                    const categoryId = chosen === '__create_workout__'
                      ? await addCategory({
                          name:'Workout',color:'#FFBE0B',visibility:'private',startedOn:'',
                          order:categories.reduce((max, cat) => Math.max(max, cat.order), -1) + 1,
                        })
                      : chosen;
                    await updateWorkoutCategory(userId, row.id, categoryId);
                    await setSetting('defaultWorkoutCategoryId', categoryId);
                    setSelectedCategory(categoryId);
                  })}>Save</Button>
                </div>
                {!row.categoryId && <p className="text-xs text-amber-200">This older workout needs a category before it can appear among tasks.</p>}
              </div>
              <p className="text-xs text-gray-400">Linking never edits or completes a task and is visible only to you.</p>
              {availableTasks.length > 0
                ? <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <MosaicSelect
                      label="Task to link"
                      value={selectedTask}
                      onChange={setSelectedTask}
                      options={[{value:'',label:'Choose a task from this day'}, ...availableTasks.map(t => ({value:t.id,label:t.title}))]}
                      variant="compact"
                    />
                  </div>
                  <Button disabled={busy || !selectedTask || attached.some(link=>link.taskId===selectedTask)}
                    type="button" onClick={() => void handle(() => setWorkoutTaskLinked(userId,row.id,selectedTask,true))}>
                    Link
                  </Button>
                </div>
                : <p className="text-xs text-gray-400">No owner tasks on this date to link.</p>}
              {deleteId === row.id
                ? <div className="flex items-center gap-2">
                    <span className="text-xs text-red-300">Delete this workout and unlink tasks?</span>
                    <Button type="button" variant="danger" disabled={busy} onClick={() => void handle(async () => {
                      await deleteWorkout(userId,row.id); setActiveId(null); setDeleteId(null);
                    })}>Delete</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setDeleteId(null)}>Cancel</Button>
                  </div>
                : <Button type="button" variant="ghost" disabled={busy} onClick={() => setDeleteId(row.id)}>Delete workout</Button>}
            </div>}
          </section>;
        })}
      </div>
    </BottomSheet>
  );
};
export default WorkoutHistorySheet;
