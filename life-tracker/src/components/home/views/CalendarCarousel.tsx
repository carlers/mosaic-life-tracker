import React, { useRef } from 'react';
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
  const gestureStartedInsideCalendar = useRef(false);

  const handlePointerDown = (event: React.PointerEvent) => {
    gestureStartedInsideCalendar.current = true;
    event.stopPropagation();
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!gestureStartedInsideCalendar.current) return;
    event.stopPropagation();
  };

  const handlePointerUp = () => {
    gestureStartedInsideCalendar.current = false;
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain py-2"
      ref={emblaRef}
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
      onPointerCancelCapture={handlePointerUp}
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
