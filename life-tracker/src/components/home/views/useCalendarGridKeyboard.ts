import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isSameMonth,
  isSameWeek,
  parseISO,
  startOfWeek,
} from 'date-fns';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';

interface CalendarGridKeyboardOptions {
  enabled: boolean;
  singleKeyShortcutsEnabled?: boolean;
  slides: Date[];
  activeIndex: number;
  viewMode: CalendarViewMode;
  weekStartsOn: WeekStartsOn;
  onPrev: () => void;
  onNext: () => void;
}

const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
const daySelector = (key: string) => `button[data-calendar-day="${key}"]`;
const editableSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

/**
 * A date may acquire focus while Embla is still animating its month/weekly
 * slide into place. Element.scrollIntoView() also scrolls *horizontal
 * ancestors*, including Embla's viewport, which competes with Embla's own
 * transform and can leave the calendar between snaps.
 *
 * Only adjust the explicit scroll owners inside this selected slide:
 * the optional 3/4-day weekday lane (horizontal), and the period slide
 * itself (vertical). Never scroll Embla or the page.
 */
export function scrollCalendarDateWithinSlide(day: HTMLElement, slide: HTMLElement): void {
  const lane = day.closest<HTMLElement>('[data-calendar-zoom-lane]');
  const dayRect = day.getBoundingClientRect();

  if (lane && slide.contains(lane)) {
    const laneRect = lane.getBoundingClientRect();
    const delta = dayRect.left < laneRect.left ? dayRect.left - laneRect.left
      : dayRect.right > laneRect.right ? dayRect.right - laneRect.right : 0;
    if (Math.abs(delta) > 1) lane.scrollLeft += delta;
  }

  const slideRect = slide.getBoundingClientRect();
  const deltaY = dayRect.top < slideRect.top ? dayRect.top - slideRect.top
    : dayRect.bottom > slideRect.bottom ? dayRect.bottom - slideRect.bottom : 0;
  if (Math.abs(deltaY) > 1) slide.scrollTop += deltaY;
}


export function useCalendarGridKeyboard({
  enabled, singleKeyShortcutsEnabled = true, slides, activeIndex, viewMode, weekStartsOn, onPrev, onNext,
}: CalendarGridKeyboardOptions) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const pendingFocusRef = useRef<{ key: string; index: number } | null>(null);
  const activeDate = slides[activeIndex];
  const isInPeriod = useCallback((date: Date, reference: Date) =>
    viewMode === 'month' ? isSameMonth(date, reference) :
      isSameWeek(date, reference, { weekStartsOn }),
  [viewMode, weekStartsOn]);

  // Exactly one reachable Tab stop across all mounted carousel slides.
  // Preserve the keyboard date while it belongs to the current month/week;
  // for pointer navigation, return to the new period's anchor.
  const activeKey = useMemo(() => {
    if (!activeDate) return '';
    if (focusedKey && isInPeriod(parseISO(focusedKey), activeDate)) return focusedKey;
    return dateKey(activeDate);
  }, [activeDate, focusedKey, isInPeriod]);

  const activeSlide = useCallback(() =>
    rootRef.current?.querySelector<HTMLElement>(`[data-calendar-slide-index="${activeIndex}"]`) ?? null,
  [activeIndex]);

  const focusKey = useCallback((key: string) => {
    const target = activeSlide()?.querySelector<HTMLButtonElement>(daySelector(key));
    if (!target || target.disabled) return false;
    setFocusedKey(key);
    target.focus({ preventScroll: true });
    const slide = activeSlide();
    if (slide) scrollCalendarDateWithinSlide(target, slide);
    return true;
  }, [activeSlide]);

  const move = useCallback((date: Date) => {
    if (!activeDate) return;
    const nextKey = dateKey(date);
    if (isInPeriod(date, activeDate)) {
      focusKey(nextKey);
      return;
    }
    const direction = date.getTime() < activeDate.getTime() ? -1 : 1;
    const index = activeIndex + direction;
    if (!slides[index]) return; // Do not steal focus at the carousel boundary.
    pendingFocusRef.current = { key: nextKey, index };
    if (direction < 0) onPrev();
    else onNext();
  }, [activeDate, activeIndex, focusKey, isInPeriod, onNext, onPrev, slides]);

  // Embla first commits the selected index, then the adjacent slide's grid.
  // Retain the requested date across that render without targeting a
  // duplicate spillover date in a hidden neighboring month.
  useEffect(() => {
    if (!enabled) return;
    const pending = pendingFocusRef.current;
    if (!pending || pending.index !== activeIndex) return;
    if (focusKey(pending.key)) pendingFocusRef.current = null;
  }, [activeIndex, enabled, focusKey, slides]);

  const onFocusCapture = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!enabled || !(event.target instanceof HTMLButtonElement)) return;
    const key = event.target.dataset.calendarDay;
    if (!key || !activeSlide()?.contains(event.target)) return;
    setFocusedKey(current => current === key ? current : key);
  }, [activeSlide, enabled]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || event.defaultPrevented || event.nativeEvent.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const source = event.target;
    if (!(source instanceof HTMLButtonElement) || !source.dataset.calendarDay ||
      !activeSlide()?.contains(source)) return;
    const date = parseISO(source.dataset.calendarDay);
    let destination: Date;
    switch (event.key) {
      case 'ArrowLeft': destination = addDays(date, -1); break;
      case 'ArrowRight': destination = addDays(date, 1); break;
      case 'ArrowUp': destination = addDays(date, -7); break;
      case 'ArrowDown': destination = addDays(date, 7); break;
      case 'Home': destination = startOfWeek(date, { weekStartsOn }); break;
      case 'End': destination = endOfWeek(date, { weekStartsOn }); break;
      case 'PageUp':
        destination = viewMode === 'month' ? addMonths(date, -1) : addWeeks(date, -1);
        break;
      case 'PageDown':
        destination = viewMode === 'month' ? addMonths(date, 1) : addWeeks(date, 1);
        break;
      default: return; // Native Enter/Space activate the existing day button.
    }
    event.preventDefault();
    event.stopPropagation(); // The global month-swipe key owner must not also run.
    move(destination);
  }, [activeSlide, enabled, move, viewMode, weekStartsOn]);

  const focusGrid = useCallback(() => {
    if (!enabled || !activeDate) return;
    if (!focusKey(activeKey)) {
      const first = activeSlide()?.querySelector<HTMLButtonElement>('button[data-calendar-day]:not(:disabled)');
      first?.focus({ preventScroll: true });
    }
  }, [activeDate, activeKey, activeSlide, enabled, focusKey]);

  useEffect(() => {
    if (!enabled) {
      pendingFocusRef.current = null;
      return;
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.key.toLowerCase() !== 'g' ||
        (event.target instanceof Element && event.target.closest(editableSelector)) ||
        document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      focusGrid();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled, focusGrid, singleKeyShortcutsEnabled]);

  return { rootRef, onFocusCapture, onKeyDown, activeKey, focusGrid };
}
