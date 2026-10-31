import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarCarousel } from './CalendarCarousel';
import { createPreloadedLazy } from '../../../lib/createPreloadedLazy';

import { DAY_PANEL_MIN_FRAME_WIDTH, type DayPanelSide } from '../../../lib/dayPanelLayout';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';
import { useCalendarGridKeyboard } from './useCalendarGridKeyboard';
import { useKeyboardShortcuts } from '../../../hooks/keyboardShortcutsContext';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn, CalendarZoomDays, CalendarTaskPreviewLimit, DayPanelHeight } from '../../../lib/preferences';
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

const { Component: LazyDayDetailPanel } =
  createPreloadedLazy(() => import('./DayDetailPanel').then(({ DayDetailPanel }) => DayDetailPanel));

interface CalendarBodyProps {
  viewMode: CalendarViewMode;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  onCalendarLayoutChange?: (live?: boolean) => void | Promise<void>;
  tasks: TaskDocument[];
  categories?: CategoryDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  variant: 'me' | 'friend';
  dayDetailPresentation?: 'sheet' | 'panel';
  dayPanelSide?: DayPanelSide;
  dayPanelHeight?: DayPanelHeight;
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
  onCalendarLayoutChange,
  tasks,
  categories,
  categoriesMap,
  variant,
  dayDetailPresentation = 'sheet',
  dayPanelSide = 'right',
  dayPanelHeight = 'grid',
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
  const [openedFrameWidth, setOpenedFrameWidth] = useState(0);
  const openPresentation = openedFrameWidth >= DAY_PANEL_MIN_FRAME_WIDTH ? dayDetailPresentation : 'sheet';
  const [panelMounted, setPanelMounted] = useState(false);
  const panelHostRef = useRef<HTMLDivElement>(null);
  const calendarTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isActive) return;
    const timer = window.setTimeout(() => {
      setDaySheetOpen(false);
      setPanelMounted(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isActive]);
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
    if (document.activeElement instanceof HTMLElement) calendarTriggerRef.current = document.activeElement;
    if (!daySheetOpen) {
      const host = panelHostRef.current;
      const width = (dayPanelHeight === 'screen'
        ? host?.closest('.mosaic-home-workspace') ?? host : host)?.getBoundingClientRect().width ?? 0;
      setOpenedFrameWidth(width);
      setPanelMounted(true);
    }
    setSelectedDate(date);
    setDaySheetMounted(true);
    setDaySheetOpen(true);
  }, [daySheetOpen, dayPanelHeight]);

  const handleCloseDaySheet = useCallback(() => {
    setDaySheetOpen(false);
    if (isActive) window.requestAnimationFrame(() => {
      if (calendarTriggerRef.current?.isConnected) calendarTriggerRef.current.focus({ preventScroll: true });
    });
  }, [isActive]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const { enabled: shortcutsEnabled } = useKeyboardShortcuts();
  const {
    rootRef: keyboardRootRef,
    onKeyDown: handleGridKeyDown,
    onFocusCapture: handleGridFocus,
    activeKey: keyboardActiveKey,
  } = useCalendarGridKeyboard({
    enabled: isActive && (!daySheetOpen || openPresentation === 'panel') && !replyTask,
    singleKeyShortcutsEnabled: shortcutsEnabled,
    slides, activeIndex: activeIndex ?? 30, viewMode, weekStartsOn, onPrev, onNext,
  });
  const setCalendarHost = useCallback((node: HTMLDivElement | null) => {
    calendarHostRef.current = node;
    keyboardRootRef.current = node;
  }, [keyboardRootRef]);

  // Returning from Todo/Diary can leave the outer Home page scrolled.
  // Month/Week Calendar owns vertical scrolling inside its active slide,
  // so re-anchor the page before the calendar is painted.
  useLayoutEffect(() => {
    if (!isActive) return;
    const main = calendarHostRef.current?.closest<HTMLElement>('[data-mosaic-main-scroll="true"]');
    if (main && main.scrollTop !== 0) main.scrollTop = 0;
  }, [isActive]);

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
      keyboardEnabled={isActive && (!daySheetOpen || openPresentation === 'panel') && !replyTask}
      keyboardFocusDay={keyboardActiveKey}
      tasksByDate={tasksByDate}
      sharedByDay={variant === 'me' ? sharedByDay : undefined}
      ownedSharedTaskIds={variant === 'me' ? ownedSharedTaskIds : undefined}
      categoriesMap={categoriesMap}
      weekStartsOn={weekStartsOn}
      holidaysByDate={holidaysByDate}
    />
  );

  const calendarContent = (content: React.ReactNode) => (
    <div ref={setCalendarHost} className="flex min-h-0 min-w-0 flex-1 flex-col"
      data-calendar-keyboard-owned="true"
      data-calendar-primary-active={isActive ? 'true' : undefined}
      onKeyDown={handleGridKeyDown}
      onFocusCapture={handleGridFocus}
      onPointerDownCapture={variant === 'friend' ? () => { void preloadFriendDayViewSheet().catch(() => {}); } : undefined}>
      {content}
    </div>
  );

  const isFriend = variant === 'friend' && Boolean(friendName && friendUserId);
  const panelOpen = panelMounted && openPresentation === 'panel' && isActive;

  const detailPanel = panelOpen && (
          <LazyDayDetailPanel
            side={dayPanelSide}
            isPresented={daySheetOpen}
            onExited={() => {
              setPanelMounted(false);
              requestAnimationFrame(() => onCalendarLayoutChange?.());
            }}
            initialHeightMode={dayPanelHeight}
            onCalendarLayoutChange={onCalendarLayoutChange}
            initialFrameWidth={openedFrameWidth}
            frameRef={panelHostRef}
            onClose={handleCloseDaySheet}
            onFocusCalendar={() => calendarTriggerRef.current?.focus({ preventScroll: true })}
            isFriend={isFriend}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            tasks={tasks}
            categories={isFriend ? friendCategories ?? [] : categories ?? []}
            friendName={friendName}
            currentUserId={currentUserId}
            onReplyToTask={handleReplyToTask}
            onReactToTask={onReactToTask}
            holidayConfig={holidayConfig}
          />
  );
  const calendarAndPanel = (
    <div ref={panelHostRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mosaic-calendar-split flex h-full min-h-0 min-w-0 w-full">
        {detailPanel}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {calendarContent(carousel)}
        </div>
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
            isOpen={!!replyTask} onClose={closeReply} task={replyTask}
            categoryColor={replyColor} friendId={friendUserId ?? ''}
            friendName={friendName ?? ''} onSent={handleReplySent}
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
