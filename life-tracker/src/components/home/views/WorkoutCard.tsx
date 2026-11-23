import React from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/react';
import type { ActivityDocument } from '../../../db/schema';
import { formatWorkoutPace, workoutElapsedPace } from '../../../lib/workoutCsv';
import { workoutRowId } from '../../../lib/workoutDayPlacement';
import { TaskRowRegistrationContext } from './taskRowRegistrationContext';

interface WorkoutCardProps {
  activities: readonly ActivityDocument[];
  categoryColor: string;
  onOpen: (activityId: string) => void;
  linked?: boolean;
  titleRef?: React.Ref<HTMLButtonElement>;
  dragOverlay?: boolean;
}
const durationText = (seconds: number) => {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${String(m).padStart(2,'0')}m` : `${m}:${String(s).padStart(2,'0')}`;
};
const summary = (row: ActivityDocument) =>
  `${row.sport} · ${(row.distanceMeters / 1000).toFixed(2)} km · ${durationText(row.elapsedSeconds)}`;

/** Same card surface in standalone and linked-task mode; disclosure never changes task completion. */
export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  activities, categoryColor, onOpen, linked = false, titleRef, dragOverlay = false,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const reduced = useReducedMotion();
  const root = React.useRef<HTMLDivElement>(null);
  const first = activities[0];
  if (!first) return null;
  const toggle = () => { if (!dragOverlay) setExpanded(value => !value); };
  const expandOrOpen = () => {
    if (dragOverlay) return;
    if (!expanded) setExpanded(true);
    else onOpen(first.id);
  };
  const revealFully = () => {
    const row = root.current;
    const scroller = row?.closest<HTMLElement>('[data-testid="day-slide"]');
    if (!row || !scroller) return;
    const bounds = row.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    const overlap = bounds.bottom - viewport.bottom + 12;
    if (overlap > 0) scroller.scrollBy({ top: overlap, behavior: reduced ? 'auto' : 'smooth' });
  };
  const title = linked ? activities.length === 1 ? 'Workout details' : `${activities.length} workouts` : first.title;
  return <div ref={root} data-workout-id={first.id} data-workout-linked={linked ? 'true' : undefined}
    className={linked
      ? 'min-w-0 mt-1'
      : 'mosaic-material-panel relative min-w-0 rounded-lg border border-white/10 px-2 py-2'}
    style={linked ? undefined : { borderLeftWidth: 2, borderLeftColor: categoryColor }}
    onClick={(event) => {
      if (!(event.target as HTMLElement).closest('button')) expandOrOpen();
    }}
  >
    <div className="flex min-w-0 items-center gap-2">
      <Activity size={15} className="shrink-0" style={{ color: categoryColor }} aria-hidden="true" />
      <button type="button" ref={titleRef}
        className="min-w-0 flex-1 touch-pan-y rounded text-left focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        aria-label={expanded ? `View ${title} details` : `Expand ${title}`}
        onClick={expandOrOpen} disabled={dragOverlay}>
        {!linked && <span className="block min-w-0 truncate text-sm font-medium text-white">{title}</span>}
        <span className="block min-w-0 truncate text-xs text-gray-300">
          {activities.length > 1 ? `${activities.length} workouts · ${summary(first)}` : summary(first)}
        </span>
      </button>
      <button type="button" aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        onClick={toggle} disabled={dragOverlay}>
        <ChevronDown size={18} className={expanded ? '-rotate-180 transition-transform duration-200 motion-reduce:transition-none' : 'transition-transform duration-200 motion-reduce:transition-none'} />
      </button>
    </div>
    {!dragOverlay && <motion.div
      initial={false}
      animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      onAnimationComplete={() => { if (expanded) revealFully(); }}
      style={{ overflow: 'hidden' }}
      aria-hidden={!expanded}>
      <div className="pt-2" inert={!expanded}>
        <div className="border-t border-white/10 pt-2 space-y-2">
          {activities.map(row => <button key={row.id} type="button"
            onClick={() => onOpen(row.id)}
            className="w-full rounded-lg px-1 py-1 text-left focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            {activities.length > 1 && <span className="block text-xs font-medium text-white">{row.title}</span>}
            <span className="block text-xs text-gray-300">
              {(row.distanceMeters/1000).toFixed(2)} km · {durationText(row.elapsedSeconds)} · {formatWorkoutPace(workoutElapsedPace(row.distanceMeters,row.elapsedSeconds))} elapsed pace
            </span>
            <span className="block text-xs text-gray-400">
              Completed {row.completedAt || row.localDate}
            </span>
          </button>)}
          <button type="button" className="w-full text-left text-xs text-emerald-400 underline underline-offset-2"
            onClick={() => onOpen(first.id)}>View / edit workout details</button>
        </div>
      </div>
    </motion.div>}
  </div>;
};

export const DraggableWorkoutRow: React.FC<Omit<WorkoutCardProps,'activities' | 'linked'> & {
  activity: ActivityDocument;
}> = ({ activity, ...props }) => {
  const registered = React.useContext(TaskRowRegistrationContext);
  return registered
    ? <RegisteredWorkoutRow activity={activity} {...props}/>
    : <WorkoutCard activities={[activity]} {...props}/>;
};
const RegisteredWorkoutRow: React.FC<Omit<WorkoutCardProps,'activities' | 'linked'> & {
  activity: ActivityDocument;
}> = ({ activity, ...props }) => {
  const { ref, handleRef } = useDraggable({ id: workoutRowId(activity.id), type: 'task' });
  return <>
    <div ref={ref} aria-hidden="true" data-workout-dnd-registered="true"
      style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}/>
    <WorkoutCard activities={[activity]} {...props} titleRef={handleRef}/>
  </>;
};
