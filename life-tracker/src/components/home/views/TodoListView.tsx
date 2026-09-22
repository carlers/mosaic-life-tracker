import React, { useMemo, useState } from 'react';
import {
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
import { DayViewSheet } from './DayViewSheet';
import type { TaskDocument } from '../../../db/schema';

interface TodoListViewProps {
  focusDate: Date;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onFocusDateChange: (date: Date) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const TodoListView: React.FC<TodoListViewProps> = ({
  focusDate,
  tasks,
  categoriesMap,
  onFocusDateChange,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(focusDate));
  const focusMonthKey = format(focusDate, 'yyyy-MM');
  const [syncedFocusMonthKey, setSyncedFocusMonthKey] = useState(focusMonthKey);

  if (focusMonthKey !== syncedFocusMonthKey) {
    setSyncedFocusMonthKey(focusMonthKey);
    setSelectedDate(new Date(focusDate));
  }

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

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    if (!isSameMonth(date, focusDate)) {
      onFocusDateChange(date);
    }
  };

  return (
    <section className="swiper-no-swiping flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-4 animate-in fade-in duration-300">
      <div
        className="rounded-xl border border-[#333333] bg-[#1E1E1E] p-3"
        role="grid"
        aria-label={`${format(focusDate, 'MMMM yyyy')} todo calendar`}
      >
        <div className="mb-2 grid grid-cols-7" role="row">
          {WEEKDAY_LABELS.map((label, index) => (
            <div key={`${label}-${index}`} role="columnheader" className="text-center text-[10px] font-medium text-gray-500">
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
                aria-label={`${dateLabel}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                aria-selected={selected}
                aria-current={isToday(day) ? 'date' : undefined}
                onClick={() => handleDateChange(day)}
                className={`mx-auto flex min-h-10 w-9 flex-col items-center rounded-lg pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                  selected ? 'bg-white text-black' : currentMonth ? 'text-gray-300 hover:bg-[#2A2A2A]' : 'text-gray-600'
                }`}
              >
                <span className="text-xs font-semibold">{format(day, 'd')}</span>
                <span className="mt-1 flex max-w-7 flex-wrap justify-center gap-0.5" aria-hidden="true">
                  {dayTasks.slice(0, 4).map((task) => (
                    <span
                      key={task.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: categoriesMap[task.categoryId]?.color ?? '#6B7280' }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <h3 className="mt-6 px-1 text-base font-bold text-white">
        {format(selectedDate, 'EEEE, MMMM d')}
      </h3>

      <div className="mt-2 flex min-h-[22rem] flex-1 flex-col">
        <DayViewSheet
          isOpen
          onClose={() => {}}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          renderMode="inline"
        />
      </div>
    </section>
  );
};
