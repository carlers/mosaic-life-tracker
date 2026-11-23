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
// On desktop trackpads, the native rail may still be offset after Embla
// commits one month and before the next visual gesture/re-render. Keep the
// third neighbor prepared so a fast or repeated fling never exposes an empty
// month during that handoff. Mobile/coarse pointer retains the smaller range.
// Native input feature detection stays in the lazy trackpad module so this
// startup path does not spend the Home bundle's strict gzip headroom.
const RENDER_WINDOW = globalThis.matchMedia?.('(any-pointer: fine)').matches ? 3 : 1;
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
  // A full MonthView may contain hundreds of task previews. The immediately
  // adjacent month is already prepared; do not mount the *next offscreen*
  // month while a physical pointer swipe is tracking or settling.
  const [renderAnchor, setRenderAnchor] = useState(() => ({
    base: baseDate, mode: viewMode, index: CENTER_INDEX,
  }));
  const renderAnchorRef = useRef(renderAnchor);
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

  // A full populated MonthView is expensive. Keep selected React state and
  // newly entering offscreen grids unchanged while Embla tracks the mouse or
  // finger. The already-mounted destination remains continuously paintable.
  // Wheel/trackpad and keyboard still publish selection immediately.
  useEffect(() => {
    if (!emblaApi) return;
    let gesturePending = false;
    let pointerDown = false;
    let flushFallback: number | undefined;
    const clearFallback = () => window.clearTimeout(flushFallback);
    const commitAnchor = (index: number) => {
      const current = renderAnchorRef.current;
      if (current.index === index && current.base === baseDate && current.mode === viewMode) return;
      const next = { base: baseDate, mode: viewMode, index };
      renderAnchorRef.current = next;
      setRenderAnchor(next);
    };
    const syncFocus = (index: number) => {
      const nextDate = (viewMode === 'month' ? addMonths : addWeeks)(baseDate, index - CENTER_INDEX);
      setFocusDate(current => {
        const same = viewMode === 'month'
          ? differenceInCalendarMonths(nextDate, current) === 0
          : differenceInCalendarWeeks(nextDate, current) === 0;
        if (same) return current;
        return nextDate;
      });
    };
    const publishSelection = (index: number) => {
      setEmblaActiveIndex(index);
      syncFocus(index);
      commitAnchor(index);
    };
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      // Long drags can cross a previously prepared edge; hydrate it urgently.
      if (gesturePending && Math.abs(index - renderAnchorRef.current.index) <= RENDER_WINDOW) return;
      publishSelection(index);
    };
    const onPointerDown = () => {
      clearFallback();
      if (gesturePending) publishSelection(emblaApi.selectedScrollSnap());
      pointerDown = true;
      gesturePending = true;
    };
    const onSettle = () => {
      if (pointerDown) return;
      clearFallback();
      gesturePending = false;
      publishSelection(emblaApi.selectedScrollSnap());
    };
    const onPointerUp = () => {
      pointerDown = false;
      clearFallback();
      // Release even if Embla never emits settle (canceled or interrupted).
      flushFallback = window.setTimeout(onSettle, 520);
    };
    // Initial state already matches Embla's configured CENTER_INDEX.
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    emblaApi.on('select', onSelect);
    emblaApi.on('settle', onSettle);
    emblaApi.on('reInit', onSettle);
    return () => {
      clearFallback();
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
      emblaApi.off('select', onSelect);
      emblaApi.off('settle', onSettle);
      emblaApi.off('reInit', onSettle);
    };
  }, [emblaApi, baseDate, viewMode]);

  useEffect(() => {
    if (emblaApi && emblaApi.selectedScrollSnap() !== focusIndex)
      emblaApi.scrollTo(focusIndex, true);
  }, [emblaApi, focusIndex]);

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


  // Reset/rebase and view-mode switches use the new focused period in the
  // same render; normal Embla selection follows the settled/prepared anchor.
  const renderCenter = renderAnchor.base === baseDate && renderAnchor.mode === viewMode
    ? renderAnchor.index
    : focusIndex;
  const renderStart = Math.max(0, renderCenter - RENDER_WINDOW);
  const renderEnd = Math.min(TOTAL_SLIDES - 1, renderCenter + RENDER_WINDOW);

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
