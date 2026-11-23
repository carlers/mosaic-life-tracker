import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useRxCollection } from '../../../hooks/useRxCollection';
import type { ActivityDocument } from '../../../db/schema';
import { formatWorkoutPace, workoutElapsedPace } from '../../../lib/workoutCsv';
const WorkoutHistorySheet = React.lazy(() => import('../../modals/WorkoutHistorySheet'));

/** Read-only owner activity rows; intentionally outside task/diary drag and friend data. */
const WorkoutDaySection: React.FC<{ dateStr: string; currentUserId: string }> = ({ dateStr, currentUserId }) => {
  const { user } = useAuth();
  const owner = user?.$id;
  const enabled = Boolean(owner && owner === currentUserId);
  const { data: workouts } = useRxCollection<ActivityDocument>({
    collection: 'activities',
    selector: { userId: enabled ? owner! : '', localDate: dateStr, isDeleted: false },
    enabled,
    logPrefix: '[WorkoutDaySection]',
  });
  const [open, setOpen] = React.useState(false);
  if (!enabled || workouts.length === 0) return null;
  return <section aria-label="Your workouts" className="mt-3 space-y-2">
    <h3 className="text-sm font-semibold text-gray-300">Workouts</h3>
    {workouts.map(item => <button key={item.id} type="button" onClick={() => setOpen(true)}
      className="mosaic-material-panel w-full rounded-xl border border-white/10 px-3 py-3 text-left">
      <span className="block text-sm font-medium text-white">{item.title}</span>
      <span className="block text-xs text-gray-400">
        {item.sport} · {(item.distanceMeters / 1000).toFixed(2)} km · {Math.round(item.elapsedSeconds)} sec · {' '}
        {formatWorkoutPace(workoutElapsedPace(item.distanceMeters,item.elapsedSeconds))} elapsed
      </span>
    </button>)}
    <React.Suspense fallback={null}>
      <WorkoutHistorySheet isOpen={open} onClose={() => setOpen(false)} date={dateStr} />
    </React.Suspense>
  </section>;
};
export default WorkoutDaySection;
