import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCarousel } from './CalendarCarousel';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn, CalendarZoomDays, CalendarTaskPreviewLimit } from '../../../lib/preferences';
import { useHolidaysByDate } from '../../../hooks/useHolidays';
import { LazyDayViewSheet } from './dayViewSheetModule';
import {
  DISABLED_HOLIDAY_CONFIG,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

import { LazyFriendDayViewSheet, preloadFriendDayViewSheet } from '../../friend/friendDayViewSheetModule';
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
  zoomPreference?: CalendarZoomDays;
  pinchGestureEnabled?: boolean;
  onZoomPreferenceChange?: (days: CalendarZoomDays) => void;
  taskPreviewLimit?: CalendarTaskPreviewLimit;
  stickyWeekdayHeader?: boolean;
  activeIndex?: number;
  isZoomTransitioning?: boolean;
  onZoomNavigate?: (direction: 'prev' | 'next') => boolean;
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
  zoomPreference = 7,
  pinchGestureEnabled = false,
  onZoomPreferenceChange,
  taskPreviewLimit = 'unlimited',
  stickyWeekdayHeader = false,
  activeIndex,
  isZoomTransitioning,
  onZoomNavigate,
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
  const [calendarWidth, setCalendarWidth] = useState(0);
  const handlePinchChange = useCallback((days: CalendarZoomDays) => {
    // The account-synced setting is the single source of truth.
    onZoomPreferenceChange?.(days);
  }, [onZoomPreferenceChange]);
  const calendarHostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((zoomPreference === 7 && !pinchGestureEnabled) || !isActive) return;
    const host = calendarHostRef.current;
    if (!host) return;
    const measure = () => setCalendarWidth(host.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [zoomPreference, pinchGestureEnabled, isActive]);
  const zoomDays: CalendarZoomDays =
    zoomPreference !== 7 && calendarWidth > 0 && calendarWidth <= 700
      ? zoomPreference
      : 7;

  const allowPinch = pinchGestureEnabled && isActive && calendarWidth > 0 && calendarWidth <= 700;

  // Match owner Day View: warm a resolved component after the friend Calendar
  // becomes usable. No friend hooks or sheets are mounted by this preload.
  useEffect(() => {
    if (variant !== 'friend' || !isActive) return;
    const warm = () => {
      if (!document.hidden) void preloadFriendDayViewSheet().catch(() => {});
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(warm, 700);
    return () => clearTimeout(id);
  }, [variant, isActive]);

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
    if (variant === 'friend') void preloadFriendDayViewSheet().catch(() => {});
    setSelectedDate(date);
    setDaySheetMounted(true);
    setDaySheetOpen(true);
  }, [variant]);

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
      zoomDays={zoomDays}
      pinchEnabled={allowPinch}
      onPinchChange={handlePinchChange}
      taskPreviewLimit={taskPreviewLimit}
      stickyWeekdayHeader={stickyWeekdayHeader}
      activeIndex={activeIndex}
      isZoomTransitioning={isZoomTransitioning}
      onZoomNavigate={onZoomNavigate}
      onPrev={onPrev}
      onNext={onNext}
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
    <div ref={calendarHostRef} className="flex min-h-0 min-w-0 flex-1 flex-col"
      onPointerDownCapture={variant === 'friend' ? () => { void preloadFriendDayViewSheet().catch(() => {}); } : undefined}>
      {content}
    </div>
  );

  if (variant === 'friend' && friendName && friendUserId) {
    return (
      <>
        {calendarContent(carousel)}
        {daySheetMounted && (
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
        <LazyDayViewSheet
          isOpen={daySheetOpen}
          onClose={handleCloseDaySheet}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          tasks={tasks}
          categories={categories ?? []}
          holidayConfig={holidayConfig}
        />
      )}
    </>
  );
};

export const CalendarBody = React.memo(CalendarBodyComponent);
CalendarBody.displayName = 'CalendarBody';
