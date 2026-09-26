import React from 'react';
import { CalendarSlide } from './CalendarSlide';
import type { TaskDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';

interface CalendarCarouselProps {
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
}

const CalendarCarouselComponent: React.FC<CalendarCarouselProps> = ({
  slides,
  renderStart,
  renderEnd,
  emblaRef,
  viewMode,
  onDayClick,
  tasksByDate,
  categoriesMap,
  weekStartsOn = 0,
}) => {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden py-2">
      <div
        className="swiper-no-swiping min-h-0 min-w-0 flex-1 overflow-hidden"
        ref={emblaRef}
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
                  touchAction: 'pan-y',
                }}
              >
                {inWindow && (
                  <CalendarSlide
                    date={date}
                    viewMode={viewMode}
                    onDayClick={onDayClick}
                    tasksByDate={tasksByDate}
                    categoriesMap={categoriesMap}
                    weekStartsOn={weekStartsOn}
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
