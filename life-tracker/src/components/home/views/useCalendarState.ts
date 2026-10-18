import { useState, useRef, useEffect, useMemo, useCallback, useContext, startTransition } from 'react';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../../lib/motionPreferences';
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
import { useEmblaTrackpadNavigation } from '../../../hooks/useEmblaTrackpadNavigation';
import type { WeekStartsOn } from '../../../lib/preferences';

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
  activeIndex: number;
  isZoomTransitioning: boolean;
  handleZoomNavigate: (direction: 'prev' | 'next') => boolean;
  emblaRef: (node: HTMLElement | null) => void;
  title: string;
  handlePrev: () => void;
  handleNext: () => void;
  handleToggle: () => void;
  resetToToday: () => void;
  prepareAdjacentSlides: () => void;
}

export function useCalendarState(
  { weekStartsOn = 0, deferNeighbors = false, ownerDataReady = true }:
  { weekStartsOn?: WeekStartsOn; deferNeighbors?: boolean; ownerDataReady?: boolean } = {}
): CalendarState {
  const appearance = useContext(AppearanceContext);
  const reduceMotion = Boolean(appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());
  const [emblaActiveIndex, setEmblaActiveIndex] = useState(CENTER_INDEX);
  // Render the focused grid first; mount offscreen neighbors only after
  // cached owner data is ready and the focused grid has had a paint chance.
  // Navigation forces neighbors immediately to preserve first-swipe fidelity.
  const [neighborsReady, setNeighborsReady] = useState(!deferNeighbors);
  const prepareAdjacentSlides = useCallback(() => setNeighborsReady(true), []);
  useEffect(() => {
    if (!deferNeighbors || !ownerDataReady || neighborsReady) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        startTransition(() => setNeighborsReady(true));
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [deferNeighbors, ownerDataReady, neighborsReady]);
  const isInternalSwipeRef = useRef(false);
  const zoomNavigationLock = useRef(false);
  const [isZoomTransitioning, setIsZoomTransitioning] = useState(false);
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
    duration: reduceMotion ? 0 : 22,
    watchDrag: (_api, event) => !(event.target instanceof Element && event.target.closest('[data-calendar-zoom-lane]')),
  });

  useEmblaTrackpadNavigation(emblaApi);

  // Selection makes the destination slide ready; waiting for Embla's
  // physics-based 'settle' can keep zoomed month navigation locked for
  // hundreds of milliseconds after the next month has mounted. Yield input
  // ownership after two painted frames instead, so quick sequential swipes
  // retarget Embla without interacting with the outgoing weekday grid.
  useEffect(() => {
    if (!emblaApi) return;
    let frame: number | null = null;
    const cancelFrame = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };
    const release = () => {
      cancelFrame();
      zoomNavigationLock.current = false;
      setIsZoomTransitioning(false);
    };
    const begin = () => {
      setIsZoomTransitioning(true);
      cancelFrame();
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(release);
      });
    };
    emblaApi.on('select', begin);
    emblaApi.on('settle', release);
    emblaApi.on('reInit', release);
    return () => {
      cancelFrame();
      emblaApi.off('select', begin);
      emblaApi.off('settle', release);
      emblaApi.off('reInit', release);
    };
  }, [emblaApi]);

  const handleZoomNavigate = useCallback((direction: 'prev' | 'next'): boolean => {
    prepareAdjacentSlides();
    if (!emblaApi || zoomNavigationLock.current ||
      (direction === 'next' ? !emblaApi.canScrollNext() : !emblaApi.canScrollPrev())) return false;
    zoomNavigationLock.current = true;
    setIsZoomTransitioning(true);
    if (direction === 'next') emblaApi.scrollNext();
    else emblaApi.scrollPrev();
    return true;
  }, [emblaApi, prepareAdjacentSlides]);

  // Keep the active render window aligned to settled snaps. The active slide
  // already has both immediate neighbors mounted, so a one-step drag never
  // needs React state work on Embla's high-frequency `scroll` event.
  useEffect(() => {
    if (!emblaApi) return;
    const syncSelectedIndex = () => {
      const index = emblaApi.selectedScrollSnap();
      setEmblaActiveIndex((prev) => (prev === index ? prev : index));
    };
    syncSelectedIndex();
    emblaApi.on('select', syncSelectedIndex);
    emblaApi.on('reInit', syncSelectedIndex);
    return () => {
      emblaApi.off('select', syncSelectedIndex);
      emblaApi.off('reInit', syncSelectedIndex);
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
        : differenceInCalendarWeeks(focusDate, baseDate, { weekStartsOn });
    const targetIndex = CENTER_INDEX + offset;
    if (targetIndex < 0 || targetIndex >= TOTAL_SLIDES) return;
    if (emblaApi.selectedScrollSnap() !== targetIndex) {
      emblaApi.scrollTo(targetIndex, true);
    }
  }, [emblaApi, focusDate, baseDate, viewMode, weekStartsOn]);

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
    prepareAdjacentSlides();
    emblaApi?.scrollPrev();
  }, [emblaApi, prepareAdjacentSlides]);
  const handleNext = useCallback(() => {
    prepareAdjacentSlides();
    emblaApi?.scrollNext();
  }, [emblaApi, prepareAdjacentSlides]);

  const handleToggle = useCallback(() => {
    prepareAdjacentSlides();
    if (viewMode === 'month') {
      setFocusDate(startOfMonth(focusDate));
      setViewMode('week');
    } else {
      setViewMode('month');
    }
  }, [viewMode, focusDate, prepareAdjacentSlides]);

  const resetToToday = useCallback(() => {
    prepareAdjacentSlides();
    const today = new Date();
    setFocusDate(today);
    setBaseDate(today);
  }, [prepareAdjacentSlides]);

  const weekStart = startOfWeek(focusDate, { weekStartsOn });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn });
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
        : differenceInCalendarWeeks(focusDate, baseDate, { weekStartsOn });
    const raw = CENTER_INDEX + offset;
    return Math.max(0, Math.min(TOTAL_SLIDES - 1, raw));
  }, [focusDate, baseDate, viewMode, weekStartsOn]);

  const neighborRadius = neighborsReady ? RENDER_WINDOW : 0;
  const renderStart = Math.max(
    0,
    Math.min(emblaActiveIndex, focusIndex) - neighborRadius
  );
  const renderEnd = Math.min(
    TOTAL_SLIDES - 1,
    Math.max(emblaActiveIndex, focusIndex) + neighborRadius
  );

  return {
    viewMode,
    focusDate,
    slides,
    renderStart,
    renderEnd,
    activeIndex: emblaActiveIndex,
    isZoomTransitioning,
    handleZoomNavigate,
    emblaRef,
    title,
    handlePrev,
    handleNext,
    handleToggle,
    resetToToday,
    prepareAdjacentSlides,
  };
}
