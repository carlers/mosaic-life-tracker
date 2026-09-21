import React from 'react';
import { CalendarSlide } from './CalendarSlide';
import type { TaskDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';

interface CalendarCarouselProps {
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
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
}) => {
  const stopParentCarouselGesture = (event: React.PointerEvent) => {
    // Calendar owns horizontal gestures inside its viewport. Without this,
    // the parent friend Swiper can also receive the same pointer stream and
    // change friends instead of dates.
    event.stopPropagation();
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain py-2"
      ref={emblaRef}
      onPointerDownCapture={stopParentCarouselGesture}
      onTouchStartCapture={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-full items-start">
        {slides.map((date, i) => {
          const inWindow = i >= renderStart && i <= renderEnd;
          return (
            <div
              key={date.toISOString()}
              style={{
                flex: '0 0 100%',
                minWidth: 0,
                minHeight: '100%',
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
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CalendarCarousel = React.memo(CalendarCarouselComponent);
CalendarCarousel.displayName = 'CalendarCarousel';
