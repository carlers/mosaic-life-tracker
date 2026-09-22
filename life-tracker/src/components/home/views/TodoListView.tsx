import React, { useCallback, useState } from 'react';
import {
  format,
  isSameMonth,
} from 'date-fns';
import { DayViewSheet } from './DayViewSheet';
import { TodoCalendarGrid } from './TodoCalendarGrid';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

interface TodoListViewProps {
  focusDate: Date;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onFocusDateChange: (date: Date) => void;
}

export const TodoListView: React.FC<TodoListViewProps> = ({
  focusDate,
  tasks,
  categories,
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

  const handleDateChange = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      if (!isSameMonth(date, focusDate)) {
        onFocusDateChange(date);
      }
    },
    [focusDate, onFocusDateChange]
  );

  return (
    <section
      className="swiper-no-swiping min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pb-8 pt-4 animate-in fade-in duration-300"
      data-testid="todo-scroll-region"
    >
      <TodoCalendarGrid
        focusDate={focusDate}
        selectedDate={selectedDate}
        tasks={tasks}
        categoriesMap={categoriesMap}
        onDateSelect={handleDateChange}
        onMonthChange={onFocusDateChange}
      />

      <div className="mt-1 min-w-0 w-full max-w-full overflow-x-hidden" data-testid="todo-day-section">
        <DayViewSheet
          key={focusMonthKey}
          isOpen
          onClose={() => {}}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          renderMode="inline"
          tasks={tasks}
          categories={categories}
        />
      </div>
    </section>
  );
};
