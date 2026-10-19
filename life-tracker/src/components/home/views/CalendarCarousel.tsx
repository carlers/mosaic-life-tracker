import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { CalendarSlide } from './CalendarSlide';
import type { TaskDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn, CalendarZoomDays } from '../../../lib/preferences';
import type { HolidayOccurrence } from '../../../lib/holidays';

interface CalendarCarouselProps {
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  viewMode: CalendarViewMode;
  zoomDays?: CalendarZoomDays;
  stickyWeekdayHeader?: boolean;
  activeIndex?: number;
  isZoomTransitioning?: boolean;
  onZoomNavigate?: (direction: 'prev' | 'next') => boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onDayClick: (date: Date) => void;
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
  stickyWeekdayHeader = false,
  activeIndex = 30,
  isZoomTransitioning = false,
  onZoomNavigate,
  onPrev,
  onNext,
  onDayClick,
  tasksByDate,
  sharedByDay,
  ownedSharedTaskIds,
  categoriesMap,
  weekStartsOn = 0,
  holidaysByDate,
}) => {
  const viewportRef = useRef<HTMLElement | null>(null);
  // Preserve a logical weekday offset across adjacent months/weeks and 3↔4
  // changes. No React state updates during high-frequency native scrolling.
  const weekdayOffsetRef = useRef(0);
  const transitionLockRef = useRef(false);
  const handleEmblaRef = useCallback((node: HTMLElement | null) => {
    viewportRef.current = node;
    emblaRef(node);
  }, [emblaRef]);

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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden py-2">
      <div
        className="swiper-no-swiping min-h-0 min-w-0 flex-1 overflow-hidden"
        data-route-swipe-horizontal-owner="true"
        ref={handleEmblaRef}
      >
        <div className="flex h-full min-h-full items-start will-change-transform">
          {slides.map((date, i) => {
            const inWindow = i >= renderStart && i <= renderEnd;
            return (
              <div
                key={date.toISOString()}
                data-calendar-slide-index={i}
                className={`h-full min-h-0 overflow-x-hidden ${
                  inWindow
                    ? 'overflow-y-scroll [scrollbar-gutter:stable]'
                    : 'overflow-y-hidden'
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
                    stickyWeekdayHeader={stickyWeekdayHeader}
                    onZoomMount={handleZoomMount}
                    onZoomScroll={handleZoomScroll}
                    onZoomNavigate={handleZoomNavigate}
                    navigationLocked={isZoomTransitioning}
                    onDayClick={onDayClick}
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
