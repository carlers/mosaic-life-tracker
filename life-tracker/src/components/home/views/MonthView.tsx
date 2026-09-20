import React, { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import { DayCell } from './DayCell';
import { EMPTY_TASKS } from '../../../constants/empty';
import type { TaskDocument } from '../../../db/schema';

interface MonthViewProps {
  focusDate: Date;
  onDayClick?: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
}

export const MonthView: React.FC<MonthViewProps> = ({
  focusDate,
  onDayClick,
  tasksByDate,
  categoriesMap,
}) => {
  // Memoized on `focusDate` so the array of Date objects (and therefore
  // the `date` prop to every DayCell) stays referentially stable across
  // renders. Without this, eachDayOfInterval would return new Date
  // objects every render and DayCell's React.memo would never bail out.
  // `focusDate` itself is stable per slide — it comes from the memoized
  // `slides` array in useCalendarState / FriendCalendarView.
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(focusDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [focusDate]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col min-h-full">
      <div
        className="grid grid-cols-7 gap-1 px-2 mb-1"
        aria-hidden="true"
      >
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 px-2 flex-1 auto-rows-[minmax(min-content,1fr)]">
        {calendarDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <DayCell
              key={dateStr}
              date={day}
              tasks={tasksByDate.get(dateStr) ?? EMPTY_TASKS}
              categories={categoriesMap}
              isCurrentMonth={isSameMonth(day, focusDate)}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
};
