import React from 'react';
import { Activity, CalendarCheck2, ChevronRight, Link2 } from 'lucide-react';
import type { ActivityDocument } from '../../db/schema';
import { CategoryColorDot, type SelectableCategory } from './MosaicCategorySelect';
import { workoutElapsedPace, formatWorkoutPace } from '../../lib/workoutCsv';
import { formatWorkoutDuration, workoutCompletedText } from '../../lib/workoutFormat';

export const WorkoutMetrics: React.FC<{ activity: Pick<ActivityDocument, 'completedAt' | 'localDate'> & { distanceMeters: number | null; elapsedSeconds: number | null }; variant?: 'card' | 'sheet' }> = ({
  activity, variant = 'card',
}) => {
  const completed = workoutCompletedText(activity);
  const metrics = [
    { label: 'Distance', value: activity.distanceMeters === null ? '—' : (activity.distanceMeters / 1000).toFixed(2), unit: 'km' },
    { label: 'Duration', value: activity.elapsedSeconds === null ? '—' : formatWorkoutDuration(activity.elapsedSeconds), unit: '' },
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

export const workoutDayLabel = (value: string) => {
  if (!value) return 'Unrecognized date';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? value
    : new Intl.DateTimeFormat(undefined, {month:'long',day:'numeric',year:'numeric'}).format(date);
};

/** Shared compact, tappable workout row for history and the unsaved CSV review. */
export const WorkoutListRow: React.FC<{
  title: string; distanceMeters: number | null; elapsedSeconds: number | null;
  category?: SelectableCategory; attached?: boolean; separated?: boolean;
  status?: string; disabled?: boolean; onClick: () => void;
}> = ({title, distanceMeters, elapsedSeconds, category, attached, separated, status, disabled, onClick}) =>
  <button type="button" onClick={onClick} disabled={disabled}
    aria-label={`Open workout ${title}${status ? ' · ' + status : ''}`}
    className={'flex w-full min-w-0 items-center gap-3 px-3 py-3.5 text-left ' +
      'transition-colors hover:bg-surfaceHighlight focus-visible:outline-none ' +
      'focus-visible:ring-2 focus-visible:ring-emerald-500/60 ' +
      (separated ? 'border-t border-border/50' : '')}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surfaceHighlight"
      aria-hidden="true"><Activity size={18} style={category ? { color: category.color } : undefined}/></span>
    <span className="min-w-0 flex-1 space-y-1">
      <span className="block truncate text-[15px] font-semibold text-primary">{title}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
        {category && <span className="inline-flex items-center gap-1">
          <CategoryColorDot color={category.color}/>{category.name}</span>}
        <span>{distanceMeters === null ? '—' : (distanceMeters / 1000).toFixed(2) + ' km'}</span>
        <span>· {elapsedSeconds === null ? '—' : formatWorkoutDuration(elapsedSeconds)}</span>
        {attached && <Link2 size={12} aria-label="Linked to task"/>}
        {status && <span className="text-amber-300">{status}</span>}
      </span>
    </span>
    <ChevronRight size={17} className="shrink-0 text-secondary" aria-hidden="true"/>
  </button>;

export const WorkoutDetailHeader: React.FC<{ title: string; sport: string }> = ({title, sport}) =>
  <header className="space-y-1">
    <div className="flex items-center gap-2">
      <Activity size={18} className="text-secondary" aria-hidden="true"/>
      <span className="text-xs font-semibold uppercase tracking-wider text-secondary">{sport || 'Unknown sport'}</span>
    </div>
    <h3 className="break-words text-xl font-bold text-primary">{title}</h3>
  </header>;
