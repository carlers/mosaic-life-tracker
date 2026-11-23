import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { compactActivityIntensity, compactActivityPeriodMonths } from '../../../lib/compactActivity';
import type { CompactActivityZoom } from '../../../lib/compactActivity';
import type { WeekStartsOn } from '../../../lib/preferences';

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TONES = [
  'var(--mosaic-surface-pressed)',
  'color-mix(in srgb, var(--mosaic-accent) 27%, var(--mosaic-surface))',
  'color-mix(in srgb, var(--mosaic-accent) 48%, var(--mosaic-surface))',
  'color-mix(in srgb, var(--mosaic-accent) 72%, var(--mosaic-surface))',
  'var(--mosaic-accent)',
] as const;

const MiniMonth: React.FC<{
  month: Date;
  active: boolean;
  counts: ReadonlyMap<string, number>;
  weekStartsOn: WeekStartsOn;
  onSelect: (date: Date) => void;
  noun: string;
  showTaskCounts?: boolean;
  large: boolean;
}> = React.memo(({ month, active, counts, weekStartsOn, onSelect, noun, showTaskCounts = false, large }) => {
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
      className={'mosaic-material-panel min-w-0 rounded-lg border p-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ' +
        (active ? 'border-[var(--mosaic-accent)]' : 'border-[var(--mosaic-surface-pressed)]') +
        (large ? ' max-w-48' : ' max-w-40') +
        ' bg-surface hover:bg-surfaceHighlight'}
      style={large ? { maxWidth: 'clamp(12rem,calc(44dvh - 122px),21rem)' } : undefined}>
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
});


type Step = -1 | 1;
type Drag = {
  id: number;
  x: number;
  y: number;
  time: number;
  locked: boolean;
};
interface CompactPagerProps {
  focusDate: Date;
  zoom: Exclude<CompactActivityZoom, 'month'>;
  counts: ReadonlyMap<string, number>;
  weekStartsOn: WeekStartsOn;
  onMonthSelect: (date: Date) => void;
  onPeriodChange?: (step: Step) => void;
  noun: string;
  showTaskCounts?: boolean;
}

/** Only the outgoing period and the needed adjacent period are mounted.
 * Mouse/touch/trackpad frames edit one CSS variable, never React month state.
 * The next period becomes authoritative after its compositor settle ends. */
export const CompactActivityPager: React.FC<CompactPagerProps> = ({
  focusDate, zoom, counts, weekStartsOn, onMonthSelect, onPeriodChange,
  noun, showTaskCounts = false,
}) => {
  const currentMonths = useMemo(() => compactActivityPeriodMonths(focusDate, zoom), [focusDate, zoom]);
  const step = zoom === 'year' ? 12 : 6;
  const [neighbor, setNeighbor] = useState<Step | null>(null);
  const neighborRef = useRef<Step | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const adjacentRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<Drag | null>(null);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const settling = useRef(false);
  const suppressClickUntil = useRef(0);
  const wheelGuardUntil = useRef(0);
  const navigateRef = useRef(onPeriodChange);
  useLayoutEffect(() => { navigateRef.current = onPeriodChange; }, [onPeriodChange]);

  const adjacentMonths = useMemo(() => neighbor === null ? [] :
    compactActivityPeriodMonths(addMonths(focusDate, step * neighbor), zoom),
  [focusDate, neighbor, step, zoom]);
  const width = () => currentRef.current?.clientWidth || 360;
  const limit = (x: number) => Math.max(-width() * 0.96, Math.min(width() * 0.96, x));
  const stopFrame = () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };
  const apply = (x: number) => {
    offsetRef.current = x;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      rootRef.current?.style.setProperty('--heatmap-drag-x', offsetRef.current + 'px');
    });
  };
  const applyNow = (x: number) => {
    stopFrame();
    offsetRef.current = x;
    rootRef.current?.style.setProperty('--heatmap-drag-x', x + 'px');
  };
  const transitions = (value: string) => {
    if (currentRef.current) currentRef.current.style.transition = value;
    if (adjacentRef.current) adjacentRef.current.style.transition = value;
  };
  const clearFinish = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    finishRef.current = null;
  };
  const complete = () => finishRef.current?.();
  const reset = () => {
    clearFinish();
    settling.current = false;
    transitions('none');
    applyNow(0);
    neighborRef.current = null;
    setNeighbor(null);
  };
  const preview = (offset: number) => {
    if (settling.current || !navigateRef.current) return;
    const x = limit(offset);
    const dir: Step = x < 0 ? 1 : -1;
    if (neighborRef.current !== dir) {
      neighborRef.current = dir;
      setNeighbor(dir);
    }
    transitions('none');
    apply(x);
  };
  const settle = (offset: number, elapsed: number, wheel = false) => {
    if (settling.current) return;
    const distance = Math.abs(offset);
    const threshold = wheel ? 64 : Math.max(52, width() * 0.16);
    const velocity = distance / Math.max(1, elapsed);
    const accepted = Boolean(navigateRef.current && neighborRef.current &&
      (distance >= threshold || (!wheel && distance >= 28 && velocity >= 0.65)));
    const dir = neighborRef.current;
    settling.current = true;
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0 : accepted ? 200 : 165;
    const finish = () => {
      if (!settling.current) return;
      clearFinish();
      settling.current = false;
      transitions('none');
      // Rebase the freshly selected period and the offscreen neighbor in the
      // same React commit. No frame is painted between these two surfaces.
      if (accepted && dir) flushSync(() => {
        navigateRef.current?.(dir);
        neighborRef.current = null;
        setNeighbor(null);
      });
      else {
        neighborRef.current = null;
        setNeighbor(null);
      }
      applyNow(0);
    };
    finishRef.current = finish;
    applyNow(offsetRef.current);
    transitions(duration ? 'transform ' + duration + 'ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none');
    // Ensure the existing dragged position is committed before the settle.
    if (duration && currentRef.current) currentRef.current.getBoundingClientRect();
    applyNow(accepted ? (dir === 1 ? -width() : width()) : 0);
    if (!duration) finish();
    else timerRef.current = window.setTimeout(finish, duration + 65);
  };

  useEffect(() => {
    let disposed = false;
    let detach: (() => void) | undefined;
    const host = rootRef.current;
    if (host) void import('../../../lib/responsiveTrackpadGesture').then(
      ({ attachResponsiveTrackpadGesture }) => {
        if (disposed) return;
        detach = attachResponsiveTrackpadGesture(host, {
          canNavigate: () => performance.now() >= wheelGuardUntil.current &&
            !settling.current && !pointer.current && Boolean(navigateRef.current),
          onMove: signedPixels => preview(-signedPixels),
          onCommit: signedPixels => {
            wheelGuardUntil.current = performance.now() + 280;
            settle(-signedPixels, 500, true);
          },
          onCancel: () => { if (!settling.current) reset(); },
        });
      }).catch(() => { /* Pointer and header arrows remain usable. */ });
    return () => {
      disposed = true;
      detach?.();
      stopFrame();
      clearFinish();
    };
    // One owner per mounted zoom view; live props are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMonths = (months: Date[]) => (
    <div className={'grid gap-2 ' +
      (zoom === 'year' ? 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
      {months.map(month => (
        <MiniMonth key={format(month, 'yyyy-MM')} month={month}
          active={month.getFullYear() === focusDate.getFullYear() && month.getMonth() === focusDate.getMonth()}
          counts={counts} weekStartsOn={weekStartsOn} onSelect={onMonthSelect}
          noun={noun} showTaskCounts={showTaskCounts} large={zoom === 'half-year'} />
      ))}
    </div>
  );

  return (
    <div ref={rootRef}
      className="swiper-no-swiping relative w-full min-w-0 touch-pan-y overflow-x-clip px-2 pb-3 pt-2"
      style={{ '--heatmap-drag-x': '0px' } as React.CSSProperties}
      role="group" aria-label={zoom === 'year' ? 'Year activity overview' : 'Six-month activity overview'}
      data-testid="compact-activity-overview" data-route-swipe-ignore="true"
      onPointerDown={event => {
        if (!event.isPrimary) { pointer.current = null; if (!settling.current) reset(); return; }
        if (event.button !== 0 || !navigateRef.current) return;
        if (settling.current) complete();
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
          time: event.timeStamp, locked: false };
      }}
      onPointerMove={event => {
        const state = pointer.current;
        if (!state || state.id !== event.pointerId) return;
        const dx = event.clientX - state.x, dy = event.clientY - state.y;
        if (!state.locked) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return;
          if (Math.abs(dy) > Math.abs(dx) * 1.15) { pointer.current = null; return; }
          if (Math.abs(dx) <= Math.abs(dy) * 1.15) return;
          state.locked = true;
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional */ }
        }
        event.stopPropagation();
        preview(dx);
      }}
      onPointerUp={event => {
        const state = pointer.current;
        pointer.current = null;
        if (!state || state.id !== event.pointerId) return;
        if (state.locked) {
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* optional */ }
          suppressClickUntil.current = performance.now() + 300;
          settle(event.clientX - state.x, event.timeStamp - state.time);
        }
      }}
      onPointerCancel={() => { pointer.current = null; if (!settling.current) settle(0, 1); }}
      onClickCapture={event => {
        if (event.detail === 0 || performance.now() > suppressClickUntil.current) return;
        suppressClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div ref={currentRef} className="relative w-full will-change-transform"
        style={{ transform: 'translate3d(var(--heatmap-drag-x),0,0)' }}
        onTransitionEnd={event => {
          if (event.target === currentRef.current && event.propertyName === 'transform') complete();
        }}>
        {renderMonths(currentMonths)}
      </div>
      {neighbor !== null && (
        <div ref={adjacentRef} data-testid="compact-activity-neighbor"
          aria-hidden="true" inert
          className="pointer-events-none absolute inset-x-2 top-2 will-change-transform"
          style={{ transform: neighbor === 1
            ? 'translate3d(calc(100% + var(--heatmap-drag-x)),0,0)'
            : 'translate3d(calc(-100% + var(--heatmap-drag-x)),0,0)' }}>
          {renderMonths(adjacentMonths)}
        </div>
      )}
    </div>
  );
};
