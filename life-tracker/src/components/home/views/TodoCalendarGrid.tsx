import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  differenceInCalendarMonths,
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
import useEmblaCarousel from 'embla-carousel-react';
import type { TaskDocument } from '../../../db/schema';

interface TodoCalendarGridProps {
  focusDate: Date;
  selectedDate: Date;
  tasks: TaskDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

interface TodoMonthGridProps extends Omit<TodoCalendarGridProps, 'tasks' | 'onMonthChange'> {
  monthDate: Date;
  tasksByDate: Map<string, TaskDocument[]>;
  isActive: boolean;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SLIDES_EACH_SIDE = 30;
const CENTER_INDEX = SLIDES_EACH_SIDE;
const TOTAL_SLIDES = SLIDES_EACH_SIDE * 2 + 1;
const RENDER_WINDOW = 2;

const TodoMonthGrid: React.FC<TodoMonthGridProps> = ({
  monthDate,
  selectedDate,
  tasksByDate,
  categoriesMap,
  onDateSelect,
  isActive,
}) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(endOfMonth(monthStart)),
    });
  }, [monthDate]);

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let index = 0; index < calendarDays.length; index += 7) {
      weeks.push(calendarDays.slice(index, index + 7));
    }
    return weeks;
  }, [calendarDays]);

  return (
    <div
      role={isActive ? 'grid' : undefined}
      aria-label={isActive ? `${format(monthDate, 'MMMM yyyy')} todo calendar` : undefined}
      className="w-full rounded-xl bg-transparent px-3 pt-3 pb-0"
    >
      <div className="mb-2 grid grid-cols-7" role={isActive ? 'row' : undefined}>
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            role={isActive ? 'columnheader' : undefined}
            className="text-center text-[10px] font-medium text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid gap-y-2" role={isActive ? 'rowgroup' : undefined}>
        {calendarWeeks.map((week) => (
          <div
            key={format(week[0], 'yyyy-MM-dd')}
            className="grid grid-cols-7"
            role={isActive ? 'row' : undefined}
          >
            {week.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate.get(dateKey) ?? [];
              const selected = isSameDay(day, selectedDate);
              const currentMonth = isSameMonth(day, monthDate);
              const dateLabel = format(day, 'EEEE, MMMM d, yyyy');

              return (
                <button
                  key={dateKey}
                  type="button"
                  role={isActive ? 'gridcell' : undefined}
                  tabIndex={isActive ? 0 : -1}
                  aria-label={`${dateLabel}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                  aria-selected={isActive ? selected : undefined}
                  aria-current={isActive && isToday(day) ? 'date' : undefined}
                  onClick={() => onDateSelect(day)}
                  className={`mx-auto flex min-h-10 w-9 flex-col items-center rounded-lg pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                    selected
                      ? 'bg-white text-black'
                      : currentMonth
                        ? 'text-gray-300 hover:bg-[#2A2A2A]'
                        : 'text-gray-600'
                  }`}
                >
                  <span className="text-xs font-semibold">{format(day, 'd')}</span>
                  <span
                    className="mt-1 flex max-w-7 flex-wrap justify-center gap-0.5"
                    aria-hidden="true"
                  >
                    {dayTasks.slice(0, 4).map((task) => (
                      <span
                        key={task.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            categoriesMap[task.categoryId]?.color ?? '#6B7280',
                        }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const TodoCalendarGrid: React.FC<TodoCalendarGridProps> = ({
  focusDate,
  selectedDate,
  tasks,
  categoriesMap,
  onDateSelect,
  onMonthChange,
}) => {
  const [baseDate] = useState(() => new Date(focusDate));
  const [activeIndex, setActiveIndex] = useState(CENTER_INDEX);
  const slides = useMemo(
    () =>
      Array.from({ length: TOTAL_SLIDES }, (_, index) =>
        addMonths(baseDate, index - CENTER_INDEX)
      ),
    [baseDate]
  );

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

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    skipSnaps: false,
    startIndex: CENTER_INDEX,
  });

  useEffect(() => {
    if (!emblaApi) return;

    const targetIndex =
      CENTER_INDEX + differenceInCalendarMonths(focusDate, baseDate);
    if (targetIndex < 0 || targetIndex >= TOTAL_SLIDES) return;

    if (emblaApi.selectedScrollSnap() !== targetIndex) {
      emblaApi.scrollTo(targetIndex, true);
    }
  }, [baseDate, emblaApi, focusDate]);

  useEffect(() => {
    if (!emblaApi) return;

    const handleSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setActiveIndex(index);
      const nextDate = slides[index];
      if (differenceInCalendarMonths(nextDate, focusDate) !== 0) {
        onMonthChange(nextDate);
      }
    };

    emblaApi.on('select', handleSelect);
    return () => {
      emblaApi.off('select', handleSelect);
    };
  }, [emblaApi, focusDate, onMonthChange, slides]);

  const renderSlide = useCallback(
    (monthDate: Date, index: number) => {
      const inWindow = Math.abs(index - activeIndex) <= RENDER_WINDOW;
      if (!inWindow) return null;

      const isActive = index === activeIndex;
      return (
        <TodoMonthGrid
          monthDate={monthDate}
          focusDate={focusDate}
          selectedDate={selectedDate}
          tasksByDate={tasksByDate}
          categoriesMap={categoriesMap}
          onDateSelect={onDateSelect}
          isActive={isActive}
        />
      );
    },
    [
      activeIndex,
      categoriesMap,
      focusDate,
      onDateSelect,
      selectedDate,
      tasksByDate,
    ]
  );

  return (
    <div
      ref={emblaRef}
      className="swiper-no-swiping w-full min-w-0 max-w-full shrink-0 overflow-hidden touch-pan-y"
      data-testid="todo-calendar-grid"
    >
      <div className="flex">
        {slides.map((monthDate, index) => (
          <div
            key={monthDate.toISOString()}
            aria-hidden={index === activeIndex ? undefined : true}
            style={{
              flex: '0 0 100%',
              minWidth: 0,
              touchAction: 'pan-y',
            }}
          >
            {renderSlide(monthDate, index)}
          </div>
        ))}
      </div>
    </div>
  );
};
