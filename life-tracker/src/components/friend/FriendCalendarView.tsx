import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
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
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthView } from '../home/views/MonthView';
import { WeekView } from '../home/views/WeekView';
import { ViewToggle } from '../home/views/ViewToggle';
import { FriendDayViewSheet } from './FriendDayViewSheet';
import { ReplyComposerSheet } from '../messages/ReplyComposerSheet';
import type { TaskDocument, CategoryDocument } from '../../db/schema';

type CalendarViewMode = 'month' | 'week';

const SLIDES_EACH_SIDE = 12;
const TOTAL_SLIDES = SLIDES_EACH_SIDE * 2 + 1;
const CENTER_INDEX = SLIDES_EACH_SIDE;

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  onDayClick: (date: Date) => void;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
}

const CalendarSlide = React.memo(
  ({ date, viewMode, onDayClick, tasks, categoriesMap }: CalendarSlideProps) => {
    if (viewMode === 'month') {
      return (
        <MonthView
          focusDate={date}
          onDayClick={onDayClick}
          tasks={tasks}
          categoriesMap={categoriesMap}
        />
      );
    }
    return (
      <WeekView
        focusDate={date}
        onDayClick={onDayClick}
        tasks={tasks}
        categoriesMap={categoriesMap}
      />
    );
  }
);
CalendarSlide.displayName = 'CalendarSlide';

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
  const [focusDate, setFocusDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [replyTask, setReplyTask] = useState<TaskDocument | null>(null);
  const [replyColor, setReplyColor] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const categoriesMap = useMemo(() => {
    return categories.reduce(
      (acc: Record<string, { color: string; name: string }>, cat) => {
        acc[cat.id] = { color: cat.color, name: cat.name };
        return acc;
      },
      {}
    );
  }, [categories]);

  const [baseDate, setBaseDate] = useState(focusDate);
  const isInternalSwipeRef = useRef(false);
  const [prevViewMode, setPrevViewMode] = useState(viewMode);
  if (prevViewMode !== viewMode) {
    setPrevViewMode(viewMode);
    setBaseDate(focusDate);
  }

  const slides = useMemo(() => {
    const fn = viewMode === 'month' ? addMonths : addWeeks;
    return Array.from({ length: TOTAL_SLIDES }, (_, i) =>
      fn(baseDate, i - CENTER_INDEX)
    );
  }, [baseDate, viewMode]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    skipSnaps: false,
  });

  useEffect(() => {
    if (!emblaApi) return;
    if (isInternalSwipeRef.current) {
      isInternalSwipeRef.current = false;
      return;
    }
    const offset =
      viewMode === 'month'
        ? differenceInCalendarMonths(focusDate, baseDate)
        : differenceInCalendarWeeks(focusDate, baseDate);
    const targetIndex = CENTER_INDEX + offset;
    if (targetIndex < 0 || targetIndex >= TOTAL_SLIDES) return;
    if (emblaApi.selectedScrollSnap() !== targetIndex) {
      emblaApi.scrollTo(targetIndex, true);
    }
  }, [emblaApi, focusDate, baseDate, viewMode]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      const offset = index - CENTER_INDEX;
      const fn = viewMode === 'month' ? addMonths : addWeeks;
      const newDate = fn(baseDate, offset);
      const same =
        viewMode === 'month'
          ? differenceInCalendarMonths(newDate, focusDate) === 0
          : differenceInCalendarWeeks(newDate, focusDate) === 0;
      if (!same) {
        isInternalSwipeRef.current = true;
        setFocusDate(newDate);
      }
    };
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, baseDate, focusDate, viewMode]);

  const handlePrev = () => emblaApi?.scrollPrev();
  const handleNext = () => emblaApi?.scrollNext();

  const handleToggle = () => {
    if (viewMode === 'month') {
      setFocusDate(startOfMonth(focusDate));
      setViewMode('week');
    } else {
      setViewMode('month');
    }
  };

  const weekStart = startOfWeek(focusDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 0 });
  const title =
    viewMode === 'month'
      ? format(focusDate, 'MMMM yyyy')
      : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#333333]">
        <h2 className="text-lg font-bold text-white transition-all duration-200">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <ViewToggle activeMode={viewMode} onToggle={handleToggle} />
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden py-2" ref={emblaRef}>
        <div className="flex h-full" style={{ touchAction: 'pan-y' }}>
          {slides.map((date, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-full w-full"
              style={{ flex: '0 0 100%', minWidth: 0 }}
            >
              <CalendarSlide
                date={date}
                viewMode={viewMode}
                onDayClick={handleDayClick}
                tasks={tasks}
                categoriesMap={categoriesMap}
              />
            </div>
          ))}
        </div>
      </div>
      <FriendDayViewSheet
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        date={selectedDate}
        tasks={tasks}
        categories={categories}
        friendName={friendName}
        currentUserId={currentUserId}
        onReplyToTask={handleReplyToTask}
        onReactToTask={onReactToTask}
      />
      <ReplyComposerSheet
        isOpen={!!replyTask}
        onClose={() => setReplyTask(null)}
        task={replyTask}
        categoryColor={replyColor}
        friendId={friendUserId}
        friendName={friendName}
        onSent={handleReplySent}
      />
      {feedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          {feedback}
        </div>
      )}
    </div>
  );
};