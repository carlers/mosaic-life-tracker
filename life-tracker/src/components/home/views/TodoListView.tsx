import React, { lazy, Suspense, useCallback, useState } from 'react';
import {
  format,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { DayViewSheet } from './DayViewSheet';
import { FriendDayViewSheet } from '../../friend/FriendDayViewSheet';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { TodoCalendarGrid } from './TodoCalendarGrid';
import { DiaryDayCard } from './DiaryDayPreview';
import { useSettings } from '../../../hooks/useSettings';
import {
  DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, DIARY_DAY_VIEW_POSITION_SETTING_KEY,
  SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, resolveDiaryDayViewHeight, resolveDiaryDayViewPosition,
} from '../../../lib/preferences';
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
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
  sharedByDay?: ReadonlyMap<string, SharedTaskItem[]>;
  ownedSharedTaskIds?: ReadonlySet<string>;
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
  markerMode?: 'todo' | 'diary';
  diaryEntries?: readonly DiaryDocument[];
  onOpenDiary?: (date: Date) => void;
}

export const TodoListView: React.FC<TodoListViewProps> = ({
  focusDate,
  tasks,
  sharedByDay,
  ownedSharedTaskIds,
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
  markerMode = 'todo',
  diaryEntries = [],
  onOpenDiary,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(focusDate));
  const { getSetting } = useSettings();
  const showFriendDiaryCard = variant === 'friend' &&
    (markerMode === 'diary' || getSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, false) === true);
  const friendDiaryPosition = resolveDiaryDayViewPosition(getSetting(DIARY_DAY_VIEW_POSITION_SETTING_KEY, 'top'));
  const friendDiaryExpanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  const friendEntry = diaryEntries.find(item => item.date === format(selectedDate, 'yyyy-MM-dd'));
  const friendDiaryCard = showFriendDiaryCard && friendEntry && onOpenDiary ? (
    <div className="my-2 px-4"><DiaryDayCard entry={friendEntry} expanded={friendDiaryExpanded} onOpen={() => onOpenDiary(selectedDate)}/></div>
  ) : null;
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

  const handleCalendarDateSelect = useCallback((date: Date) => {
    if (markerMode === 'diary' && isSameDay(selectedDate, date)) {
      onOpenDiary?.(date);
      return;
    }
    handleDateChange(date);
  }, [markerMode, selectedDate, handleDateChange, onOpenDiary]);

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
          sharedByDay={variant === 'me' ? sharedByDay : undefined}
          ownedSharedTaskIds={variant === 'me' ? ownedSharedTaskIds : undefined}
          categories={categories}
          categoriesMap={categoriesMap}
          onDateSelect={handleCalendarDateSelect}
          onMonthChange={onFocusDateChange}
          markerMode={markerMode}
          diaryEntries={diaryEntries}
          weekStartsOn={weekStartsOn}
          holidayConfig={holidayConfig}
        />
      </div>

      <div className="mt-0 min-w-0 w-full max-w-full overflow-x-hidden" data-testid="todo-day-section">
        {variant === 'friend' && friendUserId ? (
          <>
            {friendDiaryPosition === 'top' && friendDiaryCard}
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
            {friendDiaryPosition === 'bottom' && friendDiaryCard}
            <Suspense fallback={null}>
              <ReplyComposerSheet isOpen={!!replyTask} onClose={closeReply}
                task={replyTask} categoryColor={replyColor}
                friendId={friendUserId} friendName={friendName} onSent={handleReplySent} />
            </Suspense>
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
            showDiaryAlways={markerMode === 'diary'}
            tasks={tasks}
            categories={categories}
            holidayConfig={holidayConfig}
          />
        )}
      </div>
    </section>
  );
};
