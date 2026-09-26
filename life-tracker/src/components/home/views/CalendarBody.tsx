import React, { startTransition, useCallback, useState } from 'react';
import { DayViewSheet } from './DayViewSheet';
import { FriendDayViewSheet } from '../../friend/FriendDayViewSheet';
import { ReplyComposerSheet } from '../../messages/ReplyComposerSheet';
import { CalendarCarousel } from './CalendarCarousel';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';

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
  friendCategories?: CategoryDocument[];
  friendName?: string;
  friendUserId?: string | null;
  currentUserId: string;
  isActive: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
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
  friendCategories,
  friendName,
  friendUserId,
  currentUserId,
  isActive,
  onPrev,
  onNext,
  onReactToTask,
}) => {
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const tasksByDate = useTasksByDate(tasks);
  const {
    replyTask,
    replyColor,
    feedback,
    handleReplyToTask,
    handleReplySent,
    closeReply,
  } = useFriendTaskReply(tasks);

  const handleDayClick = useCallback((date: Date) => {
    // Keep the tap responsive; sheet rendering is non-urgent work. [verify:full]
    startTransition(() => {
      setSelectedDate(date);
      setDaySheetOpen(true);
    });
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
      categoriesMap={categoriesMap}
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
        <FriendDayViewSheet
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
        />
        <ReplyComposerSheet
          isOpen={!!replyTask}
          onClose={closeReply}
          task={replyTask}
          categoryColor={replyColor}
          friendId={friendUserId}
          friendName={friendName}
          onSent={handleReplySent}
        />
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
      <DayViewSheet
        isOpen={daySheetOpen}
        onClose={handleCloseDaySheet}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        tasks={tasks}
        categories={categories ?? []}
      />
    </>
  );
};

export const CalendarBody = React.memo(CalendarBodyComponent);
CalendarBody.displayName = 'CalendarBody';
