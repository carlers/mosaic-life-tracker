import React, { useMemo } from 'react';
import {
  eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns';
import {
  compactActivityIntensity, compactActivityPeriodMonths,
  type CompactActivityZoom,
} from '../../../lib/compactActivity';
import type { WeekStartsOn } from '../../../lib/preferences';

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TONES = [
  'var(--mosaic-surface-pressed)',
  'color-mix(in srgb, var(--mosaic-accent) 27%, var(--mosaic-surface))',
  'color-mix(in srgb, var(--mosaic-accent) 48%, var(--mosaic-surface))',
  'color-mix(in srgb, var(--mosaic-accent) 72%, var(--mosaic-surface))',
  'var(--mosaic-accent)',
] as const;

export const CompactActivityLegend: React.FC = () => (
  <div className="flex items-center justify-end gap-1.5 px-2 text-[10px] text-textSecondary" aria-label="Activity intensity, zero to seven or more entries">
    <span>Less</span>
    {TONES.map((tone, index) => (
      <span key={tone} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: tone }}
        aria-label={['0', '1', '2–3', '4–6', '7+'][index]} title={['0', '1', '2–3', '4–6', '7+'][index]} />
    ))}
    <span>More</span>
  </div>
);

const MiniMonth: React.FC<{
  month: Date;
  active: boolean;
  counts: ReadonlyMap<string, number>;
  weekStartsOn: WeekStartsOn;
  onSelect: (date: Date) => void;
  noun: string;
  showTaskCounts?: boolean;
  large: boolean;
}> = ({ month, active, counts, weekStartsOn, onSelect, noun, showTaskCounts = false, large }) => {
  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  }), [month, weekStartsOn]);
  let total = 0;
  for (const day of days) if (isSameMonth(day, month))
    total += counts.get(format(day, 'yyyy-MM-dd')) ?? 0;
  const weekdayLabels = weekStartsOn === 0 ? LABELS : [...LABELS.slice(1), LABELS[0]];

  return (
    <button type="button" onClick={() => onSelect(month)}
      aria-label={'Open ' + format(month, 'MMMM yyyy') + ', ' + total + ' ' + (total === 1 ? noun : noun === 'entry' ? 'entries' : 'tasks')}
      aria-pressed={active}
      data-testid={'compact-heatmap-month-' + format(month, 'yyyy-MM')}
      className={'min-w-0 rounded-lg border p-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ' +
        (active ? 'border-[var(--mosaic-accent)]' : 'border-[var(--mosaic-surface-pressed)]') +
        (large ? ' max-w-48' : ' max-w-40') +
        ' bg-[var(--mosaic-surface)] hover:bg-[var(--mosaic-surface-elevated)]'}>
      <span className="mb-1 block truncate text-[11px] font-semibold text-textPrimary">{format(month, 'MMM')}</span>
      <span className="mb-0.5 grid grid-cols-7 gap-px" aria-hidden="true">
        {weekdayLabels.map((label, index) =>
          <span key={index} className="text-center text-[8px] text-textSecondary">{label}</span>)}
      </span>
      <span className="grid grid-cols-7 gap-px" aria-hidden="true">
        {days.map(day => {
          const inside = isSameMonth(day, month);
          const dateKey = format(day, 'yyyy-MM-dd');
          const count = inside ? counts.get(dateKey) ?? 0 : 0;
          return (
            <span key={dateKey}
              className="flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-[2px]"
              title={inside ? format(day, 'MMM d') + ': ' + count : undefined}
              style={inside ? { backgroundColor: TONES[compactActivityIntensity(count)] } : undefined}>
              {showTaskCounts && noun === 'task' && count > 0 && (
                <span className="pointer-events-none whitespace-nowrap text-[8px] font-semibold leading-none tracking-[-0.5px] sm:text-[9px]"
                  style={{ color: compactActivityIntensity(count) >= 3 ? 'var(--mosaic-accent-foreground)' : 'var(--mosaic-text)' }}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </button>
  );
};

/** Fixed six/twelve month projection, never an image-backed calendar carousel. */
export const CompactActivityOverview: React.FC<{
  focusDate: Date;
  zoom: Exclude<CompactActivityZoom, 'month'>;
  counts: ReadonlyMap<string, number>;
  weekStartsOn: WeekStartsOn;
  onMonthSelect: (date: Date) => void;
  noun: string;
  showTaskCounts?: boolean;
}> = ({ focusDate, zoom, counts, weekStartsOn, onMonthSelect, noun, showTaskCounts = false }) => {
  const months = useMemo(() => compactActivityPeriodMonths(focusDate, zoom), [focusDate, zoom]);
  return (
    <div className="w-full min-w-0 px-2 pb-3 pt-2" role="group"
      aria-label={zoom === 'year' ? 'Year activity overview' : 'Six-month activity overview'}
      data-testid="compact-activity-overview">
      <div className={'grid gap-2 ' +
        (zoom === 'year' ? 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
        {months.map(month => (
          <MiniMonth key={format(month, 'yyyy-MM')} month={month}
            active={month.getFullYear() === focusDate.getFullYear() && month.getMonth() === focusDate.getMonth()}
            counts={counts} weekStartsOn={weekStartsOn} onSelect={onMonthSelect} noun={noun}
            showTaskCounts={showTaskCounts} large={zoom === 'half-year'} />
        ))}
      </div>
    </div>
  );
};
