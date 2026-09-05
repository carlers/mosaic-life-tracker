import React from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { DayCell } from './DayCell';
import { generateMockTasks, mockCategories } from '../../../lib/mockData';
import type { TaskDocument } from '../../../db/schema';

interface WeekViewProps {
  focusDate: Date;
  onDayClick?: (date: Date) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({ focusDate, onDayClick }) => {
  const [tasks] = React.useState<TaskDocument[]>(generateMockTasks());

  const weekStart = startOfWeek(focusDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getTasksForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return tasks.filter(task => task.date === dateStr);
  };

  return (
    <div className="flex flex-col h-full">
      {/* FIX: Standardized header spacing to perfectly match MonthView */}
      <div className="grid grid-cols-7 gap-1 px-2 mb-1">
        {weekDays.map(day => (
          <div key={day.toISOString()} className="text-center text-[10px] font-medium text-gray-500 py-1">
            {format(day, 'EEE')}
          </div>
        ))}
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-1 px-2 flex-1 auto-rows-fr">
        {weekDays.map((day, index) => (
          <DayCell
            key={index}
            date={day}
            tasks={getTasksForDay(day)}
            categories={mockCategories}
            isCurrentMonth={true} 
            onClick={onDayClick ? () => onDayClick(day) : undefined}
          />
        ))}
      </div>
    </div>
  );
};