import React, { lazy, Suspense, useCallback, useState } from 'react';
import {
  format,
  isSameMonth,
} from 'date-fns';
import { DayViewSheet } from './DayViewSheet';
import { FriendDayViewSheet } from '../../friend/FriendDayViewSheet';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { TodoCalendarGrid } from './TodoCalendarGrid';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import type { WeekStartsOn } from '../../../lib/preferences';
import {
  DISABLED_HOLIDAY_CONFIG,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

const ReplyComposerSheet = lazy(() =>
  import('../../messages/ReplyComposerSheet').then(({ ReplyComposerSheet }) => ({
    default: ReplyComposerSheet,
  }))
);

interface TodoListViewProps {
  focusDate: Date;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onFocusDateChange: (date: Date) => void;
  variant?: 'me' | 'friend';
  friendName?: string;
  friendUserId?: string;
  currentUserId?: string;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  weekStartsOn?: WeekStartsOn;
  holidayConfig?: HolidayDisplayConfig;
}

export const TodoListView: React.FC<TodoListViewProps> = ({
  focusDate,
  tasks,
  categories,
  categoriesMap,
  onFocusDateChange,
  variant = 'me',
  friendName = '',
  friendUserId = '',
  currentUserId = '',
  onReactToTask,
  weekStartsOn = 0,
  holidayConfig = DISABLED_HOLIDAY_CONFIG,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(focusDate));
  const {
    replyTask,
    replyColor,
    feedback,
    handleReplyToTask,
    handleReplySent,
    closeReply,
  } = useFriendTaskReply(tasks);

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
      <div
        className="-mx-4 w-[calc(100%+2rem)]"
        data-testid="todo-calendar-surface"
      >
        <TodoCalendarGrid
          focusDate={focusDate}
          selectedDate={selectedDate}
          tasks={tasks}
          categories={categories}
          categoriesMap={categoriesMap}
          onDateSelect={handleDateChange}
          onMonthChange={onFocusDateChange}
          weekStartsOn={weekStartsOn}
          holidayConfig={holidayConfig}
        />
      </div>

      <div className="mt-0 min-w-0 w-full max-w-full overflow-x-hidden" data-testid="todo-day-section">
        {variant === 'friend' && friendUserId ? (
          <>
            <FriendDayViewSheet
              key={focusMonthKey}
              isOpen
              onClose={() => {}}
              date={selectedDate}
              onDateChange={handleDateChange}
              renderMode="inline"
              tasks={tasks}
              categories={categories}
              friendName={friendName}
              currentUserId={currentUserId}
              onReplyToTask={handleReplyToTask}
              onReactToTask={onReactToTask}
              holidayConfig={holidayConfig}
            />
            {replyTask && (
              <Suspense fallback={null}>
                <ReplyComposerSheet
                  isOpen
                  onClose={closeReply}
                  task={replyTask}
                  categoryColor={replyColor}
                  friendId={friendUserId}
                  friendName={friendName}
                  onSent={handleReplySent}
                />
              </Suspense>
            )}
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg"
              >
                {feedback}
              </div>
            )}
          </>
        ) : (
          <DayViewSheet
            key={focusMonthKey}
            isOpen
            onClose={() => {}}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            renderMode="inline"
            tasks={tasks}
            categories={categories}
            holidayConfig={holidayConfig}
          />
        )}
      </div>
    </section>
  );
};
