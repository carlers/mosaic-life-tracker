import React from 'react';
import { motion } from 'framer-motion';
import { isToday } from 'date-fns';
import { TaskBlock } from './TaskBlock';
import type { TaskDocument } from '../../../db/schema';

interface DayCellProps {
  date: Date;
  tasks: TaskDocument[];
  categories: Record<string, { color: string; name: string }>;
  isCurrentMonth?: boolean;
  onClick?: () => void;
}

export const DayCell: React.FC<DayCellProps> = ({
  date,
  tasks,
  categories,
  isCurrentMonth = true,
  onClick,
}) => {
  const dayNumber = date.getDate();
  const dayOfWeek = date.getDay(); 
  const isTodayDate = isToday(date);

  let dayColor = 'text-gray-400';
  if (dayOfWeek === 6) dayColor = 'text-blue-500'; 
  if (dayOfWeek === 0) dayColor = 'text-red-500';  
  if (!isCurrentMonth) dayColor = 'text-gray-600'; 

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    return 0;
  });

  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      // FIX: Removed px-0.5 to let tasks fill the entire column width
      className={`py-0.5 cursor-pointer flex flex-col h-full rounded-md hover:bg-[#1E1E1E] transition-colors ${
        !isCurrentMonth ? 'opacity-40' : ''
      }`}
    >
      <div className="flex justify-center mb-1">
        <div 
          className={`text-xs font-bold flex items-center justify-center w-6 h-6 rounded-full ${dayColor} ${
            isTodayDate ? 'border border-blue-500' : ''
          }`}
        >
          {dayNumber}
        </div>
      </div>

      <div className="flex-1 space-y-0.5">
        {sortedTasks.map((task) => (
          <TaskBlock 
            key={task.id} 
            task={task} 
            categoryColor={categories[task.categoryId]?.color || '#6B7280'} 
          />
        ))}
      </div>
    </motion.div>
  );
};