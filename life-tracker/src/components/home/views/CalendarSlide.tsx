import React from 'react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import type { TaskDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn, CalendarZoomDays, CalendarTaskPreviewLimit } from '../../../lib/preferences';
import type { HolidayOccurrence } from '../../../lib/holidays';

interface CalendarSlideProps {
  date: Date;
  viewMode: CalendarViewMode;
  zoomDays?: CalendarZoomDays;
  taskPreviewLimit?: CalendarTaskPreviewLimit;
  stickyWeekdayHeader?: boolean;
  onZoomMount?: (element: HTMLDivElement, days: number) => void;
  onZoomScroll?: (element: HTMLDivElement, days: number) => void;
  onZoomNavigate?: (direction: 'prev' | 'next') => void;
  navigationLocked?: boolean;
  onDayClick: (date: Date) => void;
  keyboardActive?: boolean;
  keyboardFocusDay?: string;
  tasksByDate: Map<string, TaskDocument[]>;
  sharedByDay?: ReadonlyMap<string, SharedTaskItem[]>;
  ownedSharedTaskIds?: ReadonlySet<string>;
  categoriesMap: Record<string, { color: string; name: string }>;
  weekStartsOn?: WeekStartsOn;
  holidaysByDate?: ReadonlyMap<string, readonly HolidayOccurrence[]>;
}

const CalendarSlideComponent: React.FC<CalendarSlideProps> = ({
  date,
  viewMode,
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
  if (viewMode === 'month') {
    return (
      <MonthView
        focusDate={date}
        zoomDays={zoomDays}
        taskPreviewLimit={taskPreviewLimit}
        stickyWeekdayHeader={stickyWeekdayHeader}
        onZoomMount={onZoomMount}
        onZoomScroll={onZoomScroll}
        onZoomNavigate={onZoomNavigate}
        navigationLocked={navigationLocked}
        onDayClick={onDayClick}
        keyboardActive={keyboardActive}
        keyboardFocusDay={keyboardFocusDay}
        tasksByDate={tasksByDate}
        sharedByDay={sharedByDay}
        ownedSharedTaskIds={ownedSharedTaskIds}
        categoriesMap={categoriesMap}
        weekStartsOn={weekStartsOn}
        holidaysByDate={holidaysByDate}
      />
    );
  }
  return (
    <WeekView
      focusDate={date}
      zoomDays={zoomDays}
      taskPreviewLimit={taskPreviewLimit}
      stickyWeekdayHeader={stickyWeekdayHeader}
      onZoomMount={onZoomMount}
      onZoomScroll={onZoomScroll}
      onZoomNavigate={onZoomNavigate}
      navigationLocked={navigationLocked}
      onDayClick={onDayClick}
      keyboardActive={keyboardActive}
      keyboardFocusDay={keyboardFocusDay}
      tasksByDate={tasksByDate}
      sharedByDay={sharedByDay}
      ownedSharedTaskIds={ownedSharedTaskIds}
      categoriesMap={categoriesMap}
      weekStartsOn={weekStartsOn}
    />
  );
};

export const CalendarSlide = React.memo(CalendarSlideComponent);
CalendarSlide.displayName = 'CalendarSlide';
