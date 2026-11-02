import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { CalendarSlide } from './CalendarSlide';
import { calendarPinchMorphFrame, playCalendarPinchMorph, useCalendarPinchZoom } from './useCalendarPinchZoom';
import { nearestZoomSnap } from '../../../lib/calendarZoomPhysics';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../../lib/motionPreferences';
import type { TaskDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn, CalendarZoomDays, CalendarTaskPreviewLimit } from '../../../lib/preferences';
import type { HolidayOccurrence } from '../../../lib/holidays';

interface CalendarCarouselProps {
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  viewMode: CalendarViewMode;
  zoomDays?: CalendarZoomDays;
  taskPreviewLimit?: CalendarTaskPreviewLimit | 0;
  pinchEnabled?: boolean;
  onPinchChange?: (days: CalendarZoomDays) => void;
  stickyWeekdayHeader?: boolean;
  activeIndex?: number;
  isZoomTransitioning?: boolean;
  onZoomNavigate?: (direction: 'prev' | 'next') => boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onDayClick: (date: Date) => void;
  keyboardFocusDay?: string;
  keyboardEnabled?: boolean;
  tasksByDate: Map<string, TaskDocument[]>;
  sharedByDay?: ReadonlyMap<string, SharedTaskItem[]>;
  ownedSharedTaskIds?: ReadonlySet<string>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
  holidaysByDate?: ReadonlyMap<string, readonly HolidayOccurrence[]>;
}

const CalendarCarouselComponent: React.FC<CalendarCarouselProps> = ({
  slides,
  renderStart,
  renderEnd,
  emblaRef,
  viewMode,
  zoomDays = 7,
  taskPreviewLimit = 'unlimited',
  pinchEnabled = false,
  onPinchChange,
  stickyWeekdayHeader = false,
  activeIndex = 30,
  isZoomTransitioning = false,
  onZoomNavigate,
  onPrev,
  onNext,
  onDayClick,
  keyboardFocusDay,
  keyboardEnabled = false,
  tasksByDate,
  sharedByDay,
  ownedSharedTaskIds,
  categoriesMap,
  weekStartsOn = 0,
  holidaysByDate,
}) => {
  const viewportRef = useRef<HTMLElement | null>(null);
  const appearance = useContext(AppearanceContext);
  const reduceMotion = appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion();
  const pendingMorphRef = useRef<{
    fromDays: CalendarZoomDays;
    toDays: CalendarZoomDays;
    anchorWeekday: number;
    centerFraction: number;
    activeIndex: number;
    viewMode: CalendarViewMode;
  } | null>(null);
  const morphAnimationRef = useRef<Animation | null>(null);
  // Preserve a logical weekday offset across adjacent months/weeks and 3↔4
  // changes. No React state updates during high-frequency native scrolling.
  const weekdayOffsetRef = useRef(0);
  const transitionLockRef = useRef(false);
  const handleEmblaRef = useCallback((node: HTMLElement | null) => {
    viewportRef.current = node;
    emblaRef(node);
  }, [emblaRef]);

  // The outer Home height can be larger than the visible area when an
  // ancestor resolves a percentage height past the fixed bottom navigation.
  // Clamp the *native slide scroll viewport* to the measured unobstructed
  // region. Otherwise a slide may have scrollHeight === clientHeight while
  // the last calendar weeks are hidden behind the navigation bar.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const navigation = document.querySelector<HTMLElement>('nav[aria-label="Main"]');
    if (!navigation) return;

    const clampToVisibleHeight = () => {
      const navTop = navigation.getBoundingClientRect().top;
      const viewportTop = viewport.getBoundingClientRect().top;
      const available = Math.max(0, Math.floor(navTop - viewportTop));
      const limit = `${available}px`;
      if (viewport.style.maxHeight !== limit) viewport.style.maxHeight = limit;
    };

    clampToVisibleHeight();
    const frame = window.requestAnimationFrame(clampToVisibleHeight);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(clampToVisibleHeight)
      : null;
    if (viewport.parentElement) observer?.observe(viewport.parentElement);
    observer?.observe(navigation);
    window.addEventListener('resize', clampToVisibleHeight);
    window.visualViewport?.addEventListener('resize', clampToVisibleHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', clampToVisibleHeight);
      window.visualViewport?.removeEventListener('resize', clampToVisibleHeight);
      viewport.style.maxHeight = '';
    };
  }, [activeIndex, viewMode]);

  const handleZoomMount = useCallback((node: HTMLDivElement, days: number) => {
    const max = Math.max(0, node.scrollWidth - node.clientWidth);
    const offset = Math.min(7 - days, weekdayOffsetRef.current);
    node.scrollLeft = max * offset / (7 - days);
  }, []);
  const handleZoomScroll = useCallback((node: HTMLDivElement, days: number) => {
    // The outgoing month still emits scroll/snap events while Embla animates.
    // Never let those events rewrite the incoming month's starting position.
    if (transitionLockRef.current || isZoomTransitioning || !node.clientWidth) return;
    const slide = node.closest<HTMLElement>('[data-calendar-slide-index]');
    if (Number(slide?.dataset.calendarSlideIndex) !== activeIndex) return;
    weekdayOffsetRef.current = Math.min(7 - days,
      Math.max(0, node.scrollLeft * days / node.clientWidth));
  }, [activeIndex, isZoomTransitioning]);

  // Pre-mounted adjacent month/week slides are aligned only when the
  // carousel's render window changes, never while a finger is panning.
  useLayoutEffect(() => {
    if (zoomDays === 7 || isZoomTransitioning) return;
    // Align mounted neighbors only after the Embla 'settle' event, never
    // during the outgoing month animation.
    viewportRef.current?.querySelectorAll<HTMLDivElement>('[data-calendar-zoom-lane]').forEach((node) => {
      const days = Number(node.dataset.zoomDays || zoomDays);
      const target = Math.min(7 - days, weekdayOffsetRef.current) * node.clientWidth / days;
      if (Math.abs(node.scrollLeft - target) > 1) node.scrollLeft = target;
    });
    transitionLockRef.current = false;
  }, [activeIndex, isZoomTransitioning, renderStart, renderEnd, viewMode, zoomDays]);

  const handlePinch = useCallback((days: CalendarZoomDays, centerFraction: number) => {
    if (days === zoomDays || !onPinchChange) return;
    const center = Math.max(0, Math.min(1, centerFraction));
    const anchor = (zoomDays === 7 ? 0 : weekdayOffsetRef.current) + center * zoomDays;
    // A settled legal daily snap prevents a second horizontal jump after the morph.
    weekdayOffsetRef.current = nearestZoomSnap(anchor - center * days, days);
    pendingMorphRef.current = {
      fromDays: zoomDays, toDays: days, anchorWeekday: anchor,
      centerFraction: center, activeIndex, viewMode,
    };
    onPinchChange(days);
  }, [activeIndex, onPinchChange, viewMode, zoomDays]);

  // Run only for a completed pinch, not settings hydration, month movement, or resize.
  // React has already committed the destination grid and its native scroll offset.
  useLayoutEffect(() => {
    const pending = pendingMorphRef.current;
    if (!pending || pending.toDays !== zoomDays) return;
    pendingMorphRef.current = null;
    morphAnimationRef.current?.cancel();
    morphAnimationRef.current = null;
    if (!pinchEnabled || reduceMotion ||
      pending.activeIndex !== activeIndex || pending.viewMode !== viewMode) return;
    const slide = viewportRef.current?.querySelector<HTMLElement>(
      `[data-calendar-slide-index="${activeIndex}"]`
    );
    if (!slide) return;
    const lane = slide.querySelector<HTMLDivElement>('[data-calendar-zoom-lane]');
    const track = (lane?.firstElementChild as HTMLElement | null) ??
      slide.querySelector<HTMLElement>('[role="grid"]');
    if (!track) return;
    const frame = calendarPinchMorphFrame({
      fromDays: pending.fromDays,
      anchorWeekday: pending.anchorWeekday,
      centerFraction: pending.centerFraction,
      viewportWidth: lane?.clientWidth ?? slide.clientWidth,
      trackWidth: track.getBoundingClientRect().width,
      scrollLeft: lane?.scrollLeft ?? 0,
    });
    if (!frame) return;
    // Avoid triggering the existing native idle snap during the visual morph.
    if (lane) lane.dataset.calendarPinchMorph = 'true';
    const animation = playCalendarPinchMorph(track, frame);
    if (!animation) {
      if (lane) delete lane.dataset.calendarPinchMorph;
      return;
    }
    morphAnimationRef.current = animation;
    const finish = () => {
      if (lane) delete lane.dataset.calendarPinchMorph;
      if (morphAnimationRef.current === animation) morphAnimationRef.current = null;
    };
    animation.addEventListener('finish', finish, { once: true });
    animation.addEventListener('cancel', finish, { once: true });
    // Sticky weekday headings have their own scroll-synced transform.
    // Fade them in rather than overriding that transform and breaking alignment.
    slide.querySelector<HTMLElement>('[data-sticky-weekday-header]')?.animate?.(
      [{ opacity: 0.65 }, { opacity: 1 }],
      { duration: 180, easing: 'ease-out' }
    );
  }, [activeIndex, pinchEnabled, reduceMotion, viewMode, zoomDays]);

  useEffect(() => () => {
    morphAnimationRef.current?.cancel();
    morphAnimationRef.current = null;
    pendingMorphRef.current = null;
  }, [activeIndex, viewMode]);
  useCalendarPinchZoom(viewportRef, {
    enabled: pinchEnabled && Boolean(onPinchChange),
    activeIndex, zoomDays, locked: isZoomTransitioning, onChange: handlePinch,
  });

  const handleZoomNavigate = useCallback((direction: 'prev' | 'next') => {
    if (transitionLockRef.current || isZoomTransitioning) return;
    transitionLockRef.current = true;
    const before = weekdayOffsetRef.current;
    // A forward edge swipe shows the next month from its first weekday.
    // A backward swipe presents the preceding month from its last weekday.
    const targetOffset = direction === 'next' ? 0 : 7 - zoomDays;
    weekdayOffsetRef.current = targetOffset;
    const destination = activeIndex + (direction === 'next' ? 1 : -1);
    const targetLane = viewportRef.current?.querySelector<HTMLDivElement>(
      `[data-calendar-slide-index="${destination}"] [data-calendar-zoom-lane]`
    );
    if (targetLane?.clientWidth) targetLane.scrollLeft = targetOffset * targetLane.clientWidth / zoomDays;
    let accepted = true;
    if (onZoomNavigate) accepted = onZoomNavigate(direction);
    else if (direction === 'next') onNext?.();
    else onPrev?.();
    if (!accepted) {
      weekdayOffsetRef.current = before;
      transitionLockRef.current = false;
    }
  }, [activeIndex, isZoomTransitioning, onNext, onPrev, onZoomNavigate, zoomDays]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden py-2">
      <div
        className="swiper-no-swiping min-h-0 min-w-0 flex-1 overflow-clip"
        data-route-swipe-horizontal-owner="true"
        ref={handleEmblaRef}
      >
        <div className="flex h-full min-h-full items-start will-change-transform">
          {slides.map((date, i) => {
            const inWindow = i >= renderStart && i <= renderEnd;
            // Neighboring dates are prepared for horizontal swipes, but only
            // the visible period can own keyboard and vertical scrolling.
            const scrollActive = inWindow && i === activeIndex;
            return (
              <div
                key={date.toISOString()}
                data-calendar-slide-index={i}
                role={scrollActive ? 'region' : undefined}
                aria-label={scrollActive ? `${viewMode === 'month' ? 'Month' : 'Week'} calendar scroll` : undefined}
                tabIndex={scrollActive ? 0 : undefined}
                className={`h-full min-h-0 overflow-x-hidden [scrollbar-gutter:stable] ${
                  scrollActive ? 'overflow-y-scroll' : 'overflow-y-hidden'
                }`}
                style={{
                  flex: '0 0 100%',
                  minWidth: 0,
                  touchAction: zoomDays === 7 ? 'pan-y' : 'auto',
                }}
              >
                {inWindow && (
                  <CalendarSlide
                    date={date}
                    viewMode={viewMode}
                    zoomDays={zoomDays}
                    taskPreviewLimit={taskPreviewLimit}
                    stickyWeekdayHeader={stickyWeekdayHeader}
                    onZoomMount={handleZoomMount}
                    onZoomScroll={handleZoomScroll}
                    onZoomNavigate={handleZoomNavigate}
                    navigationLocked={isZoomTransitioning}
                    onDayClick={onDayClick}
                    keyboardActive={keyboardEnabled && i === activeIndex}
                    keyboardFocusDay={keyboardFocusDay}
                    tasksByDate={tasksByDate}
                    sharedByDay={sharedByDay}
                    ownedSharedTaskIds={ownedSharedTaskIds}
                    categoriesMap={categoriesMap}
                    weekStartsOn={weekStartsOn}
                    holidaysByDate={holidaysByDate}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const CalendarCarousel = React.memo(CalendarCarouselComponent);
CalendarCarousel.displayName = 'CalendarCarousel';
