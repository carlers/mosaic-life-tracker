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
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
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

const LazyCalendarWallpaperBackdrop = React.lazy(() => import('./CalendarWallpaperBackdrop'));

const { Component: LazyDayDetailPanel, preload: preloadDayDetailPanel } =
  createPreloadedLazy(() => import('./DayDetailPanel').then(({ DayDetailPanel }) => DayDetailPanel));

const EMPTY_CALENDAR_CATEGORY_IDS: readonly string[] = [];

interface CalendarBodyProps {
  viewMode: CalendarViewMode;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  emblaRef: (node: HTMLElement | null) => void;
  onCalendarLayoutChange?: (live?: boolean) => void | Promise<void>;
  tasks: TaskDocument[];
  calendarCategoryIds?: readonly string[];
  query?: string;
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
  wallpaperEnabled?: boolean;
  wallpaperInHome?: boolean;
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

const CalendarBodyComponent: React.FC<CalendarBodyProps> = (input) => {
  const {
  viewMode,
  slides,
  renderStart,
  renderEnd,
  emblaRef,
  onCalendarLayoutChange,
  tasks,
  calendarCategoryIds = EMPTY_CALENDAR_CATEGORY_IDS,
  query = '',
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
  wallpaperEnabled = false,
  wallpaperInHome = false,
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
  } = input;
  const calendarPinchZoomEnabled = useFeatureEnabled('mosaic_disable_calendar_pinch_zoom');
  const calendarTaskPreviewsEnabled = useFeatureEnabled('mosaic_disable_calendar_task_previews');
  const hasWallpaper = variant === 'me' && isActive && wallpaperEnabled;
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

  const allowPinch = calendarPinchZoomEnabled && pinchGestureEnabled && isActive && calendarWidth > 0 && calendarWidth <= 700;

  const tasksByDate = useTasksByDate(tasks, calendarCategoryIds, query);
  const holidayYears = useMemo(() => {
    const years = new Set<number>();
    for (let index = renderStart; index <= renderEnd; index += 1) {
      const date = slides[index];
      if (!date) continue;
      const year = date.getFullYear();
      years.add(year);
      const month = date.getMonth();
      if (month === 0 || month === 11) years.add(year + (month === 0 ? -1 : 1));
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

  const { enabled: shortcutsEnabled } = useKeyboardShortcuts();
  const keyboardEnabled = isActive && (!daySheetOpen || openPresentation === 'panel') && !replyTask;
  const {
    rootRef: keyboardRootRef,
    onKeyDown: handleGridKeyDown,
    onFocusCapture: handleGridFocus,
    activeKey: keyboardActiveKey,
  } = useCalendarGridKeyboard({
    enabled: keyboardEnabled,
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
    if (main?.scrollTop) main.scrollTop = 0;
  }, [isActive]);

  useHorizontalArrowNavigation({
    enabled: isActive && !daySheetOpen && !replyTask,
    onLeft: onPrev,
    onRight: onNext,
  });

  const carousel = (
    <CalendarCarousel {...input}
      zoomDays={zoomDays}
      pinchEnabled={allowPinch}
      onPinchChange={onZoomPreferenceChange}
      taskPreviewLimit={calendarTaskPreviewsEnabled ? taskPreviewLimit : 0}
      onDayClick={handleDayClick}
      keyboardEnabled={keyboardEnabled}
      gestureShortcutsEnabled={variant === 'me' && isActive && !daySheetOpen && !replyTask && !isZoomTransitioning}
      keyboardFocusDay={keyboardActiveKey}
      tasksByDate={tasksByDate}
      sharedByDay={variant === 'me' && !calendarCategoryIds.length && !query.trim() ? sharedByDay : undefined}
      ownedSharedTaskIds={variant === 'me' ? ownedSharedTaskIds : undefined}
      holidaysByDate={holidaysByDate}
    />
  );

  const calendarContent = (
    <div ref={setCalendarHost} className={`flex min-h-0 min-w-0 flex-1 flex-col ${hasWallpaper ? 'relative isolate' : ''}`}
      data-calendar-wallpaper={hasWallpaper ? 'true' : undefined}
      data-calendar-keyboard-owned="true"
      data-calendar-primary-active={isActive ? 'true' : undefined}
      onKeyDown={handleGridKeyDown}
      onFocusCapture={handleGridFocus}
      onPointerEnter={dayDetailPresentation === 'panel' ? () => {
        void preloadDayDetailPanel().catch(() => {});
      } : undefined}
      onPointerDownCapture={() => {
        if (dayDetailPresentation === 'panel') void preloadDayDetailPanel().catch(() => {});
        if (variant === 'friend') void preloadFriendDayViewSheet().catch(() => {});
      }}>
      {hasWallpaper && !wallpaperInHome && <React.Suspense fallback={null}>
        <LazyCalendarWallpaperBackdrop />
      </React.Suspense>}
      {carousel}
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
            }}
            initialHeightMode={dayPanelHeight}
            onCalendarLayoutChange={onCalendarLayoutChange}
            initialFrameWidth={openedFrameWidth}
            frameRef={panelHostRef}
            onClose={handleCloseDaySheet}
            onFocusCalendar={() => calendarTriggerRef.current?.focus({ preventScroll: true })}
            isFriend={isFriend}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            tasks={tasks}
            categories={isFriend ? friendCategories ?? [] : categories ?? []}
            friendName={friendName}
            currentUserId={currentUserId}
            onReplyToTask={handleReplyToTask}
            onReactToTask={onReactToTask}
            holidayConfig={holidayConfig}
          />
  );
  return (
    <>
    <div ref={panelHostRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mosaic-calendar-split flex h-full min-h-0 min-w-0 w-full">
        {detailPanel}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {calendarContent}
        </div>
      </div>
    </div>

      {daySheetMounted && openPresentation === 'sheet' && (isFriend ? (
        <LazyFriendDayViewSheet
          isOpen={daySheetOpen}
          onClose={handleCloseDaySheet}
          date={selectedDate}
          onDateChange={setSelectedDate}
          tasks={tasks}
          categories={friendCategories ?? []}
          friendName={friendName ?? ''}
          currentUserId={currentUserId}
          onReplyToTask={handleReplyToTask}
          onReactToTask={onReactToTask}
          holidayConfig={holidayConfig}
        />
      ) : (
        <LazyDayViewSheet
          isOpen={daySheetOpen}
          onClose={handleCloseDaySheet}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          tasks={tasks}
          categories={categories ?? []}
          holidayConfig={holidayConfig}
        />
      ))}
      {isFriend && <React.Suspense fallback={null}>
        <LazyReplyComposerSheet
          isOpen={!!replyTask} onClose={closeReply} task={replyTask}
          categoryColor={replyColor} friendId={friendUserId ?? ''}
          friendName={friendName ?? ''} onSent={handleReplySent}
        />
      </React.Suspense>}
      {isFriend && feedback && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {feedback}
        </div>
      )}
    </>
  );
};

export const CalendarBody = React.memo(CalendarBodyComponent);
CalendarBody.displayName = 'CalendarBody';
