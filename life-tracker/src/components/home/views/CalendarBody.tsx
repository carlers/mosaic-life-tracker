import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarCarousel } from './CalendarCarousel';
import { DayDetailPanel } from './DayDetailPanel';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';
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
  dayDetailPresentation?: 'sheet' | 'panel';
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
  dayDetailPresentation = 'sheet',
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
  const [openPresentation, setOpenPresentation] = useState<'sheet' | 'panel'>('sheet');
  const [availableWidth, setAvailableWidth] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const calendarTriggerRef = useRef<HTMLElement | null>(null);

  // Measure the actual Home frame; Comfortable caps at 960px even on desktops.
  useLayoutEffect(() => {
    if (dayDetailPresentation !== 'panel' || !isActive || !hostRef.current) return;
    const host = hostRef.current;
    const measure = () => setAvailableWidth(host.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [dayDetailPresentation, isActive]);

  useEffect(() => {
    if (!isActive) setDaySheetOpen(false);
  }, [isActive]);


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

    if (document.activeElement instanceof HTMLElement) {
      calendarTriggerRef.current = document.activeElement;
    }
    if (!daySheetOpen) setOpenPresentation(
      dayDetailPresentation === 'panel' && availableWidth >= 1040 ? 'panel' : 'sheet'
    );
    setSelectedDate(date);
    setDaySheetMounted(true);
    setDaySheetOpen(true);
  }, [variant, daySheetOpen, dayDetailPresentation, availableWidth]);

  const handleCloseDaySheet = useCallback(() => {
    setDaySheetOpen(false);
    if (isActive) {
      window.requestAnimationFrame(() => {
        if (calendarTriggerRef.current?.isConnected) calendarTriggerRef.current.focus({ preventScroll: true });
      });
    }
  }, [isActive]);

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
      sharedByDay={variant === 'me' ? sharedByDay : undefined}
      ownedSharedTaskIds={variant === 'me' ? ownedSharedTaskIds : undefined}
      categoriesMap={categoriesMap}
      weekStartsOn={weekStartsOn}
      holidaysByDate={holidaysByDate}
    />
  );

  const isFriend = variant === 'friend' && Boolean(friendName && friendUserId);
  const panelOpen = daySheetOpen && openPresentation === 'panel' && isActive;
  const detail = isFriend ? (
    <LazyFriendDayViewSheet
      isOpen={daySheetOpen}
      onClose={handleCloseDaySheet}
      date={selectedDate}
      onDateChange={handleDateChange}
      tasks={tasks}
      categories={friendCategories ?? []}
      friendName={friendName ?? ''}
      currentUserId={currentUserId}
      onReplyToTask={handleReplyToTask}
      onReactToTask={onReactToTask}
      holidayConfig={holidayConfig}
      renderMode="panel"
    />
  ) : (
    <LazyDayViewSheet
      isOpen={daySheetOpen}
      onClose={handleCloseDaySheet}
      selectedDate={selectedDate}
      onDateChange={handleDateChange}
      tasks={tasks}
      categories={categories ?? []}
      holidayConfig={holidayConfig}
      renderMode="panel"
    />
  );

  const calendarAndPanel = (
    <div ref={hostRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`flex h-full min-h-0 min-w-0 w-full ${panelOpen && availableWidth >= 1040 ? 'gap-3' : ''}`}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col"
          onPointerDownCapture={isFriend ? () => { void preloadFriendDayViewSheet().catch(() => {}); } : undefined}>
          {carousel}
        </div>
        {panelOpen && (
          <div className={availableWidth >= 1040
            ? 'h-full min-h-0 w-[min(42%,440px)] shrink-0 p-2 pl-0'
            : 'absolute inset-y-0 right-0 z-20 w-[min(100%,440px)] bg-surface p-2'}>
            <DayDetailPanel onClose={handleCloseDaySheet}
              onFocusCalendar={() => calendarTriggerRef.current?.focus({ preventScroll: true })}>
              {detail}
            </DayDetailPanel>
          </div>
        )}
      </div>
    </div>
  );

  if (isFriend) {
    return (
      <>
        {calendarAndPanel}
        {daySheetMounted && openPresentation === 'sheet' && (
          <LazyFriendDayViewSheet
            isOpen={daySheetOpen}
            onClose={handleCloseDaySheet}
            date={selectedDate}
            onDateChange={handleDateChange}
            tasks={tasks}
            categories={friendCategories ?? []}
            friendName={friendName ?? ''}
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
            friendId={friendUserId ?? ''}
            friendName={friendName ?? ''}
            onSent={handleReplySent}
          />
        </React.Suspense>
        {feedback && (
          <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm">
            {feedback}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {calendarAndPanel}
      {daySheetMounted && openPresentation === 'sheet' && (
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
