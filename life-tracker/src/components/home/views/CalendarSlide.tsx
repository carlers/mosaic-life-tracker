import React from 'react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import type { TaskDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
}

const CalendarSlideComponent: React.FC<CalendarSlideProps> = ({
  date,
  viewMode,
  onDayClick,
  tasksByDate,
  categoriesMap,
  weekStartsOn = 0,
}) => {
  if (viewMode === 'month') {
    return (
      <MonthView
        focusDate={date}
        onDayClick={onDayClick}
        tasksByDate={tasksByDate}
        categoriesMap={categoriesMap}
        weekStartsOn={weekStartsOn}
      />
    );
  }
  return (
    <WeekView
      focusDate={date}
      onDayClick={onDayClick}
      tasksByDate={tasksByDate}
      categoriesMap={categoriesMap}
      weekStartsOn={weekStartsOn}
    />
  );
};

export const CalendarSlide = React.memo(CalendarSlideComponent);
CalendarSlide.displayName = 'CalendarSlide';
