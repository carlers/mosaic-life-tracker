import React, { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { DayCell } from './DayCell';
import type { TaskDocument } from '../../../db/schema';

const EMPTY_TASKS: TaskDocument[] = [];

interface WeekViewProps {
  focusDate: Date;
  onDayClick?: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
}

export const WeekView: React.FC<WeekViewProps> = ({
  focusDate,
  onDayClick,
  tasksByDate,
  categoriesMap,
}) => {
  // Memoized on `focusDate` — same rationale as MonthView: keeps the
  // Date array referentially stable so DayCell's React.memo can bail.
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(focusDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(focusDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [focusDate]);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 gap-1 px-2 mb-1">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="text-center text-[10px] font-medium text-gray-500 py-1"
          >
            {format(day, 'EEE')}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 px-2 flex-1 auto-rows-fr">
        {weekDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <DayCell
              key={dateStr}
              date={day}
              tasks={tasksByDate.get(dateStr) ?? EMPTY_TASKS}
              categories={categoriesMap}
              isCurrentMonth={true}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
};
