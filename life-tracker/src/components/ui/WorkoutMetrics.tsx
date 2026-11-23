import React from 'react';
import { CalendarCheck2 } from 'lucide-react';
import type { ActivityDocument } from '../../db/schema';
import { workoutElapsedPace, formatWorkoutPace } from '../../lib/workoutCsv';
import { formatWorkoutDuration, workoutCompletedText } from '../../lib/workoutFormat';

export const WorkoutMetrics: React.FC<{ activity: ActivityDocument; variant?: 'card' | 'sheet' }> = ({
  activity, variant = 'card',
}) => {
  const completed = workoutCompletedText(activity);
  const metrics = [
    { label: 'Distance', value: `${(activity.distanceMeters / 1000).toFixed(2)}`, unit: 'km' },
    { label: 'Duration', value: formatWorkoutDuration(activity.elapsedSeconds), unit: '' },
    { label: 'Avg pace', value: formatWorkoutPace(workoutElapsedPace(activity.distanceMeters, activity.elapsedSeconds)), unit: '' },
    { label: 'Finished', value: completed.time, unit: '' },
  ];
  return <div className={variant === 'sheet' ? 'space-y-4' : 'space-y-3'}>
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {metrics.map(metric => <div key={metric.label} className="min-w-0">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">
          {metric.label}
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-1 tabular-nums">
          <span className={(variant === 'sheet' ? 'text-[1.55rem]' : 'text-[1.3rem]') +
            ' font-bold leading-tight tracking-tight text-primary'}>{metric.value}</span>
          {metric.unit && <span className="text-sm font-medium text-secondary">{metric.unit}</span>}
        </div>
      </div>)}
    </div>
    <div className="flex items-center gap-2 border-t border-border/60 pt-2.5 text-xs font-medium text-secondary">
      <CalendarCheck2 size={14} aria-hidden="true" className="shrink-0"/>
      <span>Completed · {completed.day}</span>
    </div>
  </div>;
};
