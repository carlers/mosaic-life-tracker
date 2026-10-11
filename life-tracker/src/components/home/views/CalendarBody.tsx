import React, { useCallback, useMemo, useState } from 'react';
import { CalendarCarousel } from './CalendarCarousel';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';
import { useHolidaysByDate } from '../../../hooks/useHolidays';
import {
  DISABLED_HOLIDAY_CONFIG,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

const LazyDayViewSheet = React.lazy(() =>
  import('./DayViewSheet').then(({ DayViewSheet }) => ({
    default: DayViewSheet,
  }))
);
const LazyFriendDayViewSheet = React.lazy(() =>
  import('../../friend/FriendDayViewSheet').then(({ FriendDayViewSheet }) => ({
    default: FriendDayViewSheet,
  }))
);
const LazyReplyComposerSheet = React.lazy(() =>
  import('../../messages/ReplyComposerSheet').then(({ ReplyComposerSheet }) => ({
    default: ReplyComposerSheet,
  }))
);

interface CalendarBodyProps {
  viewMode: CalendarViewMode;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  tasks: TaskDocument[];
  categories?: CategoryDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  variant: 'me' | 'friend';
  sharedByDay?: ReadonlyMap<string, SharedTaskItem[]>;
  ownedSharedTaskIds?: ReadonlySet<string>;
  friendCategories?: CategoryDocument[];
  friendName?: string;
  friendUserId?: string | null;
  currentUserId: string;
  isActive: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  weekStartsOn?: WeekStartsOn;
  holidayConfig?: HolidayDisplayConfig;
}

const CalendarBodyComponent: React.FC<CalendarBodyProps> = ({
  viewMode,
  slides,
  renderStart,
  renderEnd,
  emblaRef,
  tasks,
  categories,
  categoriesMap,
  variant,
  sharedByDay,
  ownedSharedTaskIds,
  friendCategories,
  friendName,
  friendUserId,
  currentUserId,
  isActive,
  onPrev,
  onNext,
  onReactToTask,
  weekStartsOn = 0,
  holidayConfig = DISABLED_HOLIDAY_CONFIG,
}) => {
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [daySheetMounted, setDaySheetMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const tasksByDate = useTasksByDate(tasks);
  const holidayYears = useMemo(() => {
    const years = new Set<number>();
    for (let index = renderStart; index <= renderEnd; index += 1) {
      const date = slides[index];
      if (!date) continue;
      const year = date.getFullYear();
      years.add(year);
      if (date.getMonth() === 0) years.add(year - 1);
      if (date.getMonth() === 11) years.add(year + 1);
    }
    return [...years];
  }, [renderEnd, renderStart, slides]);
  const holidaysByDate = useHolidaysByDate(holidayConfig, holidayYears);
  const {
    replyTask,
    replyColor,
    feedback,
    handleReplyToTask,
    handleReplySent,
    closeReply,
  } = useFriendTaskReply(tasks);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setDaySheetMounted(true);
    setDaySheetOpen(true);
  }, []);

  const handleCloseDaySheet = useCallback(() => {
    setDaySheetOpen(false);
  }, []);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  useHorizontalArrowNavigation({
    enabled: isActive && !daySheetOpen && !replyTask,
    onLeft: onPrev,
    onRight: onNext,
  });

  const carousel = (
    <CalendarCarousel
      slides={slides}
      renderStart={renderStart}
      renderEnd={renderEnd}
      emblaRef={emblaRef}
      viewMode={viewMode}
      onDayClick={handleDayClick}
      tasksByDate={tasksByDate}
      sharedByDay={variant === 'me' ? sharedByDay : undefined}
      ownedSharedTaskIds={variant === 'me' ? ownedSharedTaskIds : undefined}
      categoriesMap={categoriesMap}
      weekStartsOn={weekStartsOn}
      holidaysByDate={holidaysByDate}
    />
  );

  const calendarContent = (content: React.ReactNode) => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {content}
    </div>
  );

  if (variant === 'friend' && friendName && friendUserId) {
    return (
      <>
        {calendarContent(carousel)}
        {daySheetMounted && (
          <React.Suspense fallback={null}>
            <LazyFriendDayViewSheet
              isOpen={daySheetOpen}
              onClose={handleCloseDaySheet}
              date={selectedDate}
              onDateChange={handleDateChange}
              tasks={tasks}
              categories={friendCategories ?? []}
              friendName={friendName}
              currentUserId={currentUserId}
              onReplyToTask={handleReplyToTask}
              onReactToTask={onReactToTask}
              holidayConfig={holidayConfig}
            />
          </React.Suspense>
        )}
        <React.Suspense fallback={null}>
          <LazyReplyComposerSheet
            isOpen={!!replyTask}
            onClose={closeReply}
            task={replyTask}
            categoryColor={replyColor}
            friendId={friendUserId}
            friendName={friendName}
            onSent={handleReplySent}
          />
        </React.Suspense>
        {feedback && (
          <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            {feedback}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {calendarContent(carousel)}
      {daySheetMounted && (
        <React.Suspense fallback={null}>
          <LazyDayViewSheet
            isOpen={daySheetOpen}
            onClose={handleCloseDaySheet}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            tasks={tasks}
            categories={categories ?? []}
            holidayConfig={holidayConfig}
          />
        </React.Suspense>
      )}
    </>
  );
};

export const CalendarBody = React.memo(CalendarBodyComponent);
CalendarBody.displayName = 'CalendarBody';
