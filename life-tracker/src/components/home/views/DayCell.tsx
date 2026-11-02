import React, { useMemo } from 'react';
import { isToday, format } from 'date-fns';
import { TaskBlock } from './TaskBlock';
import { UsersRound } from 'lucide-react';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { TaskDocument } from '../../../db/schema';
import type { CalendarTaskPreviewLimit } from '../../../lib/preferences';
import {
  EMPTY_HOLIDAYS,
  holidayNames,
  type HolidayOccurrence,
} from '../../../lib/holidays';

interface DayCellProps {
  date: Date;
  tasks: TaskDocument[];
  taskPreviewLimit?: CalendarTaskPreviewLimit | 0;
  sharedItems?: SharedTaskItem[];
  ownedSharedTaskIds?: ReadonlySet<string>;
  categories: Record<string, { color: string; name: string }>;
  holidays?: readonly HolidayOccurrence[];
  isCurrentMonth?: boolean;
  onDayClick?: (date: Date) => void;
  keyboardTabIndex?: number;
}

const DayCellComponent: React.FC<DayCellProps> = ({
  date,
  tasks,
  taskPreviewLimit = 'unlimited',
  sharedItems = [],
  ownedSharedTaskIds,
  categories,
  holidays = EMPTY_HOLIDAYS,
  isCurrentMonth = true,
  onDayClick,
  keyboardTabIndex,
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

  const ownedVisibleCount = taskPreviewLimit === 'unlimited'
    ? sortedTasks.length : Math.min(sortedTasks.length, taskPreviewLimit);
  const sharedVisibleCount = taskPreviewLimit === 'unlimited'
    ? sharedItems.length : Math.min(sharedItems.length, taskPreviewLimit - ownedVisibleCount);
  const visibleTasks = ownedVisibleCount === sortedTasks.length
    ? sortedTasks : sortedTasks.slice(0, ownedVisibleCount);
  const visibleShares = sharedVisibleCount === sharedItems.length
    ? sharedItems : sharedItems.slice(0, sharedVisibleCount);
  const hiddenTaskCount = tasks.length + sharedItems.length - ownedVisibleCount - sharedVisibleCount;

  // Accessible name includes the full date and a task count so a
  // screen-reader user gets the same information the visual grid
  // conveys (day-of-week coloring, today's border, task density).
  const ariaLabel = useMemo(() => {
    const parts = [format(date, 'EEEE, MMMM d, yyyy')];
    if (isTodayDate) parts.push('today');
    if (holidays.length > 0) {
      parts.push(`holiday: ${holidayNames(holidays)}`);
    }
    const n = tasks.length + sharedItems.length;
    parts.push(n === 0 ? 'no tasks' : `${n} task${n === 1 ? '' : 's'}`);
    if (hiddenTaskCount > 0) parts.push(`${hiddenTaskCount} more not previewed`);
    return parts.join(', ');
  }, [date, holidays, tasks.length, sharedItems.length, hiddenTaskCount, isTodayDate]);

  const handleClick = onDayClick ? () => onDayClick(date) : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!onDayClick}
      aria-label={ariaLabel}
      aria-current={isTodayDate ? 'date' : undefined}
      aria-disabled={!onDayClick}
      data-calendar-day={format(date, 'yyyy-MM-dd')}
      tabIndex={keyboardTabIndex}
      // Keep sparse calendar rows readable: reserve the height of the
      // day label plus two standard (text-only) task blocks. Rows can
      // still grow when their tallest cell contains more content.
      className={`py-0.5 flex flex-col h-full min-h-[4.25rem] w-full rounded-md text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/80 ${
        onDayClick ? 'cursor-pointer hover:bg-[#1E1E1E] active:scale-[0.98]' : 'cursor-default'
      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
    >
      <div className="flex justify-center mb-1">
        <div
          className={`text-[0.93rem] font-bold flex items-center justify-center w-7 h-7 rounded-full ${dayColor} ${holidays.length > 0 ? 'mosaic-holiday-date' : 'mosaic-day-number'} ${
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
            className="mosaic-holiday-label w-full overflow-hidden rounded-[4.5px] bg-red-950/70 px-[0.3rem] pb-0.5 pt-0.5 text-[10.5px] font-semibold text-red-400"
            title={holiday.title}
          >
            <span className="block overflow-hidden whitespace-nowrap">
              {holiday.title}
            </span>
          </div>
        ))}
        {visibleTasks.map((task) => (
          <TaskBlock
            key={task.id}
            task={task}
            categoryColor={categories[task.categoryId]?.color || '#6B7280'}
            isShared={ownedSharedTaskIds?.has(task.id)}
          />
        ))}
        {visibleShares.map(item => (
          <div key={item.id} title={'Shared by a friend: ' + item.title}
            className="flex min-w-0 items-center gap-1 rounded bg-surfaceHighlight px-1 py-0.5 text-[10px] text-gray-300">
            <UsersRound size={10} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 truncate">{item.title}</span>
          </div>
        ))}
        {hiddenTaskCount > 0 && (
          <div className="px-1 text-[10px] font-medium text-gray-400">
            +{hiddenTaskCount} more tasks
          </div>
        )}
      </div>
    </button>
  );
};

/**
 * RxDB emits a new task array after an edit; useTasksByDate groups that array
 * into new day arrays even if 30 other days have exactly the same documents.
 * Keep those unaffected cells out of React's expensive task-block render.
 *
 * RxDB replace/patch emits a new RxDocument for the changed row. Never skip
 * if a task was inserted, removed, reordered, or replaced. Other props must
 * still use normal React.memo identity semantics (shared, holidays, category
 * colors, date, click handler). No cross-account or persisted cache.
 */
function dayCellPropsEqual(previous: DayCellProps, next: DayCellProps): boolean {
  if (
    previous.date !== next.date ||
    previous.taskPreviewLimit !== next.taskPreviewLimit ||
    previous.sharedItems !== next.sharedItems ||
    previous.ownedSharedTaskIds !== next.ownedSharedTaskIds ||
    previous.categories !== next.categories ||
    previous.holidays !== next.holidays ||
    previous.isCurrentMonth !== next.isCurrentMonth ||
    previous.onDayClick !== next.onDayClick ||
    previous.keyboardTabIndex !== next.keyboardTabIndex
  ) return false;

  if (previous.tasks === next.tasks) return true;
  if (previous.tasks.length !== next.tasks.length) return false;
  for (let index = 0; index < previous.tasks.length; index += 1) {
    if (previous.tasks[index] !== next.tasks[index]) return false;
  }
  return true;
}

export const DayCell = React.memo(DayCellComponent, dayCellPropsEqual);
DayCell.displayName = 'DayCell';
