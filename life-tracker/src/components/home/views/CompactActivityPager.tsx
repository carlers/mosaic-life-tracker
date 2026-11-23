import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { attachResponsiveTrackpadGesture } from '../../../lib/responsiveTrackpadGesture';
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
  const dayCounts = useMemo(() => days.map(day => {
    const inside = isSameMonth(day, month);
    const dateKey = format(day, 'yyyy-MM-dd');
    return { day, dateKey, inside, count: inside ? counts.get(dateKey) ?? 0 : 0 };
  }), [days, month, counts]);
  const total = dayCounts.reduce((sum, day) => sum + day.count, 0);
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
        {dayCounts.map(({ day, dateKey, inside, count }) => (

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
          ))}
      </span>
    </button>
  );
});


type Step = -1 | 1;
type Drag = { id: number; x: number; y: number; time: number; locked: boolean };
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

const PeriodGrid = React.memo(({
  date, activeDate, zoom, counts, weekStartsOn, onMonthSelect, noun, showTaskCounts,
}: Omit<CompactPagerProps, 'focusDate' | 'onPeriodChange'> & {
  date: Date;
  activeDate: Date;
}) => {
  const months = useMemo(() => compactActivityPeriodMonths(date, zoom), [date, zoom]);
  return (
    <div className={'grid min-w-0 gap-2 ' +
      (zoom === 'year' ? 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
      {months.map(month => (
        <MiniMonth key={format(month, 'yyyy-MM')} month={month}
          active={month.getFullYear() === activeDate.getFullYear() && month.getMonth() === activeDate.getMonth()}
          counts={counts} weekStartsOn={weekStartsOn} onSelect={onMonthSelect}
          noun={noun} showTaskCounts={showTaskCounts} large={zoom === 'half-year'} />
      ))}
    </div>
  );
});

/**
 * Three period grids are rendered before any gesture. During a drag, the only
 * work is a coalesced compositor transform of those three prepainted layers.
 * No React state update, month calculation or lazy import runs on pointermove.
 *
 * All three grids share one CSS grid area, but stay in normal flow: the tallest
 * six-month period contributes to the parent's native vertical scroll height.
 */
export const CompactActivityPager: React.FC<CompactPagerProps> = ({
  focusDate, zoom, counts, weekStartsOn, onMonthSelect, onPeriodChange,
  noun, showTaskCounts = false,
}) => {
  const step = zoom === 'year' ? 12 : 6;
  const [displayDate, setDisplayDate] = useState(focusDate);
  const previousDate = useMemo(() => addMonths(displayDate, -step), [displayDate, step]);
  const nextDate = useMemo(() => addMonths(displayDate, step), [displayDate, step]);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(360);
  const pointer = useRef<Drag | null>(null);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const transitionRef = useRef('');
  const settling = useRef(false);
  const suppressClickUntil = useRef(0);
  const wheelGuardUntil = useRef(0);
  const navigateRef = useRef(onPeriodChange);
  const selectRef = useRef(onMonthSelect);
  useLayoutEffect(() => {
    navigateRef.current = onPeriodChange;
    selectRef.current = onMonthSelect;
  }, [onPeriodChange, onMonthSelect]);
  const selectMonth = React.useCallback((month: Date) => selectRef.current(month), []);

  const stopFrame = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };
  const positionNow = (offset: number) => {
    stopFrame();
    offsetRef.current = offset;
    const width = widthRef.current;
    if (previousRef.current) previousRef.current.style.transform = 'translate3d(' + (offset - width) + 'px,0,0)';
    if (currentRef.current) currentRef.current.style.transform = 'translate3d(' + offset + 'px,0,0)';
    if (nextRef.current) nextRef.current.style.transform = 'translate3d(' + (offset + width) + 'px,0,0)';
  };
  const positionOnFrame = (offset: number) => {
    offsetRef.current = offset;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      positionNow(offsetRef.current);
    });
  };
  const setTransition = (value: string) => {
    if (transitionRef.current === value) return;
    transitionRef.current = value;
    if (previousRef.current) previousRef.current.style.transition = value;
    if (currentRef.current) currentRef.current.style.transition = value;
    if (nextRef.current) nextRef.current.style.transition = value;
  };
  const clearFinish = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    finishRef.current = null;
  };
  const complete = () => finishRef.current?.();
  const resetDrag = () => {
    if (settling.current) return;
    setTransition('none');
    positionNow(0);
  };
  const drag = (offset: number) => {
    if (settling.current || !navigateRef.current) return;
    setTransition('none');
    const limit = widthRef.current * 0.96;
    positionOnFrame(Math.min(limit, Math.max(-limit, offset)));
  };
  const finish = (committed: boolean, direction: Step, notifyParent: boolean) => {
    if (!settling.current) return;
    clearFinish();
    settling.current = false;
    setTransition('none');
    positionNow(0);
    if (committed) {
      // Swap the completed page with the already-prepared next/previous page
      // in one React commit, then reset layers before the browser paints.
      flushSync(() => {
        setDisplayDate(date => addMonths(date, direction * step));
        if (notifyParent) navigateRef.current?.(direction);
      });
    }
  };
  const animate = (target: number, direction: Step, committed: boolean, notifyParent: boolean, ms: number) => {
    if (settling.current) return;
    settling.current = true;
    positionNow(offsetRef.current);
    setTransition(ms ? 'transform ' + ms + 'ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none');
    // Flush only on release/arrow, never on pointer movement.
    if (ms && currentRef.current) void currentRef.current.offsetWidth;
    positionNow(target);
    const end = () => finish(committed, direction, notifyParent);
    finishRef.current = end;
    if (ms === 0) end();
    else timerRef.current = window.setTimeout(end, ms + 65);
  };
  const settle = (offset: number, elapsed: number, wheel = false) => {
    if (settling.current) return;
    const distance = Math.abs(offset);
    const threshold = wheel ? 64 : Math.max(52, widthRef.current * 0.16);
    const velocity = distance / Math.max(1, elapsed);
    const accepted = Boolean(navigateRef.current &&
      (distance >= threshold || (!wheel && distance >= 28 && velocity >= 0.65)));
    const direction: Step = offset < 0 ? 1 : -1;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    animate(accepted ? (direction === 1 ? -widthRef.current : widthRef.current) : 0,
      direction, accepted, true, reduceMotion ? 0 : accepted ? 200 : 165);
  };

  // Header arrows update focusDate in PersonPane. Detect adjacent period
  // changes and animate the same already-rendered pages instead of teleporting.
  // Repeated rapid arrows are consumed one period at a time after each settle.
  useLayoutEffect(() => {
    if (settling.current || pointer.current) return;
    const periodStart = (date: Date) => Math.floor(
      (date.getFullYear() * 12 + date.getMonth()) / step
    ) * step;
    const delta = periodStart(focusDate) - periodStart(displayDate);
    if (delta === 0) {
      if (focusDate.getTime() !== displayDate.getTime()) queueMicrotask(() => setDisplayDate(focusDate));
      return;
    }
    if (Math.abs(delta) > step * 2) {
      // Today and arbitrary date jumps have no adjacent period to animate.
      queueMicrotask(() => setDisplayDate(focusDate));
      return;
    }
    const direction: Step = delta > 0 ? 1 : -1;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    animate(direction === 1 ? -widthRef.current : widthRef.current,
      direction, true, false, reducedMotion ? 0 : 200);
    // Depends on the authoritative parent date and the current painted period.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDate, displayDate, step]);

  useLayoutEffect(() => {
    const measure = () => {
      widthRef.current = currentRef.current?.clientWidth || 360;
      if (!settling.current && !pointer.current) positionNow(0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !currentRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(currentRef.current);
    return () => observer.disconnect();
    // No re-attachment on parent date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const host = rootRef.current;
    if (!host) return;
    const detach = attachResponsiveTrackpadGesture(host, {
      canNavigate: () => performance.now() >= wheelGuardUntil.current &&
        !settling.current && !pointer.current && Boolean(navigateRef.current),
      onMove: distance => drag(-distance),
      onCommit: distance => {
        wheelGuardUntil.current = performance.now() + 280;
        settle(-distance, 500, true);
      },
      onCancel: resetDrag,
    });
    return () => {
      detach();
      stopFrame();
      clearFinish();
    };
    // Trackpad handler reads live refs; do not restart on each period update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const common = { zoom, counts, weekStartsOn, onMonthSelect: selectMonth, noun, showTaskCounts };
  return (
    <div ref={rootRef}
      className="swiper-no-swiping relative w-full min-w-0 touch-pan-y overflow-x-clip px-2 pb-5 pt-2"
      role="group" aria-label={zoom === 'year' ? 'Year activity overview' : 'Six-month activity overview'}
      data-testid="compact-activity-overview" data-route-swipe-ignore="true"
      onPointerDown={event => {
        if (!event.isPrimary) { pointer.current = null; resetDrag(); return; }
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
          // Desktop mouse movement remains routed naturally inside this surface.
          // Re-capturing a mouse pointer after a spring-back can cause Chromium
          // to issue pointercancel on the next movement. Touch and pen require
          // capture to maintain ownership when contact leaves a month card.
          if (event.pointerType !== 'mouse') {
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional */ }
          }
        }
        event.stopPropagation();
        drag(dx);
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
      onPointerCancel={() => { pointer.current = null; resetDrag(); }}
      onClickCapture={event => {
        if (event.detail === 0 || performance.now() > suppressClickUntil.current) return;
        suppressClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="grid min-w-0" data-testid="compact-activity-pages">
        <div ref={previousRef} data-testid="compact-activity-previous" aria-hidden="true" inert
          className="pointer-events-none relative min-w-0 will-change-transform"
          style={{ gridArea: '1 / 1', transform: 'translate3d(-100%,0,0)' }}>
          <PeriodGrid date={previousDate} activeDate={displayDate} {...common} />
        </div>
        <div ref={currentRef} data-testid="compact-activity-current"
          className="relative min-w-0 will-change-transform"
          style={{ gridArea: '1 / 1', transform: 'translate3d(0,0,0)' }}
          onTransitionEnd={event => {
            if (event.target === currentRef.current && event.propertyName === 'transform') complete();
          }}>
          <PeriodGrid date={displayDate} activeDate={displayDate} {...common} />
        </div>
        <div ref={nextRef} data-testid="compact-activity-next" aria-hidden="true" inert
          className="pointer-events-none relative min-w-0 will-change-transform"
          style={{ gridArea: '1 / 1', transform: 'translate3d(100%,0,0)' }}>
          <PeriodGrid date={nextDate} activeDate={displayDate} {...common} />
        </div>
      </div>
    </div>
  );
};
