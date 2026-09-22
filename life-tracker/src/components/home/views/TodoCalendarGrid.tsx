import React, { useCallback, useMemo, useRef } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { TaskDocument } from '../../../db/schema';

interface TodoCalendarGridProps {
  focusDate: Date;
  selectedDate: Date;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SWIPE_THRESHOLD_PX = 48;
const SWIPE_AXIS_RATIO = 1.2;

export const TodoCalendarGrid: React.FC<TodoCalendarGridProps> = ({
  focusDate,
  selectedDate,
  tasks,
  categoriesMap,
  onDateSelect,
  onMonthChange,
}) => {
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const suppressClickUntilRef = useRef(0);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(focusDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(endOfMonth(monthStart)),
    });
  }, [focusDate]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, TaskDocument[]>();
    for (const task of tasks) {
      const dayTasks = grouped.get(task.date);
      if (dayTasks) {
        dayTasks.push(task);
      } else {
        grouped.set(task.date, [task]);
      }
    }
    return grouped;
  }, [tasks]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      swipeStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    []
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start || start.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      const horizontalDistance = Math.abs(deltaX);
      const verticalDistance = Math.abs(deltaY);

      if (
        horizontalDistance < SWIPE_THRESHOLD_PX ||
        horizontalDistance <= verticalDistance * SWIPE_AXIS_RATIO
      ) {
        return;
      }

      suppressClickUntilRef.current = Date.now() + 350;
      onMonthChange(addMonths(focusDate, deltaX < 0 ? 1 : -1));
    },
    [focusDate, onMonthChange]
  );

  const handlePointerCancel = useCallback(() => {
    swipeStartRef.current = null;
  }, []);

  const handleClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (Date.now() >= suppressClickUntilRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
    []
  );

  return (
    <div
      className="swiper-no-swiping w-full min-w-0 max-w-full touch-pan-y rounded-xl border border-[#333333] bg-[#1E1E1E] p-3"
      role="grid"
      aria-label={`${format(focusDate, 'MMMM yyyy')} todo calendar`}
      data-testid="todo-calendar-grid"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
    >
      <div className="mb-2 grid grid-cols-7" role="row">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            role="columnheader"
            className="text-center text-[10px] font-medium text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-2" role="rowgroup">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const selected = isSameDay(day, selectedDate);
          const currentMonth = isSameMonth(day, focusDate);
          const dateLabel = format(day, 'EEEE, MMMM d, yyyy');

          return (
            <button
              key={dateKey}
              type="button"
              role="gridcell"
              aria-label={`${dateLabel}, ${dayTasks.length} task${
                dayTasks.length === 1 ? '' : 's'
              }`}
              aria-selected={selected}
              aria-current={isToday(day) ? 'date' : undefined}
              onClick={() => onDateSelect(day)}
              className={`mx-auto flex min-h-10 w-9 flex-col items-center rounded-lg pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                selected
                  ? 'bg-white text-black'
                  : currentMonth
                    ? 'text-gray-300 hover:bg-[#2A2A2A]'
                    : 'text-gray-600'
              }`}
            >
              <span className="text-xs font-semibold">{format(day, 'd')}</span>
              <span
                className="mt-1 flex max-w-7 flex-wrap justify-center gap-0.5"
                aria-hidden="true"
              >
                {dayTasks.slice(0, 4).map((task) => (
                  <span
                    key={task.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        categoriesMap[task.categoryId]?.color ?? '#6B7280',
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
