import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import {
  addDays,
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
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

interface TodoCalendarGridProps {
  focusDate: Date;
  selectedDate: Date;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

interface TodoMonthGridProps
  extends Omit<TodoCalendarGridProps, 'tasks' | 'onMonthChange'> {
  monthDate: Date;
  tasksByDate: Map<string, TaskDocument[]>;
  isActive: boolean;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SLIDES_EACH_SIDE = 30;
const CENTER_INDEX = SLIDES_EACH_SIDE;
const TOTAL_SLIDES = SLIDES_EACH_SIDE * 2 + 1;
const RENDER_WINDOW = 1;

const TodoMonthGrid: React.FC<TodoMonthGridProps> = ({
  monthDate,
  selectedDate,
  tasksByDate,
  categories,
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

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  const focusDateButton = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-todo-date="${dateKey}"]`
      );
      target?.focus();
    }, 0);
  }, []);

  return (
    <div
      role={isActive ? 'grid' : undefined}
      aria-label={isActive ? `${format(monthDate, 'MMMM yyyy')} todo calendar` : undefined}
      className="mx-auto w-full max-w-sm rounded-xl bg-transparent px-2 pt-3 pb-0 text-center"
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
              const incompleteCount = dayTasks.reduce(
                (count, task) => count + (task.completed ? 0 : 1),
                0
              );
              const completedCategoryIds = new Set(
                dayTasks
                  .filter((task) => task.completed)
                  .map((task) => task.categoryId)
              );
              const completedColors = orderedCategories
                .filter((category) => completedCategoryIds.has(category.id))
                .slice(0, 4)
                .map((category) => category.color);
              const markerColors = Array.from({ length: 4 }, (_, index) => {
                if (completedColors.length === 0) return '#333333';
                const colorIndex = Math.min(
                  completedColors.length - 1,
                  Math.floor((index * completedColors.length) / 4)
                );
                return completedColors[colorIndex] ?? '#333333';
              });
              const allComplete =
                dayTasks.length > 0 && incompleteCount === 0;

              const handleKeyDown = (
                event: React.KeyboardEvent<HTMLButtonElement>
              ) => {
                const dayOffset =
                  event.key === 'ArrowLeft'
                    ? -1
                    : event.key === 'ArrowRight'
                      ? 1
                      : event.key === 'ArrowUp'
                        ? -7
                        : event.key === 'ArrowDown'
                          ? 7
                          : 0;
                if (dayOffset === 0) return;
                event.preventDefault();
                const nextDate = addDays(day, dayOffset);
                onDateSelect(nextDate);
                focusDateButton(nextDate);
              };

              return (
                <button
                  key={dateKey}
                  type="button"
                  role={isActive ? 'gridcell' : undefined}
                  tabIndex={isActive && selected ? 0 : -1}
                  data-todo-date={dateKey}
                  aria-label={`${dateLabel}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                  aria-selected={isActive ? selected : undefined}
                  aria-current={isActive && isToday(day) ? 'date' : undefined}
                  onClick={() => onDateSelect(day)}
                  onKeyDown={handleKeyDown}
                  className="mx-auto flex h-14 w-10 flex-col items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:bg-[#2A2A2A]"
                >
                  <span
                    data-testid={`todo-status-marker-${dateKey}`}
                    className="relative h-7 w-7 shrink-0"
                    aria-hidden="true"
                  >
                    {markerColors.map((color, index) => (
                      <span
                        key={index}
                        data-testid="todo-status-circle"
                        className={`absolute h-4 w-4 rounded-full ${
                          index === 0
                            ? 'left-0 top-0'
                            : index === 1
                              ? 'right-0 top-0'
                              : index === 2
                                ? 'bottom-0 left-0'
                                : 'bottom-0 right-0'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    {allComplete ? (
                      <Check
                        data-testid="todo-status-complete"
                        size={18}
                        strokeWidth={3}
                        className="absolute inset-0 m-auto text-white drop-shadow"
                      />
                    ) : incompleteCount > 0 ? (
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow">
                        {incompleteCount}
                      </span>
                    ) : null}
                  </span>
                  <span
                    data-testid={`todo-day-number-${dateKey}`}
                    className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-base font-semibold leading-none ${
                      selected
                        ? 'bg-white text-black'
                        : currentMonth
                          ? 'text-gray-300'
                          : 'text-gray-600'
                    }`}
                  >
                    {format(day, 'd')}
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
  categories,
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
          categories={categories}
          categoriesMap={categoriesMap}
          onDateSelect={onDateSelect}
          isActive={isActive}
        />
      );
    },
    [
      activeIndex,
      categories,
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
      <div className="flex will-change-transform">
        {slides.map((monthDate, index) => (
          <div
            key={monthDate.toISOString()}
            aria-hidden={index === activeIndex ? undefined : true}
            className="overflow-hidden"
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
