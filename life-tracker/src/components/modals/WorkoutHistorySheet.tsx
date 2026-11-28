import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { WorkoutListRow } from '../ui/WorkoutMetrics';
import { workoutDayLabel } from '../../lib/workoutFormat';
import { useWorkouts } from '../../hooks/useWorkouts';
import { useCategories } from '../../hooks/useCategories';
import { WorkoutDetailsSheet } from './WorkoutDetailsSheet';

export interface WorkoutHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional day-view filter; workouts are always queried for the owner alone. */
  date?: string;
  /** The Day View opens one workout directly, without a history intermediary. */
  focusActivityId?: string;
  /** Signal that a focused Day View sheet has finished its closing animation. */
  onFocusedDetailsExit?: () => void;
}
export const WorkoutHistorySheet: React.FC<WorkoutHistorySheetProps> = ({
  isOpen, onClose, date, focusActivityId, onFocusedDetailsExit,
}) => {
  const { workouts, links, tasks, userId, isLoading } = useWorkouts(isOpen);
  const { categories } = useCategories(isOpen);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const categoryMap = useMemo(() =>
    new Map(categories.filter(category => !category.isDeleted).map(category => [category.id, category])),
    [categories]);
  const grouped = useMemo(() => {
    const ordered = workouts.filter(row => !date || row.localDate === date)
      .sort((a,b) => b.localDate.localeCompare(a.localDate) ||
        b.completedAt.localeCompare(a.completedAt) || a.id.localeCompare(b.id));
    const dates = new Map<string, typeof ordered>();
    for (const row of ordered) {
      const group = dates.get(row.localDate);
      if (group) group.push(row);
      else dates.set(row.localDate, [row]);
    }
    return [...dates.entries()];
  }, [workouts, date]);
  const detailId = focusActivityId ?? selectedId;
  const focused = workouts.find(row => row.id === detailId && (!date || row.localDate === date));
  const closeDetails = () => {
    if (focusActivityId) onClose();
    else setDetailsOpen(false);
  };
  const finishDetailsExit = () => {
    if (focusActivityId) onFocusedDetailsExit?.();
    else setSelectedId(null);
  };
  return <>
    {!focusActivityId && <BottomSheet isOpen={isOpen} onClose={onClose}
      title={date ? 'Workouts · ' + workoutDayLabel(date) : 'Workout history'} height="auto" pullDownToDismiss>
      <div className="space-y-5 px-4 pb-10 pt-3">
        {isLoading && <p role="status" className="text-sm text-secondary">Loading workouts…</p>}
        {!isLoading && grouped.length === 0 &&
          <div className="rounded-2xl border border-border/60 px-4 py-8 text-center">
            <Activity size={26} aria-hidden="true" className="mx-auto mb-2 text-secondary"/>
            <p className="text-sm text-secondary">No workouts{date ? ' on this day' : ''}.</p>
          </div>}
        {grouped.map(([day, rows]) => <section key={day} className="space-y-2"
          aria-label={workoutDayLabel(day)}>
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            {workoutDayLabel(day)}
          </h3>
          <div className="mosaic-material-panel overflow-hidden rounded-2xl border border-border/60">
            {rows.map((row, index) => {
              const category = row.categoryId ? categoryMap.get(row.categoryId) : undefined;
              const attached = links.some(link => !link.isDeleted && link.activityId === row.id &&
                tasks.some(task => task.id === link.taskId && !task.isDeleted && task.userId === userId));
              return <WorkoutListRow key={row.id} title={row.title}
                distanceMeters={row.distanceMeters} elapsedSeconds={row.elapsedSeconds}
                category={category} attached={attached} separated={index > 0}
                onClick={() => { setSelectedId(row.id); setDetailsOpen(true); }}/>;
            })}
          </div>
        </section>)}
      </div>
    </BottomSheet>}
    <WorkoutDetailsSheet
      isOpen={isOpen && !!detailId && (Boolean(focusActivityId) || detailsOpen)}
      onClose={closeDetails} onExitComplete={finishDetailsExit}
      activity={focused} userId={userId} links={links} tasks={tasks}/>
  </>;
};
export default WorkoutHistorySheet;
