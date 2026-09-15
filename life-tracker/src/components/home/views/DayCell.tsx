import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { isToday } from 'date-fns';
import { TaskBlock } from './TaskBlock';
import type { TaskDocument } from '../../../db/schema';

interface DayCellProps {
  date: Date;
  tasks: TaskDocument[];
  categories: Record<string, { color: string; name: string }>;
  isCurrentMonth?: boolean;
  onDayClick?: (date: Date) => void;
}

const DayCellComponent: React.FC<DayCellProps> = ({
  date,
  tasks,
  categories,
  isCurrentMonth = true,
  onDayClick,
}) => {
  const dayNumber = date.getDate();
  const dayOfWeek = date.getDay();
  const isTodayDate = isToday(date);

  let dayColor = 'text-gray-400';
  if (dayOfWeek === 6) dayColor = 'text-blue-500';
  if (dayOfWeek === 0) dayColor = 'text-red-500';
  if (!isCurrentMonth) dayColor = 'text-gray-600';

  // Sort only when there is more than one task. Empty days (the vast
  // majority of cells across mounted slides) now skip allocation
  // entirely, and non-empty days reuse the array when `tasks` identity
  // is unchanged (§16: grouping is memoized upstream in the tasksByDate
  // Map, so this only recomputes when that day's tasks actually changed).
  const sortedTasks = useMemo(() => {
    if (tasks.length <= 1) return tasks;
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      return 0;
    });
  }, [tasks]);

  // Closure is created inside this component's render, not passed in as
  // a prop — so React.memo on this component is not invalidated by it.
  const handleClick = onDayClick ? () => onDayClick(date) : undefined;

  return (
    <motion.div
      whileTap={onDayClick ? { scale: 0.98 } : {}}
      onClick={handleClick}
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

export const DayCell = React.memo(DayCellComponent);
DayCell.displayName = 'DayCell';
