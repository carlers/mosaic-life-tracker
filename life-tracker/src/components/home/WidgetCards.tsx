import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { DiaryDocument } from '../../db/schema';
import type { CategoryLoad, CategoryRangeDays, PeriodProgress, WidgetProgressPeriod } from '../../lib/widgetDashboardData';

const SURFACE = 'mosaic-material-control flex h-60 min-w-0 flex-col overflow-hidden rounded-2xl border border-[#333333] bg-surface px-4 py-4';

export const TodayDiaryWidget = React.memo(function TodayDiaryWidget({
  entries, onOpen,
}: { entries: readonly DiaryDocument[]; onOpen: () => void }) {
  return (
    <section aria-label="Today's diary entries" className={SURFACE}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <button type="button" onClick={onOpen} aria-label="Open today's diary"
          className="rounded text-left text-base font-semibold text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
          Diary <ChevronRight size={16} className="inline text-gray-400" aria-hidden="true" />
        </button>
        <span className="text-xs tabular-nums text-gray-400">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm text-gray-400">No entries today</p>
      ) : (
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
          {entries.slice(0, 5).map(entry => (
            <button key={entry.id} type="button" onClick={onOpen} aria-label="Open today's diary"
              className="block w-full rounded-lg bg-surfaceHighlight/50 px-3 py-2 text-left text-sm text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
              {entry.emoji ? <span className="mr-2" aria-hidden="true">{entry.emoji}</span> : null}
              <span className="break-words">{(entry.content || '').replace(/\s+/g, ' ').trim().slice(0, 125) || 'Diary entry'}</span>
            </button>
          ))}
          {entries.length > 5 && (
            <button type="button" onClick={onOpen} className="text-xs text-gray-400">
              +{entries.length - 5} more
            </button>
          )}
        </div>
      )}
    </section>
  );
});

export const HeavyCategoriesWidget = React.memo(function HeavyCategoriesWidget({
  categories, rangeDays, onRangeChange,
}: { categories: readonly CategoryLoad[]; rangeDays: CategoryRangeDays; onRangeChange: (days: CategoryRangeDays) => void }) {
  const top = categories.slice(0, 4);
  const max = top[0]?.count ?? 1;
  return (
    <section aria-label={rangeDays === 7 ? 'Heaviest categories, last seven days' : 'Heaviest categories, last ' + rangeDays + ' days'} className={SURFACE}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-base font-semibold text-white">Top categories</h2>
        <select aria-label="Category history range" value={rangeDays}
          onChange={event => onRangeChange(Number(event.target.value) as CategoryRangeDays)}
          className="min-w-0 max-w-[52%] rounded-lg border border-border bg-surfaceHighlight px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>
      <p className="mt-1 text-xs text-gray-400">Scheduled task count</p>
      {top.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm text-gray-400">No tasks</p>
      ) : (
        <ol className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
          {top.map(item => (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-white">{item.name}</span>
                <span className="shrink-0 tabular-nums text-gray-400">{item.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surfaceHighlight">
                <div className="h-full rounded-full" style={{
                  width: 100 * item.count / max + '%', backgroundColor: item.color,
                }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
});

export const WeeklyProgressWidget = React.memo(function WeeklyProgressWidget({
  progress, period, onPeriodChange,
}: { progress: PeriodProgress; period: WidgetProgressPeriod; onPeriodChange: (period: WidgetProgressPeriod) => void }) {
  const title = period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'This year';
  return (
    <section aria-label={'Task progress for ' + title.toLowerCase()} className={SURFACE}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 text-base font-semibold text-white">Progress</h2>
        <select aria-label="Progress period" value={period}
          onChange={event => onPeriodChange(event.target.value as WidgetProgressPeriod)}
          className="min-w-0 max-w-[58%] rounded-lg border border-border bg-surfaceHighlight px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
        </select>
      </div>
      <div className="mt-1 flex justify-end text-xs tabular-nums text-gray-400">
        {progress.completed}/{progress.total} tasks
      </div>
      <div role="progressbar" aria-label={title + "'s task progress"}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}
        aria-valuetext={progress.completed + ' of ' + progress.total + ' tasks complete'}
        className="mt-3 h-1.5 shrink-0 overflow-hidden rounded-full bg-surfaceHighlight">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: progress.percentage + '%' }} />
      </div>
      <div className={'mt-4 grid min-h-0 flex-1 items-end ' +
        (period === 'year' ? 'grid-cols-12 gap-0.5' : period === 'month' ? 'grid-cols-6 gap-1' : 'grid-cols-7 gap-1')}>
        {progress.buckets.map(day => {
          const fraction = day.total ? day.completed / day.total : 0;
          return (
            <div key={day.key} className="flex min-w-0 flex-col items-center gap-1.5"
              title={day.key + ': ' + day.completed + '/' + day.total + ' completed'}>
              <div className="relative h-20 w-full max-w-5 overflow-hidden rounded-md bg-surfaceHighlight">
                <div role="progressbar"
                  aria-label={'Tasks completed on ' + day.key}
                  aria-valuemin={0} aria-valuemax={day.total} aria-valuenow={day.completed}
                  aria-valuetext={day.completed + ' of ' + day.total + ' tasks completed'}
                  className="absolute bottom-0 w-full rounded-md bg-emerald-500/80"
                  style={{ height: day.completed > 0 ? Math.max(5, 100 * fraction) + '%' : '0%' }} />
              </div>
              <span className="max-w-full truncate text-[10px] text-gray-400">{day.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
});
