import React from 'react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import type { TaskDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';
import type { HolidayOccurrence } from '../../../lib/holidays';

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
  holidaysByDate?: ReadonlyMap<string, readonly HolidayOccurrence[]>;
}

const CalendarSlideComponent: React.FC<CalendarSlideProps> = ({
  date,
  viewMode,
  onDayClick,
  tasksByDate,
  categoriesMap,
  weekStartsOn = 0,
  holidaysByDate,
}) => {
  if (viewMode === 'month') {
    return (
      <MonthView
        focusDate={date}
        onDayClick={onDayClick}
        tasksByDate={tasksByDate}
        categoriesMap={categoriesMap}
        weekStartsOn={weekStartsOn}
        holidaysByDate={holidaysByDate}
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
