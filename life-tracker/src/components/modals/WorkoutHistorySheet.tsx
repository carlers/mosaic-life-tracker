import React, { useMemo, useState } from 'react';
import { Activity, ChevronRight, Link2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { CategoryColorDot } from '../ui/MosaicCategorySelect';
import { formatWorkoutDuration } from '../ui/WorkoutMetrics';
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
}
const labelDay = (value: string) => {
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? value
    : new Intl.DateTimeFormat(undefined, {month:'long',day:'numeric',year:'numeric'}).format(date);
};
export const WorkoutHistorySheet: React.FC<WorkoutHistorySheetProps> = ({
  isOpen, onClose, date, focusActivityId,
}) => {
  const { workouts, links, tasks, userId, isLoading } = useWorkouts(isOpen);
  const { categories } = useCategories(isOpen);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    else setSelectedId(null);
  };
  return <>
    {!focusActivityId && <BottomSheet isOpen={isOpen} onClose={onClose}
      title={date ? 'Workouts · ' + labelDay(date) : 'Workout history'} height="full">
      <div className="space-y-5 px-4 pb-10 pt-3">
        {isLoading && <p role="status" className="text-sm text-secondary">Loading workouts…</p>}
        {!isLoading && grouped.length === 0 &&
          <div className="rounded-2xl border border-border/60 px-4 py-8 text-center">
            <Activity size={26} aria-hidden="true" className="mx-auto mb-2 text-secondary"/>
            <p className="text-sm text-secondary">No workouts{date ? ' on this day' : ''}.</p>
          </div>}
        {grouped.map(([day, rows]) => <section key={day} className="space-y-2"
          aria-label={labelDay(day)}>
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            {labelDay(day)}
          </h3>
          <div className="mosaic-material-panel overflow-hidden rounded-2xl border border-border/60">
            {rows.map((row, index) => {
              const category = row.categoryId ? categoryMap.get(row.categoryId) : undefined;
              const attached = links.some(link => !link.isDeleted && link.activityId === row.id &&
                tasks.some(task => task.id === link.taskId && !task.isDeleted && task.userId === userId));
              return <button key={row.id} type="button" onClick={() => setSelectedId(row.id)}
                aria-label={`Open workout ${row.title}`}
                className={'flex w-full min-w-0 items-center gap-3 px-3 py-3.5 text-left ' +
                  'transition-colors hover:bg-surfaceHighlight focus-visible:outline-none ' +
                  'focus-visible:ring-2 focus-visible:ring-emerald-500/60 ' +
                  (index ? 'border-t border-border/50' : '')}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surfaceHighlight"
                  aria-hidden="true"><Activity size={18} style={category ? { color: category.color } : undefined}/></span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-[15px] font-semibold text-primary">{row.title}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
                    {category && <span className="inline-flex items-center gap-1">
                      <CategoryColorDot color={category.color}/>{category.name}</span>}
                    <span>{(row.distanceMeters / 1000).toFixed(2)} km</span>
                    <span>· {formatWorkoutDuration(row.elapsedSeconds)}</span>
                    {attached && <Link2 size={12} aria-label="Linked to task"/>}
                  </span>
                </span>
                <ChevronRight size={17} className="shrink-0 text-secondary" aria-hidden="true"/>
              </button>;
            })}
          </div>
        </section>)}
      </div>
    </BottomSheet>}
    <WorkoutDetailsSheet isOpen={isOpen && !!detailId} onClose={closeDetails}
      activity={focused} userId={userId} links={links} tasks={tasks}/>
  </>;
};
export default WorkoutHistorySheet;
