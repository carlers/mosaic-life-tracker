import React from 'react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import type { TaskDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
}

const CalendarSlideComponent: React.FC<CalendarSlideProps> = ({
  date,
  viewMode,
  onDayClick,
  tasksByDate,
  categoriesMap,
}) => {
  if (viewMode === 'month') {
    return (
      <MonthView
        focusDate={date}
        onDayClick={onDayClick}
        tasksByDate={tasksByDate}
        categoriesMap={categoriesMap}
      />
    );
  }
  return (
    <WeekView
      focusDate={date}
      onDayClick={onDayClick}
      tasksByDate={tasksByDate}
      categoriesMap={categoriesMap}
    />
  );
};

export const CalendarSlide = React.memo(CalendarSlideComponent);
CalendarSlide.displayName = 'CalendarSlide';
