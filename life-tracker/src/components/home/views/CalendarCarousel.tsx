import React, { useCallback, useRef } from 'react';
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
    const max = Math.max(0, node.scrollWidth - node.clientWidth);
    if (max === 0) return;
    const weekdayOffset = Math.min(7 - days, Math.max(0, node.scrollLeft / max * (7 - days)));
    weekdayOffsetRef.current = weekdayOffset;
    viewportRef.current?.querySelectorAll<HTMLDivElement>('[data-calendar-zoom-lane]').forEach((other) => {
      if (other === node) return;
      const otherMax = Math.max(0, other.scrollWidth - other.clientWidth);
      const otherDays = Number(other.dataset.zoomDays || days);
      const target = otherMax * Math.min(7 - otherDays, weekdayOffset) / (7 - otherDays);
      if (Math.abs(other.scrollLeft - target) > 1) other.scrollLeft = target;
    });
  }, []);

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
                    onZoomMount={handleZoomMount}
                    onZoomScroll={handleZoomScroll}
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
