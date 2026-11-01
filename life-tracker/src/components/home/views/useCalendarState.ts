import { useState, useRef, useEffect, useMemo, useCallback, useContext } from 'react';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../../../lib/featureControls';
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
let cachedPanelSnap: typeof import('./calendarPanelSnap').updateFocusedCalendarSlide | undefined;

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
  resnapAfterResize: (live?: boolean) => void | Promise<void>;
  title: string;
  handlePrev: () => void;
  handleNext: () => void;
  handleToggle: () => void;
  resetToToday: () => void;
}

export function useCalendarState(
  { weekStartsOn = 0 }: { weekStartsOn?: WeekStartsOn } = {}
): CalendarState {
  const appearance = useContext(AppearanceContext);
  const reduceMotion = Boolean(appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion());
  const weekViewEnabled = useFeatureEnabled('mosaic_disable_calendar_week_view');
  const [selectedViewMode, setViewMode] = useState<CalendarViewMode>('month');
  // A remote pause is only a presentation override; retain the selected mode.
  const viewMode = weekViewEnabled ? selectedViewMode : 'month';
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());
  const [emblaActiveIndex, setEmblaActiveIndex] = useState(CENTER_INDEX);
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
    // The inspector projects the focused month during its own width animation.
    // Embla's default ResizeObserver reInit on every width frame would fight it.
    watchResize: api => !api.rootNode().dataset.panelMotion,
  });

  useEmblaTrackpadNavigation(emblaApi);

  // Focused month, not Embla's transient selected snap, is the authority when
  // the left inspector shifts the viewport. Never chase a half-settled slide.
  const focusIndex = useMemo(() => {
    const offset =
      viewMode === 'month'
        ? differenceInCalendarMonths(focusDate, baseDate)
        : differenceInCalendarWeeks(focusDate, baseDate, { weekStartsOn });
    const raw = CENTER_INDEX + offset;
    return Math.max(0, Math.min(TOTAL_SLIDES - 1, raw));
  }, [focusDate, baseDate, viewMode, weekStartsOn]);

  // After an inspector resizes from the left, Embla can retain a track offset
  // exactly equal to the space taken by the inspector even when the selected
  // snap index is correct. Align the existing engine's location with the real
  // focused slide rather than remounting a 61-slide calendar.
  const resnapAfterResize = useCallback((live = false) => {
    if (!emblaApi) return;
    return cachedPanelSnap
      ? cachedPanelSnap(emblaApi, focusIndex, live)
      : import('./calendarPanelSnap').then(m =>
        (cachedPanelSnap = m.updateFocusedCalendarSlide)(emblaApi, focusIndex, live));
  }, [emblaApi, focusIndex]);

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
    if (!emblaApi || zoomNavigationLock.current ||
      (direction === 'next' ? !emblaApi.canScrollNext() : !emblaApi.canScrollPrev())) return false;
    zoomNavigationLock.current = true;
    setIsZoomTransitioning(true);
    if (direction === 'next') emblaApi.scrollNext();
    else emblaApi.scrollPrev();
    return true;
  }, [emblaApi]);

  // Keep the active render window aligned to settled snaps. The active slide
  // already has both immediate neighbors mounted, so a one-step drag never
  // needs React state work on Embla's high-frequency `scroll` event.
  useEffect(() => {
    if (!emblaApi) return;
    const syncSelectedIndex = () => {
      const index = emblaApi.selectedScrollSnap();
      setEmblaActiveIndex(index);
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
    if (emblaApi.selectedScrollSnap() !== focusIndex) {
      emblaApi.scrollTo(focusIndex, true);
    }
  }, [emblaApi, focusIndex]);

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
    emblaApi?.scrollPrev();
  }, [emblaApi]);
  const handleNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const handleToggle = useCallback(() => {
    if (!isFeatureEnabled('mosaic_disable_calendar_week_view')) return;
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

  // Week boundaries only matter in week view. A month render need not
  // recalculate or memoize dates that its heading does not display.
  const title = viewMode === 'month'
    ? format(focusDate, 'MMMM yyyy')
    : `${format(startOfWeek(focusDate, { weekStartsOn }), 'MMM d')} - ${format(endOfWeek(focusDate, { weekStartsOn }), 'MMM d, yyyy')}`;

  // The index that focusDate maps to. Combined with Embla's active index
  // below, this covers both the currently-animating slide and any
  // programmatic scroll target (which can momentarily diverge during a
  // resetToToday jump).


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
    activeIndex: emblaActiveIndex,
    isZoomTransitioning,
    handleZoomNavigate,
    emblaRef,
    resnapAfterResize,
    title,
    handlePrev,
    handleNext,
    handleToggle,
    resetToToday,
  };
}
