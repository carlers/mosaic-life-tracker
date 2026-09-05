import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from 'date-fns';
import { DayCell } from './DayCell';
import { generateMockTasks, mockCategories } from '../../../lib/mockData';
import type { TaskDocument } from '../../../db/schema';

interface MonthViewProps {
  focusDate: Date;
  onDayClick?: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({ focusDate, onDayClick }) => {
  const [tasks] = React.useState<TaskDocument[]>(generateMockTasks());

  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getTasksForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return tasks.filter(task => task.date === dateStr);
  };

  return (
    <div className="flex flex-col h-full">
      {/* FIX: Standardized header spacing */}
      <div className="grid grid-cols-7 gap-1 px-2 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 px-2 flex-1 auto-rows-fr">
        {calendarDays.map((day, index) => (
          <DayCell
            key={index}
            date={day}
            tasks={getTasksForDay(day)}
            categories={mockCategories}
            isCurrentMonth={isSameMonth(day, focusDate)}
            onClick={onDayClick ? () => onDayClick(day) : undefined}
          />
        ))}
      </div>
    </div>
  );
};