import React, { useState, useCallback, useMemo, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  format,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  addWeeks,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ViewToggle } from '../home/views/ViewToggle';
import { FriendDayViewSheet } from './FriendDayViewSheet';
import { ReplyComposerSheet } from '../messages/ReplyComposerSheet';
import { CalendarCarousel } from '../home/views/CalendarCarousel';
import { useTasksByDate } from '../../hooks/useTasksByDate';
import { useFriendTaskReply } from '../../hooks/useFriendTaskReply';
import type { TaskDocument, CategoryDocument } from '../../db/schema';
import type { CalendarViewMode } from '../home/views/useCalendarState';

const RENDER_WINDOW = 2;

interface FriendCalendarViewProps {
  friendName: string;
  friendUserId: string;
  currentUserId: string;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
}

export const FriendCalendarView: React.FC<FriendCalendarViewProps> = ({
  friendName,
  friendUserId,
  currentUserId,
  tasks,
  categories,
  onReactToTask,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate] = useState<Date>(() => new Date());
  const [activeIndex, setActiveIndex] = useState(30);
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    startIndex: 30,
  });

  const isMonth = viewMode === 'month';

  const slides = useMemo(() => {
    const base = startOfMonth(focusDate);
    const result: Date[] = [];
    for (let i = -30; i <= 30; i++) {
      result.push(isMonth ? addMonths(base, i) : addWeeks(base, i));
    }
    return result;
  }, [focusDate, isMonth]);

  const centerIndex = useMemo(() => {
    const base = startOfMonth(focusDate);
    if (isMonth) {
      return 30 + differenceInCalendarMonths(startOfMonth(focusDate), base);
    }
    const targetWeek = startOfWeek(focusDate);
    return 30 + differenceInCalendarWeeks(targetWeek, startOfWeek(base));
  }, [focusDate, isMonth]);

  const renderStart = Math.max(0, centerIndex - RENDER_WINDOW);
  const renderEnd = Math.min(slides.length - 1, centerIndex + RENDER_WINDOW);

  const tasksByDate = useTasksByDate(tasks);
  const {
    replyTask,
    replyColor,
    feedback,
    handleReplyToTask,
    handleReplySent,
    closeReply,
  } = useFriendTaskReply(tasks);

  const categoriesMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    for (const cat of categories) {
      map[cat.id] = { color: cat.color, name: cat.name };
    }
    return map;
  }, [categories]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setDaySheetOpen(true);
  }, []);

  const handleCloseDaySheet = useCallback(() => {
    setDaySheetOpen(false);
  }, []);

  const handleDaySheetDateChange = useCallback((nextDate: Date) => {
    setSelectedDate(nextDate);
  }, []);

  const handleToggleMode = useCallback(() => {
    setViewMode((m) => (m === 'month' ? 'week' : 'month'));
  }, []);

  const handlePrev = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const handleNext = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
  }, [emblaApi]);

  const activeDate = slides[activeIndex] ?? focusDate;
  const title = isMonth
    ? format(startOfMonth(activeDate), 'MMMM yyyy')
    : `${format(startOfWeek(activeDate), 'MMM d')} - ${format(endOfWeek(activeDate), 'MMM d, yyyy')}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={handlePrev}
          className="p-2 text-gray-400"
          aria-label="Previous"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium">{title}</span>
        <ViewToggle activeMode={viewMode} onToggle={handleToggleMode} />
        <button
          onClick={handleNext}
          className="p-2 text-gray-400"
          aria-label="Next"
        >
          <ChevronRight size={20} />
        </button>
      </div>
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
      <FriendDayViewSheet
        isOpen={daySheetOpen}
        onClose={handleCloseDaySheet}
        date={selectedDate}
        onDateChange={handleDaySheetDateChange}
        tasks={tasks}
        categories={categories}
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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {feedback}
        </div>
      )}
    </div>
  );
};
