import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { ViewToggle } from './ViewToggle';
import { DayViewSheet } from './DayViewSheet';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

export type CalendarViewMode = 'month' | 'week';

const SLIDES_EACH_SIDE = 30;
const TOTAL_SLIDES = SLIDES_EACH_SIDE * 2 + 1;
const CENTER_INDEX = SLIDES_EACH_SIDE;

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

export const CalendarView: React.FC = () => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate, setFocusDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { tasks } = useTasks();
  const { categories } = useCategories();

  const categoriesMap = useMemo(() => {
    return categories.reduce(
      (
        acc: Record<string, { color: string; name: string }>,
        cat: CategoryDocument
      ) => {
        acc[cat.id] = { color: cat.color, name: cat.name };
        return acc;
      },
      {}
    );
  }, [categories]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const t of tasks) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }, [tasks]);

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

  const handlePrev = () => {
    emblaApi?.scrollPrev();
  };
  const handleNext = () => {
    emblaApi?.scrollNext();
  };

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
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
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
                tasksByDate={tasksByDate}
                categoriesMap={categoriesMap}
              />
            </div>
          ))}
        </div>
      </div>
      <DayViewSheet
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        selectedDate={selectedDate || new Date()}
        onDateChange={setSelectedDate}
      />
    </div>
  );
};
