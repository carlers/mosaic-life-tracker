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
const RENDER_WINDOW = 1;

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

export function useCalendarState(): CalendarState {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());
  const [emblaActiveIndex, setEmblaActiveIndex] = useState(CENTER_INDEX);
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

  // Keep the heavy render window pinned while Embla is animating to a snap.
  // The active slide already has both immediate neighbors mounted, so the
  // destination remains visible without mounting the next full calendar grid
  // during the compositor-owned settling animation.
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
    const onSettle = () => {
      const index = emblaApi.selectedScrollSnap();
      const offset = index - CENTER_INDEX;
      const fn = viewMode === 'month' ? addMonths : addWeeks;
      const newDate = fn(baseDate, offset);
      const same =
        viewMode === 'month'
          ? differenceInCalendarMonths(newDate, focusDate) === 0
          : differenceInCalendarWeeks(newDate, focusDate) === 0;
      if (!same) {
        isInternalSwipeRef.current = true;
        setFocusDate(newDate);
      }
    };
    emblaApi.on('settle', onSettle);
    return () => {
      emblaApi.off('settle', onSettle);
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

  const renderStart = Math.max(
    0,
    Math.min(emblaActiveIndex, focusIndex) - RENDER_WINDOW
  );
  const renderEnd = Math.min(
    TOTAL_SLIDES - 1,
    Math.max(emblaActiveIndex, focusIndex) + RENDER_WINDOW
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
