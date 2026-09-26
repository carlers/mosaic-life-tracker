import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  addWeeks,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
} from 'date-fns';
import useEmblaCarousel from 'embla-carousel-react';

export type CalendarViewMode = 'month' | 'week';

const SLIDES_EACH_SIDE = 30;
const TOTAL_SLIDES = SLIDES_EACH_SIDE * 2 + 1;
const CENTER_INDEX = SLIDES_EACH_SIDE;
// Slides to render on each side of the active/focus index. Embla mounts
// every child it receives; without this cap the 61-slide carousel mounts
// 61 full month grids on cold load (~2.5k DayCells).
const INITIAL_RENDER_WINDOW = 1;
const RAPID_RENDER_WINDOW = 2;

export interface CalendarState {
  viewMode: CalendarViewMode;
  focusDate: Date;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  title: string;
  handlePrev: () => void;
  handleNext: () => void;
  handleToggle: () => void;
  resetToToday: () => void;
}

export function useCalendarState(isActive = true): CalendarState {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());
  const [emblaActiveIndex, setEmblaActiveIndex] = useState(CENTER_INDEX);
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const isInternalSwipeRef = useRef(false);
  const [prevViewMode, setPrevViewMode] = useState(viewMode);

  if (prevViewMode !== viewMode) {
    setPrevViewMode(viewMode);
    setBaseDate(focusDate);
  }

  const slides = useMemo(() => {
    const fn = viewMode === 'month' ? addMonths : addWeeks;
    return Array.from({ length: TOTAL_SLIDES }, (_, i) =>
      fn(baseDate, i - CENTER_INDEX)
    );
  }, [baseDate, viewMode]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    skipSnaps: false,
    startIndex: CENTER_INDEX,
    duration: 22,
  });

  // Preserve the three-grid cold mount, then prewarm one extra calendar on
  // each side only for the active person once the browser is idle. This keeps
  // a second quick swipe populated without pushing that work into the snap.
  useEffect(() => {
    if (!isActive || isPrewarmed) return;

    const prewarm = () => setIsPrewarmed(true);
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(prewarm, { timeout: 1200 });
      return () => {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    const timer = window.setTimeout(prewarm, 400);
    return () => window.clearTimeout(timer);
  }, [isActive, isPrewarmed]);

  // Keep the settled-side window mounted through the snap. Selection can
  // advance again before Embla settles, so the render bounds below retain this
  // window while also extending toward the newest selected month/week.
  useEffect(() => {
    if (!emblaApi) return;
    const syncSettledIndex = () => {
      const index = emblaApi.selectedScrollSnap();
      setEmblaActiveIndex((prev) => (prev === index ? prev : index));
    };
    syncSettledIndex();
    emblaApi.on('settle', syncSettledIndex);
    emblaApi.on('reInit', syncSettledIndex);
    return () => {
      emblaApi.off('settle', syncSettledIndex);
      emblaApi.off('reInit', syncSettledIndex);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    if (isInternalSwipeRef.current) {
      isInternalSwipeRef.current = false;
      return;
    }
    const offset =
      viewMode === 'month'
        ? differenceInCalendarMonths(focusDate, baseDate)
        : differenceInCalendarWeeks(focusDate, baseDate);
    const targetIndex = CENTER_INDEX + offset;
    if (targetIndex < 0 || targetIndex >= TOTAL_SLIDES) return;
    if (emblaApi.selectedScrollSnap() !== targetIndex) {
      emblaApi.scrollTo(targetIndex, true);
    }
  }, [emblaApi, focusDate, baseDate, viewMode]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      const offset = index - CENTER_INDEX;
      const fn = viewMode === 'month' ? addMonths : addWeeks;
      const newDate = fn(baseDate, offset);
      const same =
        viewMode === 'month'
          ? differenceInCalendarMonths(newDate, focusDate) === 0
          : differenceInCalendarWeeks(newDate, focusDate) === 0;

      if (!same) {
        // Update the lightweight date/header state as soon as Embla selects
        // the next snap so another quick swipe can build on the new target.
        // The heavy calendar render window stays pinned until settle below.
        isInternalSwipeRef.current = true;
        setFocusDate(newDate);
      }
    };
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, baseDate, focusDate, viewMode]);

  const handlePrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);
  const handleNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const handleToggle = useCallback(() => {
    if (viewMode === 'month') {
      setFocusDate(startOfMonth(focusDate));
      setViewMode('week');
    } else {
      setViewMode('month');
    }
  }, [viewMode, focusDate]);

  const resetToToday = useCallback(() => {
    const today = new Date();
    setFocusDate(today);
    setBaseDate(today);
  }, []);

  const weekStart = startOfWeek(focusDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 0 });
  const title = useMemo(() => {
    return viewMode === 'month'
      ? format(focusDate, 'MMMM yyyy')
      : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  }, [viewMode, focusDate, weekStart, weekEnd]);

  // The index that focusDate maps to. Combined with Embla's active index
  // below, this covers both the currently-animating slide and any
  // programmatic scroll target (which can momentarily diverge during a
  // resetToToday jump).
  const focusIndex = useMemo(() => {
    const offset =
      viewMode === 'month'
        ? differenceInCalendarMonths(focusDate, baseDate)
        : differenceInCalendarWeeks(focusDate, baseDate);
    const raw = CENTER_INDEX + offset;
    return Math.max(0, Math.min(TOTAL_SLIDES - 1, raw));
  }, [focusDate, baseDate, viewMode]);

  const settledRenderWindow =
    isActive && isPrewarmed ? RAPID_RENDER_WINDOW : INITIAL_RENDER_WINDOW;

  // Never let rapid repeated selections outrun mounted content. Keep the
  // settled/prewarmed window in place for smoothness, but extend only the
  // selected edge by one neighbor as focusDate advances. That preserves a real
  // next slide for another immediate swipe without shifting/unmounting the
  // settled grids until Embla actually settles.
  const renderStart = Math.max(
    0,
    Math.min(
      emblaActiveIndex - settledRenderWindow,
      focusIndex - INITIAL_RENDER_WINDOW
    )
  );
  const renderEnd = Math.min(
    TOTAL_SLIDES - 1,
    Math.max(
      emblaActiveIndex + settledRenderWindow,
      focusIndex + INITIAL_RENDER_WINDOW
    )
  );

  return {
    viewMode,
    focusDate,
    slides,
    renderStart,
    renderEnd,
    emblaRef,
    title,
    handlePrev,
    handleNext,
    handleToggle,
    resetToToday,
  };
}
