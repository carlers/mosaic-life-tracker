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
import { Check } from 'lucide-react';
import { getReadableTextColor } from '../../../constants/colors';
import type { TaskDocument } from '../../../db/schema';

interface TodoListViewProps {
  focusDate: Date;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onToggleTask: (task: TaskDocument) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const TodoListView: React.FC<TodoListViewProps> = ({
  focusDate,
  tasks,
  categoriesMap,
  onToggleTask,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
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

  const visibleSelectedDate = isSameMonth(selectedDate, focusDate)
    ? selectedDate
    : focusDate;

  const selectedTasks = useMemo(() => {
    const tasksForDay = tasksByDate.get(format(visibleSelectedDate, 'yyyy-MM-dd')) ?? [];
    return [...tasksForDay].sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [tasksByDate, visibleSelectedDate]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-4 animate-in fade-in duration-300">
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
            const selected = isSameDay(day, visibleSelectedDate);
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
                onClick={() => setSelectedDate(day)}
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

      <div className="mt-6">
        <h3 className="text-base font-bold text-white">{format(visibleSelectedDate, 'EEEE, MMMM d')}</h3>
        {selectedTasks.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No tasks for this day.</p>
        ) : (
          <ul className="mt-3 space-y-2" aria-label={`Tasks for ${format(visibleSelectedDate, 'MMMM d')}`}>
            {selectedTasks.map((task) => {
              const color = categoriesMap[task.categoryId]?.color ?? '#6B7280';
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border border-[#333333] bg-[#1E1E1E] px-3 py-3"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleTask(task)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    style={{ borderColor: task.completed ? color : '#4B5563', backgroundColor: task.completed ? color : 'transparent' }}
                    aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
                  >
                    {task.completed && <Check size={12} color={getReadableTextColor(color)} aria-hidden="true" />}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className={task.completed ? 'block text-sm text-gray-400 line-through' : 'block text-sm text-white'}>{task.title}</span>
                    {categoriesMap[task.categoryId]?.name && (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {categoriesMap[task.categoryId].name}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
