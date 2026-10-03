import React, { useMemo } from 'react';
import { isToday, format } from 'date-fns';
import { TaskBlock } from './TaskBlock';
import type { TaskDocument } from '../../../db/schema';
import {
  EMPTY_HOLIDAYS,
  holidayNames,
  type HolidayOccurrence,
} from '../../../lib/holidays';

interface DayCellProps {
  date: Date;
  tasks: TaskDocument[];
  categories: Record<string, { color: string; name: string }>;
  holidays?: readonly HolidayOccurrence[];
  isCurrentMonth?: boolean;
  onDayClick?: (date: Date) => void;
}

const DayCellComponent: React.FC<DayCellProps> = ({
  date,
  tasks,
  categories,
  holidays = EMPTY_HOLIDAYS,
  isCurrentMonth = true,
  onDayClick,
}) => {
  const dayNumber = date.getDate();
  const dayOfWeek = date.getDay();
  const isTodayDate = isToday(date);

  let dayColor = 'text-white';
  if (dayOfWeek === 6) dayColor = 'text-blue-500';
  if (dayOfWeek === 0 || holidays.length > 0) dayColor = 'text-red-500';
  if (!isCurrentMonth) dayColor = 'text-gray-400';

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

  // Accessible name includes the full date and a task count so a
  // screen-reader user gets the same information the visual grid
  // conveys (day-of-week coloring, today's border, task density).
  const ariaLabel = useMemo(() => {
    const parts = [format(date, 'EEEE, MMMM d, yyyy')];
    if (isTodayDate) parts.push('today');
    if (holidays.length > 0) {
      parts.push(`holiday: ${holidayNames(holidays)}`);
    }
    const n = tasks.length;
    parts.push(n === 0 ? 'no tasks' : `${n} task${n === 1 ? '' : 's'}`);
    return parts.join(', ');
  }, [date, holidays, tasks.length, isTodayDate]);

  const handleClick = onDayClick ? () => onDayClick(date) : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!onDayClick}
      aria-label={ariaLabel}
      aria-current={isTodayDate ? 'date' : undefined}
      aria-disabled={!onDayClick}
      // Keep sparse calendar rows readable: reserve the height of the
      // day label plus two standard (text-only) task blocks. Rows can
      // still grow when their tallest cell contains more content.
      className={`py-0.5 flex flex-col h-full min-h-[4.25rem] w-full rounded-md text-left transition-colors focus:outline-none ${
        onDayClick ? 'cursor-pointer hover:bg-[#1E1E1E] active:scale-[0.98]' : 'cursor-default'
      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
    >
      <div className="flex justify-center mb-1">
        <div
          className={`text-[0.93rem] font-bold flex items-center justify-center w-7 h-7 rounded-full ${dayColor} ${
            isTodayDate ? 'border border-blue-500 border-2' : ''
          }`}
          aria-hidden="true"
        >
          {dayNumber}
        </div>
      </div>
      <div className="flex-1 space-y-[0.2rem]" aria-hidden="true">
        {holidays.map((holiday) => (
          <div
            key={holiday.id}
            className="w-full overflow-hidden rounded-[4.5px] bg-red-950/70 px-[0.3rem] pb-0.5 pt-0.5 text-[10.5px] font-semibold text-red-400"
            title={holiday.title}
          >
            <span className="block overflow-hidden whitespace-nowrap">
              {holiday.title}
            </span>
          </div>
        ))}
        {sortedTasks.map((task) => (
          <TaskBlock
            key={task.id}
            task={task}
            categoryColor={categories[task.categoryId]?.color || '#6B7280'}
          />
        ))}
      </div>
    </button>
  );
};

export const DayCell = React.memo(DayCellComponent);
DayCell.displayName = 'DayCell';
