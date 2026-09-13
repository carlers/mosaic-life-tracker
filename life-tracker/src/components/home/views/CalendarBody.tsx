import React, { useState, useCallback } from 'react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayViewSheet } from './DayViewSheet';
import { FriendDayViewSheet } from '../../friend/FriendDayViewSheet';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
}

const CalendarSlide = React.memo(
  ({ date, viewMode, onDayClick, tasks, categoriesMap }: CalendarSlideProps) => {
    if (viewMode === 'month') {
      return (
        <MonthView
          focusDate={date}
          onDayClick={onDayClick}
          tasks={tasks}
          categoriesMap={categoriesMap}
        />
      );
    }
    return (
      <WeekView
        focusDate={date}
        onDayClick={onDayClick}
        tasks={tasks}
        categoriesMap={categoriesMap}
      />
    );
  }
);
CalendarSlide.displayName = 'CalendarSlide';

interface CalendarBodyProps {
  viewMode: CalendarViewMode;
  slides: Date[];
  emblaRef: (node: HTMLElement | null) => void;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  variant: 'me' | 'friend';
  friendCategories?: CategoryDocument[];
  friendName?: string;
}

export const CalendarBody: React.FC<CalendarBodyProps> = ({
  viewMode,
  slides,
  emblaRef,
  tasks,
  categoriesMap,
  variant,
  friendCategories,
  friendName,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedDate(null);
  }, []);

  return (
    <>
      {/* min-h-0 lets this flex-1 child actually shrink so the calendar
          grid fills the remaining height instead of forcing overflow. */}
      <div
        className="flex-1 min-h-0 overflow-hidden py-2"
        ref={emblaRef}
      >
        <div className="flex h-full" style={{ touchAction: 'pan-y' }}>
          {slides.map((date, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-full w-full"
              style={{ flex: '0 0 100%', minWidth: 0 }}
            >
              <CalendarSlide
                date={date}
                viewMode={viewMode}
                onDayClick={handleDayClick}
                tasks={tasks}
                categoriesMap={categoriesMap}
              />
            </div>
          ))}
        </div>
      </div>

      {variant === 'me' ? (
        <DayViewSheet
          isOpen={!!selectedDate}
          onClose={handleCloseSheet}
          selectedDate={selectedDate || new Date()}
          onDateChange={setSelectedDate}
        />
      ) : (
        <FriendDayViewSheet
          isOpen={!!selectedDate}
          onClose={handleCloseSheet}
          date={selectedDate}
          tasks={tasks}
          categories={friendCategories || []}
          friendName={friendName || 'Friend'}
        />
      )}
    </>
  );
};