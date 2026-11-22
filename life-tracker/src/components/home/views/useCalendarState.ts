import { useState, useRef, useEffect, useMemo, useCallback, useContext, startTransition } from 'react';
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
  const lowPriorityAnchorRef = useRef(false);
  useEffect(() => { lowPriorityAnchorRef.current = false; }, [renderAnchor]);
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

  // Separately track selected index (header, keyboard, focus) and populated
  // slide window. Embla already has the destination grid mounted. Keeping the
  // window still during mouse/touch pointer travel avoids reconciling a full
  // entering month on the same frames needed for the drag. Wheel/trackpad and
  // programmatic navigation retain immediate hydration; another pointer drag
  // before settle synchronously prepares its next neighbor on pointerDown.
  useEffect(() => {
    if (!emblaApi) return;
    // These flags are owned exclusively by this Embla subscription lifetime.
    // React refs would add persistent state without any render consumers.
    let gesturePending = false;
    let pointerDown = false;
    let flushFallback: number | undefined;
    const clearFallback = () => window.clearTimeout(flushFallback);
    const commitAnchor = (index: number, lowPriority = false) => {
      const current = renderAnchorRef.current;
      if (!lowPriorityAnchorRef.current &&
          current.index === index && current.base === baseDate && current.mode === viewMode) return;
      const next = { base: baseDate, mode: viewMode, index };
      renderAnchorRef.current = next;
      if (lowPriority) {
        // A newly entering *offscreen* month is not needed to paint the
        // completed gesture. Let concurrent React yield to new input and
        // preserve an urgent follow-up drag's ability to take precedence.
        lowPriorityAnchorRef.current = true;
        startTransition(() => setRenderAnchor(next));
      } else {
        lowPriorityAnchorRef.current = false;
        setRenderAnchor(next);
      }
    };
    const syncSelectedIndex = () => {
      const index = emblaApi.selectedScrollSnap();
      setEmblaActiveIndex(index);
      if (!gesturePending || Math.abs(index - renderAnchorRef.current.index) > RENDER_WINDOW) {
        // Large physical drags are allowed to cross the prepared edge without
        // showing an empty destination; they are rare and hydrate immediately.
        commitAnchor(index);
      }
    };
    const onPointerDown = () => {
      clearFallback();
      const selected = emblaApi.selectedScrollSnap();
      // A second rapid drag must never start from an unprepared edge.
      if (gesturePending || lowPriorityAnchorRef.current) commitAnchor(selected);
      pointerDown = true;
      gesturePending = true;
    };
    const onPointerUp = () => {
      pointerDown = false;
      clearFallback();
      // A canceled drag may never emit settle. It still must prepare
      // neighbors once input is quiet and must never retain pending state.
      flushFallback = window.setTimeout(() => {
        gesturePending = false;
        commitAnchor(emblaApi.selectedScrollSnap(), true);
      }, 520);
    };
    const onSettle = () => {
      if (pointerDown) return;
      clearFallback();
      gesturePending = false;
      commitAnchor(emblaApi.selectedScrollSnap(), true);
    };
    syncSelectedIndex();
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    emblaApi.on('select', syncSelectedIndex);
    emblaApi.on('settle', onSettle);
    emblaApi.on('reInit', onSettle);
    return () => {
      clearFallback();
      pointerDown = false;
      gesturePending = false;
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
      emblaApi.off('select', syncSelectedIndex);
      emblaApi.off('settle', onSettle);
      emblaApi.off('reInit', onSettle);
    };
  }, [emblaApi, baseDate, viewMode]);

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
