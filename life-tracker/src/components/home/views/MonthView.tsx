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

const WEEKDAY_LABELS = [
  ['Sun', 'Sunday'],
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
] as const;

export const MonthView: React.FC<MonthViewProps> = ({
  focusDate,
  onDayClick,
  tasksByDate,
  categoriesMap,
}) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(focusDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [focusDate]);

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let index = 0; index < calendarDays.length; index += 7) {
      weeks.push(calendarDays.slice(index, index + 7));
    }
    return weeks;
  }, [calendarDays]);

  return (
    <div
      className="flex flex-col min-h-full"
      role="grid"
      aria-label={`${format(focusDate, 'MMMM yyyy')} calendar`}
    >
      <div className="grid grid-cols-7 gap-1 px-2 mb-1" role="row">
        {WEEKDAY_LABELS.map(([shortLabel, fullLabel]) => (
          <div
            key={shortLabel}
            role="columnheader"
            aria-label={fullLabel}
            className="text-center text-[10px] font-medium text-gray-400 py-1"
          >
            {shortLabel}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1 px-2 auto-rows-max"
        role="rowgroup"
      >
        {calendarWeeks.map((week) => (
          <div
            key={format(week[0], 'yyyy-MM-dd')}
            role="row"
            className="col-span-7 grid grid-cols-7 gap-1"
          >
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              return (
                <div
                  key={dateStr}
                  role="gridcell"
                  className="min-w-0 min-h-0 h-full"
                >
                  <DayCell
                    date={day}
                    tasks={tasksByDate.get(dateStr) ?? EMPTY_TASKS}
                    categories={categoriesMap}
                    isCurrentMonth={isSameMonth(day, focusDate)}
                    onDayClick={onDayClick}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
