import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from 'date-fns';
import { DayCell } from './DayCell';
import type { TaskDocument } from '../../../db/schema';

interface MonthViewProps {
  focusDate: Date;
  onDayClick?: (date: Date) => void;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
}

export const MonthView: React.FC<MonthViewProps> = ({ focusDate, onDayClick, tasks, categoriesMap }) => {
  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getTasksForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return tasks.filter((task: TaskDocument) => task.date === dateStr);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 gap-1 px-2 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-2 flex-1 auto-rows-fr">
        {calendarDays.map((day, index) => (
          <DayCell
            key={index}
            date={day}
            tasks={getTasksForDay(day)}
            categories={categoriesMap}
            isCurrentMonth={isSameMonth(day, focusDate)}
            onClick={onDayClick ? () => onDayClick(day) : undefined}
          />
        ))}
      </div>
    </div>
  );
};