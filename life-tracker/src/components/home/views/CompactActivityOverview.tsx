import React from 'react';
import type { CompactActivityZoom } from '../../../lib/compactActivity';
import type { WeekStartsOn } from '../../../lib/preferences';

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

const LazyCompactActivityPager = React.lazy(() =>
  import('./CompactActivityPager').then(({ CompactActivityPager }) => ({ default: CompactActivityPager }))
);

/** Compact heatmap is loaded only on demand: the ordinary Home/Calendar and
 * Todo month path need no drag compositor, extra month tiles, or swipe code. */
export const CompactActivityOverview: React.FC<{
  focusDate: Date;
  zoom: Exclude<CompactActivityZoom, 'month'>;
  counts: ReadonlyMap<string, number>;
  weekStartsOn: WeekStartsOn;
  onMonthSelect: (date: Date) => void;
  onPeriodChange?: (step: -1 | 1) => void;
  noun: string;
  showTaskCounts?: boolean;
}> = props => (
  <React.Suspense fallback={<div className="min-h-16 w-full" aria-label="Loading activity overview" role="status" />}>
    <LazyCompactActivityPager key={props.zoom} {...props} />
  </React.Suspense>
);
