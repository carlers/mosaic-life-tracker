import React, { useMemo, useRef } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import { DayCell } from './DayCell';
import { CalendarZoomViewport } from './CalendarZoomViewport';
import { EMPTY_TASKS } from '../../../constants/empty';
import type { TaskDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { WeekStartsOn, CalendarZoomDays, CalendarTaskPreviewLimit } from '../../../lib/preferences';
import type { HolidayOccurrence } from '../../../lib/holidays';

interface MonthViewProps {
  focusDate: Date;
  zoomDays?: CalendarZoomDays;
  taskPreviewLimit?: CalendarTaskPreviewLimit | 0;
  stickyWeekdayHeader?: boolean;
  onZoomMount?: (element: HTMLDivElement, days: number) => void;
  onZoomScroll?: (element: HTMLDivElement, days: number) => void;
  onZoomNavigate?: (direction: 'prev' | 'next') => void;
  navigationLocked?: boolean;
  onDayClick?: (date: Date) => void;
  keyboardActive?: boolean;
  keyboardFocusDay?: string;
  tasksByDate: Map<string, TaskDocument[]>;
  sharedByDay?: ReadonlyMap<string, SharedTaskItem[]>;
  ownedSharedTaskIds?: ReadonlySet<string>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
  holidaysByDate?: ReadonlyMap<string, readonly HolidayOccurrence[]>;
}

const WEEKDAY_LABELS = [
  ['Sun', 'Sunday'],
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
] as const;

export const MonthView: React.FC<MonthViewProps> = ({
  focusDate,
  zoomDays = 7,
  taskPreviewLimit = 'unlimited',
  stickyWeekdayHeader = false,
  onZoomMount,
  onZoomScroll,
  onZoomNavigate,
  navigationLocked,
  onDayClick,
  keyboardActive = false,
  keyboardFocusDay,
  tasksByDate,
  sharedByDay,
  ownedSharedTaskIds,
  categoriesMap,
  weekStartsOn = 0,
  holidaysByDate,
}) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(focusDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn });
    const endDate = endOfWeek(monthEnd, { weekStartsOn });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [focusDate, weekStartsOn]);

  const weekdayLabels = useMemo(
    () =>
      weekStartsOn === 0
        ? WEEKDAY_LABELS
        : [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]],
    [weekStartsOn]
  );

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let index = 0; index < calendarDays.length; index += 7) {
      weeks.push(calendarDays.slice(index, index + 7));
    }
    return weeks;
  }, [calendarDays]);


  // The vertical scroller is each CalendarCarousel slide. Keep the pinned row
  // outside the nested horizontal zoom lane so CSS sticky uses that scroller.
  // Synchronize its weekday columns imperatively; never update React on scroll.
  const weekdayHeaderRef = useRef<HTMLDivElement>(null);
  const syncWeekdayHeader = (node: HTMLDivElement) => {
    if (stickyWeekdayHeader && weekdayHeaderRef.current)
      weekdayHeaderRef.current.style.transform = `translate3d(${-node.scrollLeft}px, 0, 0)`;
  };
  const handleZoomMount = (node: HTMLDivElement, days: number) => {
    onZoomMount?.(node, days);
    syncWeekdayHeader(node);
  };
  const handleZoomScroll = (node: HTMLDivElement, days: number) => {
    syncWeekdayHeader(node);
    onZoomScroll?.(node, days);
  };
  const weekdayRow = (
      <div
        ref={stickyWeekdayHeader ? weekdayHeaderRef : undefined}
        className="grid grid-cols-7 gap-1 px-2 mb-1"
        role="row"
        style={stickyWeekdayHeader && zoomDays !== 7
          ? { width: `${(7 / zoomDays) * 100}%` }
          : undefined}
      >
        {weekdayLabels.map(([shortLabel, fullLabel]) => (
          <div
            key={shortLabel}
            role="columnheader"
            aria-label={fullLabel}
            className="mosaic-weekday-header text-center text-[10px] font-medium text-gray-400 py-1"
          >
            {shortLabel}
          </div>
        ))}
      </div>
  );
  const pinnedHeader = stickyWeekdayHeader ? (
    <div className="sticky top-0 z-10 overflow-hidden bg-background" data-sticky-weekday-header="true">
      {weekdayRow}
    </div>
  ) : weekdayRow;
  const dayRows = (
      <div
        className="grid grid-cols-7 gap-1 px-2 auto-rows-max"
        role="rowgroup"
      >
        {calendarWeeks.map((week) => (
          <div
            key={format(week[0], 'yyyy-MM-dd')}
            role="row"
            className="col-span-7 grid grid-cols-7 gap-1"
          >
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              return (
                <div
                  key={dateStr}
                  role="gridcell"
                  className="mosaic-calendar-gridcell min-w-0 min-h-0 h-full"
                >
                  <DayCell
                    date={day}
                    taskPreviewLimit={taskPreviewLimit}
                    tasks={tasksByDate.get(dateStr) ?? EMPTY_TASKS}
                    sharedItems={sharedByDay?.get(dateStr)}
                    ownedSharedTaskIds={ownedSharedTaskIds}
                    categories={categoriesMap}
                    holidays={holidaysByDate?.get(dateStr)}
                    isCurrentMonth={isSameMonth(day, focusDate)}
                    onDayClick={onDayClick}
                    keyboardTabIndex={keyboardActive && keyboardFocusDay === dateStr ? 0 : -1}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
  );
  const grid = (
    <div className="flex flex-col min-h-full" role="grid" aria-label={`${format(focusDate, 'MMMM yyyy')} calendar`}
      aria-description="Use arrow keys to move between dates, Home and End for week edges, Page Up and Down for months, and Enter to open a day.">
      {pinnedHeader}
      {stickyWeekdayHeader && zoomDays !== 7 ? (
        <CalendarZoomViewport zoomDays={zoomDays}
          onZoomMount={handleZoomMount} onZoomScroll={handleZoomScroll}
          onNavigate={onZoomNavigate} navigationLocked={navigationLocked}>
          {dayRows}
        </CalendarZoomViewport>
      ) : dayRows}
    </div>
  );
  return zoomDays === 7 || stickyWeekdayHeader ? grid : (
    <CalendarZoomViewport zoomDays={zoomDays}
      onZoomMount={onZoomMount} onZoomScroll={onZoomScroll}
      onNavigate={onZoomNavigate} navigationLocked={navigationLocked}>
      {grid}
    </CalendarZoomViewport>
  );
};
