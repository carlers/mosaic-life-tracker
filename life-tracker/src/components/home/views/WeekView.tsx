import React, { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { DayCell } from './DayCell';
import { EMPTY_TASKS } from '../../../constants/empty';
import type { TaskDocument } from '../../../db/schema';
import type { WeekStartsOn } from '../../../lib/preferences';

interface WeekViewProps {
  focusDate: Date;
  onDayClick?: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
}

export const WeekView: React.FC<WeekViewProps> = ({
  focusDate,
  onDayClick,
  tasksByDate,
  categoriesMap,
  weekStartsOn = 0,
}) => {
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(focusDate, { weekStartsOn });
    const weekEnd = endOfWeek(focusDate, { weekStartsOn });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [focusDate, weekStartsOn]);

  return (
    <div
      className="flex flex-col min-h-full"
      role="grid"
      aria-label={`Week of ${format(weekDays[0], 'MMMM d, yyyy')}`}
    >
      <div className="grid grid-cols-7 gap-1 px-2 mb-1" role="row">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            role="columnheader"
            aria-label={format(day, 'EEEE')}
            className="text-center text-[10px] font-medium text-gray-400 py-1"
          >
            {format(day, 'EEE')}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1 px-2 auto-rows-max"
        role="rowgroup"
      >
        <div role="row" className="col-span-7 grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
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
                  isCurrentMonth
                  onDayClick={onDayClick}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
