import React, { lazy, Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  format,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { DayViewSheet } from './DayViewSheet';
import { FriendDayViewSheet } from '../../friend/FriendDayViewSheet';
import { useFriendTaskReply } from '../../../hooks/useFriendTaskReply';
import { TodoCalendarGrid } from './TodoCalendarGrid';
import { createPreloadedLazy } from '../../../lib/createPreloadedLazy';
import { DAY_PANEL_MIN_FRAME_WIDTH } from '../../../lib/dayPanelLayout';
import { DiaryDayCard } from './DiaryDayPreview';
import { useSettings } from '../../../hooks/useSettings';
import {
  DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, DIARY_DAY_VIEW_POSITION_SETTING_KEY,
  SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, resolveDiaryDayViewHeight, resolveDiaryDayViewPosition,
  DAY_DETAIL_PRESENTATION_SETTING_KEY, DAY_PANEL_SIDE_SETTING_KEY, DAY_PANEL_HEIGHT_SETTING_KEY,
  resolveDayDetailPresentation, resolveDayPanelHeight,
} from '../../../lib/preferences';
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { WeekStartsOn } from '../../../lib/preferences';
import {
  DISABLED_HOLIDAY_CONFIG,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

const { Component: LazyDayDetailPanel } = createPreloadedLazy(() =>
  import('./DayDetailPanel').then(m => m.DayDetailPanel));

const ReplyComposerSheet = lazy(() =>
  import('../../messages/ReplyComposerSheet').then(({ ReplyComposerSheet }) => ({
    default: ReplyComposerSheet,
  }))
);

interface TodoListViewProps {
  focusDate: Date;
  tasks: TaskDocument[];
  sharedByDay?: ReadonlyMap<string, SharedTaskItem[]>;
  ownedSharedTaskIds?: ReadonlySet<string>;
  categories: CategoryDocument[];
  categoriesMap: Record<string, { color: string; name: string }>;
  onFocusDateChange: (date: Date) => void;
  variant?: 'me' | 'friend';
  friendName?: string;
  friendUserId?: string;
  currentUserId?: string;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  weekStartsOn?: WeekStartsOn;
  holidayConfig?: HolidayDisplayConfig;
  markerMode?: 'todo' | 'diary';
  diaryEntries?: readonly DiaryDocument[];
  onOpenDiary?: (date: Date) => void;
}

export const TodoListView: React.FC<TodoListViewProps> = ({
  focusDate,
  tasks,
  sharedByDay,
  ownedSharedTaskIds,
  categories,
  categoriesMap,
  onFocusDateChange,
  variant = 'me',
  friendName = '',
  friendUserId = '',
  currentUserId = '',
  onReactToTask,
  weekStartsOn = 0,
  holidayConfig = DISABLED_HOLIDAY_CONFIG,
  markerMode = 'todo',
  diaryEntries = [],
  onOpenDiary,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(focusDate));
  const { getSetting, setSetting } = useSettings();
  const dayPresentation = resolveDayDetailPresentation(getSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet'));
  const dayPanelSide = getSetting(DAY_PANEL_SIDE_SETTING_KEY, 'right') === 'left' ? 'left' : 'right';
  const dayPanelHeight = resolveDayPanelHeight(getSetting(DAY_PANEL_HEIGHT_SETTING_KEY, 'grid'));
  const frameRef = useRef<HTMLDivElement>(null);
  const todoRealignRef = useRef<((live?: boolean) => void) | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const bindTodoRealign = useCallback((callback: ((live?: boolean) => void) | null) => {
    todoRealignRef.current = callback;
  }, []);
  const realignTodoCalendar = useCallback((live = false) => {
    todoRealignRef.current?.(live);
  }, []);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const host = dayPanelHeight === 'screen'
      ? frame.closest('.mosaic-home-workspace') ?? frame : frame;
    const measure = () => setFrameWidth(host.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [dayPanelHeight]);
  const sidePanelOpen = dayPresentation === 'panel' && frameWidth >= DAY_PANEL_MIN_FRAME_WIDTH;
  const showBottom = !sidePanelOpen;
  const restoreBottom = useCallback(() => {
    void setSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet');
  }, [setSetting]);
  const showFriendDiaryCard = variant === 'friend' &&
    (markerMode === 'diary' || getSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, false) === true);
  const friendDiaryPosition = resolveDiaryDayViewPosition(getSetting(DIARY_DAY_VIEW_POSITION_SETTING_KEY, 'top'));
  const friendDiaryExpanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  const friendEntry = diaryEntries.find(item => item.date === format(selectedDate, 'yyyy-MM-dd'));
  const friendDiaryCard = showFriendDiaryCard && friendEntry && onOpenDiary ? (
    <div className="my-2 px-4"><DiaryDayCard entry={friendEntry} expanded={friendDiaryExpanded} onOpen={() => onOpenDiary(selectedDate)}/></div>
  ) : null;
  const {
    replyTask,
    replyColor,
    feedback,
    handleReplyToTask,
    handleReplySent,
    closeReply,
  } = useFriendTaskReply(tasks);

  const focusMonthKey = format(focusDate, 'yyyy-MM');
  const [syncedFocusMonthKey, setSyncedFocusMonthKey] = useState(focusMonthKey);

  if (focusMonthKey !== syncedFocusMonthKey) {
    setSyncedFocusMonthKey(focusMonthKey);
    setSelectedDate(new Date(focusDate));
  }

  const handleDateChange = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      if (!isSameMonth(date, focusDate)) {
        onFocusDateChange(date);
      }
    },
    [focusDate, onFocusDateChange]
  );

  const handleCalendarDateSelect = useCallback((date: Date) => {
    if (markerMode === 'diary' && isSameDay(selectedDate, date)) {
      onOpenDiary?.(date);
      return;
    }
    handleDateChange(date);
  }, [markerMode, selectedDate, handleDateChange, onOpenDiary]);

  return (
    <div ref={frameRef} className="relative flex min-h-0 min-w-0 flex-1" data-testid="todo-split-workspace">
    {sidePanelOpen && (
      <LazyDayDetailPanel
        persistent side={dayPanelSide} isPresented onExited={() => {}}
        initialHeightMode={dayPanelHeight} initialFrameWidth={frameWidth}
        frameRef={frameRef} onCalendarLayoutChange={realignTodoCalendar}
        onClose={restoreBottom}
        onFocusCalendar={() => frameRef.current?.querySelector<HTMLElement>('[data-testid="todo-calendar-grid"]')?.focus()}
        isFriend={variant === 'friend' && Boolean(friendUserId)}
        showDiaryAlways={markerMode === 'diary'}
        friendDiaryCard={friendDiaryCard} friendDiaryPosition={friendDiaryPosition}
        selectedDate={selectedDate} onDateChange={handleDateChange}
        tasks={tasks} categories={categories} friendName={friendName}
        currentUserId={currentUserId} onReplyToTask={handleReplyToTask}
        onReactToTask={onReactToTask} holidayConfig={holidayConfig}
      />
    )}
    <section
      className="swiper-no-swiping min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pb-8 pt-4 animate-in fade-in duration-300"
      data-testid="todo-scroll-region"
    >
      <div
        className="-mx-4 w-[calc(100%+2rem)]"
        data-testid="todo-calendar-surface"
      >
        <TodoCalendarGrid
          onLayoutChangeReady={bindTodoRealign}
          focusDate={focusDate}
          selectedDate={selectedDate}
          tasks={tasks}
          sharedByDay={variant === 'me' ? sharedByDay : undefined}
          ownedSharedTaskIds={variant === 'me' ? ownedSharedTaskIds : undefined}
          categories={categories}
          categoriesMap={categoriesMap}
          onDateSelect={handleCalendarDateSelect}
          onMonthChange={onFocusDateChange}
          markerMode={markerMode}
          diaryEntries={diaryEntries}
          weekStartsOn={weekStartsOn}
          holidayConfig={holidayConfig}
        />
      </div>

      {showBottom && <div className="mt-0 min-w-0 w-full max-w-full overflow-x-hidden" data-testid="todo-day-section">
        {variant === 'friend' && friendUserId ? (
          <>
            {friendDiaryPosition === 'top' && friendDiaryCard}
            <FriendDayViewSheet
              key={focusMonthKey}
              isOpen
              onClose={() => {}}
              date={selectedDate}
              onDateChange={handleDateChange}
              renderMode="inline"
              tasks={tasks}
              categories={categories}
              friendName={friendName}
              currentUserId={currentUserId}
              onReplyToTask={handleReplyToTask}
              onReactToTask={onReactToTask}
              holidayConfig={holidayConfig}
            />
            {friendDiaryPosition === 'bottom' && friendDiaryCard}
            <Suspense fallback={null}>
              <ReplyComposerSheet isOpen={!!replyTask} onClose={closeReply}
                task={replyTask} categoryColor={replyColor}
                friendId={friendUserId} friendName={friendName} onSent={handleReplySent} />
            </Suspense>
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg"
              >
                {feedback}
              </div>
            )}
          </>
        ) : (
          <DayViewSheet
            key={focusMonthKey}
            isOpen
            onClose={() => {}}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            renderMode="inline"
            showDiaryAlways={markerMode === 'diary'}
            tasks={tasks}
            categories={categories}
            holidayConfig={holidayConfig}
          />
        )}
      </div>}
    </section>
    {sidePanelOpen && variant === 'friend' && friendUserId && (
      <Suspense fallback={null}>
        <ReplyComposerSheet isOpen={!!replyTask} onClose={closeReply}
          task={replyTask} categoryColor={replyColor}
          friendId={friendUserId} friendName={friendName} onSent={handleReplySent} />
      </Suspense>
    )}
    </div>
  );
};
