import React, { useState, useCallback, useMemo } from 'react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayViewSheet } from './DayViewSheet';
import { FriendDayViewSheet } from '../../friend/FriendDayViewSheet';
import { ReplyComposerSheet } from '../../messages/ReplyComposerSheet';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { CalendarViewMode } from './useCalendarState';
import { EMPTY_CATEGORIES } from '../../../constants/empty';

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasksByDate: Map<string, TaskDocument[]>;
  categoriesMap: Record<string, { color: string; name: string }>;
}

const CalendarSlide = React.memo(
  ({
    date,
    viewMode,
    onDayClick,
    tasksByDate,
    categoriesMap,
  }: CalendarSlideProps) => {
    if (viewMode === 'month') {
      return (
        <MonthView
          focusDate={date}
          onDayClick={onDayClick}
          tasksByDate={tasksByDate}
          categoriesMap={categoriesMap}
        />
      );
    }
    return (
      <WeekView
        focusDate={date}
        onDayClick={onDayClick}
        tasksByDate={tasksByDate}
        categoriesMap={categoriesMap}
      />
    );
  }
);
CalendarSlide.displayName = 'CalendarSlide';

interface CalendarBodyProps {
  viewMode: CalendarViewMode;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  variant: 'me' | 'friend';
  friendCategories?: CategoryDocument[];
  friendName?: string;
  friendUserId?: string | null;
  currentUserId: string;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
}

const CalendarBodyComponent: React.FC<CalendarBodyProps> = ({
  viewMode,
  slides,
  renderStart,
  renderEnd,
  emblaRef,
  tasks,
  categoriesMap,
  variant,
  friendCategories,
  friendName,
  friendUserId,
  currentUserId,
  onReactToTask,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [replyTask, setReplyTask] = useState<TaskDocument | null>(null);
  const [replyColor, setReplyColor] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Single index of all tasks keyed by their `yyyy-MM-dd` date string.
  // Computed once per `tasks` array identity (§16 “Grouping is Memoized”)
  // and shared by every MonthView/WeekView slide and every DayCell.
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const t of tasks) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }, [tasks]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);
  const handleCloseSheet = useCallback(() => {
    setSelectedDate(null);
  }, []);
  const handleReplyToTask = useCallback(
    (task: TaskDocument, color: string) => {
      setReplyTask(task);
      setReplyColor(color);
    },
    []
  );
  const handleReplySent = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  const safeFriendCategories = friendCategories ?? EMPTY_CATEGORIES;

  return (
    <>
      <div className="flex-1 min-h-0 overflow-hidden py-2" ref={emblaRef}>
        <div className="flex h-full" style={{ touchAction: 'pan-y' }}>
          {slides.map((date, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-full w-full"
              style={{ flex: '0 0 100%', minWidth: 0 }}
            >
              {i >= renderStart && i <= renderEnd ? (
                <CalendarSlide
                  date={date}
                  viewMode={viewMode}
                  onDayClick={handleDayClick}
                  tasksByDate={tasksByDate}
                  categoriesMap={categoriesMap}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {variant === 'me' ? (
        <DayViewSheet
          isOpen={!!selectedDate}
          onClose={handleCloseSheet}
          selectedDate={selectedDate || new Date()}
          onDateChange={setSelectedDate}
        />
      ) : (
        <>
          <FriendDayViewSheet
            isOpen={!!selectedDate}
            onClose={handleCloseSheet}
            date={selectedDate}
            tasks={tasks}
            categories={safeFriendCategories}
            friendName={friendName || 'Friend'}
            currentUserId={currentUserId}
            onReplyToTask={handleReplyToTask}
            onReactToTask={onReactToTask}
          />
          <ReplyComposerSheet
            isOpen={!!replyTask}
            onClose={() => setReplyTask(null)}
            task={replyTask}
            categoryColor={replyColor}
            friendId={replyTask ? friendUserId || null : null}
            friendName={friendName || 'Friend'}
            onSent={handleReplySent}
          />
          {feedback && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
              {feedback}
            </div>
          )}
        </>
      )}
    </>
  );
};

export const CalendarBody = React.memo(CalendarBodyComponent);
CalendarBody.displayName = 'CalendarBody';
