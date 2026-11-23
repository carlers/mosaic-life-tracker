import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { selectCalendarCategoryIds } from '../../../lib/calendarCategoryFilter';
import {
  DIARY_COMPACT_ZOOM_KEY, TODO_COMPACT_CATEGORY_KEY, TODO_COMPACT_ZOOM_KEY,
  SHOW_TODO_HEATMAP_TASK_COUNTS_KEY,
  nextCompactActivityZoom, resolveCompactActivityZoom,
  type CompactActivityZoom,
} from '../../../lib/compactActivity';
import { CompactActivityLegend } from './CompactActivityOverview';
import { CalendarCategoryFilterTrigger } from './CalendarCategoryFilterTrigger';
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
import { DiaryDayGroup } from './DiaryDayPreview';
import { useSettings } from '../../../hooks/useSettings';
import {
  DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, DIARY_DAY_VIEW_POSITION_SETTING_KEY,
  SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, resolveDiaryDayViewHeight, resolveDiaryDayViewPosition,
  DAY_DETAIL_PRESENTATION_SETTING_KEY, DAY_PANEL_SIDE_SETTING_KEY, DAY_PANEL_HEIGHT_SETTING_KEY,
  resolveDayDetailPresentation, resolveDayPanelHeight,
} from '../../../lib/preferences';
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../../../db/schema';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { WeekStartsOn, DayPanelHeight } from '../../../lib/preferences';
import {
  DISABLED_HOLIDAY_CONFIG,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

const EMPTY_DIARY_ENTRIES: readonly DiaryDocument[] = [];
const EMPTY_SELECTED_IDS: string[] = [];

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
  isActive?: boolean;
  dayDetailPresentation?: 'sheet' | 'panel';
  dayPanelHeight?: DayPanelHeight;
  friendName?: string;
  friendUserId?: string;
  currentUserId?: string;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  weekStartsOn?: WeekStartsOn;
  holidayConfig?: HolidayDisplayConfig;
  markerMode?: 'todo' | 'diary';
  diaryEntries?: readonly DiaryDocument[];
  onOpenDiary?: (date: Date, entryId?: string) => void;
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
  isActive = true,
  dayDetailPresentation,
  dayPanelHeight: panelHeightOverride,
  friendName = '',
  friendUserId = '',
  currentUserId = '',
  onReactToTask,
  weekStartsOn = 0,
  holidayConfig = DISABLED_HOLIDAY_CONFIG,
  markerMode = 'todo',
  diaryEntries = EMPTY_DIARY_ENTRIES,
  onOpenDiary,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(focusDate));
  const { getSetting, setSetting, isLoading: settingsLoading } = useSettings();
  const ownerId = currentUserId;
  const zoomKey = markerMode === 'diary' ? DIARY_COMPACT_ZOOM_KEY : TODO_COMPACT_ZOOM_KEY;
  const savedZoom = resolveCompactActivityZoom(settingsLoading ? undefined : getSetting(zoomKey));
  const showTaskCounts = variant === 'me' && !!ownerId && markerMode === 'todo' &&
    !settingsLoading && getSetting(SHOW_TODO_HEATMAP_TASK_COUNTS_KEY, false) === true;
  const [pendingZoom, setPendingZoom] = useState<{
    ownerId: string; key: string; level: CompactActivityZoom;
  } | null>(null);
  const zoomLevel = variant === 'me' && ownerId
    ? pendingZoom?.ownerId === ownerId && pendingZoom.key === zoomKey ? pendingZoom.level : savedZoom
    : 'month';
  const changeZoom = useCallback((level: CompactActivityZoom) => {
    if (variant !== 'me' || !ownerId || zoomLevel === level) return;
    setPendingZoom({ ownerId, key: zoomKey, level });
    void setSetting(zoomKey, level).then(() => {
      setPendingZoom(previous => previous?.ownerId === ownerId && previous.key === zoomKey &&
        previous.level === level ? null : previous);
    }, error => {
      console.error('Compact grid zoom save failed', error);
      setPendingZoom(previous => previous?.ownerId === ownerId && previous.key === zoomKey &&
        previous.level === level ? null : previous);
    });
  }, [ownerId, setSetting, variant, zoomKey, zoomLevel]);

  const ownedCategories = useMemo(
    () => categories.filter(category => category.userId === ownerId && !category.isDeleted),
    [categories, ownerId]
  );
  const savedCategoryIds = useMemo(
    () => selectCalendarCategoryIds(settingsLoading ? [] : getSetting(TODO_COMPACT_CATEGORY_KEY, []), ownedCategories),
    [getSetting, ownedCategories, settingsLoading]
  );
  const [pendingFilter, setPendingFilter] = useState<{ ownerId: string; ids: string[] } | null>(null);
  const selectedCategoryIds = useMemo(
    () => variant === 'me' && markerMode === 'todo' && ownerId
      ? selectCalendarCategoryIds(
          pendingFilter?.ownerId === ownerId ? pendingFilter.ids : savedCategoryIds, ownedCategories
        )
      : EMPTY_SELECTED_IDS,
    [variant, markerMode, ownerId, pendingFilter, savedCategoryIds, ownedCategories]
  );
  const filterRef = useRef<string[]>([]);
  useEffect(() => { filterRef.current = selectedCategoryIds; }, [selectedCategoryIds]);
  const filterWrites = useRef<Promise<void>>(Promise.resolve());
  const saveFilter = useCallback((ids: string[]) => {
    if (!ownerId || variant !== 'me' || markerMode !== 'todo') return;
    const next = selectCalendarCategoryIds(ids, ownedCategories);
    filterRef.current = next;
    setPendingFilter({ ownerId, ids: next });
    filterWrites.current = filterWrites.current.catch(() => undefined)
      .then(() => setSetting(TODO_COMPACT_CATEGORY_KEY, next));
    void filterWrites.current.then(() => {
      setPendingFilter(previous =>
        previous?.ownerId === ownerId && previous.ids === next ? null : previous);
    }, error => {
      console.error('Compact task filter save failed', error);
      setPendingFilter(previous =>
        previous?.ownerId === ownerId && previous.ids === next ? null : previous);
    });
  }, [ownerId, variant, markerMode, ownedCategories, setSetting]);
  const toggleFilter = useCallback((categoryId: string) => {
    const ids = filterRef.current;
    saveFilter(ids.includes(categoryId) ? ids.filter(id => id !== categoryId) : [...ids, categoryId]);
  }, [saveFilter]);
  const clearFilter = useCallback(() => saveFilter([]), [saveFilter]);

  // Two-finger touch zoom only inside the compact owner grid. Ctrl+wheel browser zoom is untouched.
  const gestureRef = useRef<HTMLDivElement>(null);
  const liveZoom = useRef(zoomLevel);
  const liveChangeZoom = useRef(changeZoom);
  useEffect(() => { liveZoom.current = zoomLevel; liveChangeZoom.current = changeZoom; },
    [zoomLevel, changeZoom]);
  useEffect(() => {
    if (variant !== 'me') return;
    const surface = gestureRef.current;
    if (!surface) return;
    let startDistance = 0;
    let handled = false;
    const distance = (event: TouchEvent) => Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = distance(event);
      handled = false;
      event.stopPropagation();
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !startDistance) return;
      event.preventDefault();
      event.stopPropagation();
      if (handled) return;
      const ratio = distance(event) / startDistance;
      if (ratio > 0.83 && ratio < 1.20) return;
      handled = true;
      liveChangeZoom.current(nextCompactActivityZoom(liveZoom.current, ratio < 1 ? 'out' : 'in'));
    };
    const end = (event: TouchEvent) => {
      if (event.touches.length < 2) { startDistance = 0; handled = false; }
    };
    surface.addEventListener('touchstart', start, { passive: true, capture: true });
    surface.addEventListener('touchmove', move, { passive: false, capture: true });
    surface.addEventListener('touchend', end);
    surface.addEventListener('touchcancel', end);
    return () => {
      surface.removeEventListener('touchstart', start, true);
      surface.removeEventListener('touchmove', move, true);
      surface.removeEventListener('touchend', end);
      surface.removeEventListener('touchcancel', end);
    };
  }, [variant]);
  const dayPresentation = dayDetailPresentation ?? resolveDayDetailPresentation(getSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet'));
  const dayPanelSide = getSetting(DAY_PANEL_SIDE_SETTING_KEY, 'right') === 'left' ? 'left' : 'right';
  const dayPanelHeight = panelHeightOverride ?? resolveDayPanelHeight(getSetting(DAY_PANEL_HEIGHT_SETTING_KEY, 'grid'));
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
  // Nearby Home person slides stay mounted. Only the active person owns
  // the shared screen-height Day View portal or its expensive inline view.
  const sidePanelOpen = isActive && dayPresentation === 'panel' && frameWidth >= DAY_PANEL_MIN_FRAME_WIDTH;
  const showBottom = isActive && !sidePanelOpen;
  const restoreBottom = useCallback(() => {
    void setSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet');
  }, [setSetting]);
  const showFriendDiaryCard = variant === 'friend' &&
    (markerMode === 'diary' || getSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, false) === true);
  const friendDiaryPosition = resolveDiaryDayViewPosition(getSetting(DIARY_DAY_VIEW_POSITION_SETTING_KEY, 'top'));
  const friendDiaryExpanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  const friendEntries = diaryEntries.filter(item => item.date === format(selectedDate, 'yyyy-MM-dd'));
  const friendDiaryCard = showFriendDiaryCard && friendEntries.length > 0 && onOpenDiary ? (
    <div className="my-2 px-4"><DiaryDayGroup key={`${format(selectedDate, 'yyyy-MM-dd')}:${friendDiaryExpanded}`} date={format(selectedDate, 'yyyy-MM-dd')} entries={friendEntries}
      expanded={friendDiaryExpanded} onOpen={entry => onOpenDiary(selectedDate, entry.id)} /></div>
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
        ref={gestureRef}
        className="-mx-4 w-[calc(100%+2rem)]"
        data-testid="todo-calendar-surface"
      >
        {variant === 'me' && (
          <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-1">
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Zoom out activity grid"
                disabled={zoomLevel === 'year'} onClick={() => changeZoom(nextCompactActivityZoom(zoomLevel, 'out'))}
                className="mosaic-action-icon rounded-lg border-0 bg-transparent p-1.5 hover:bg-surfaceHighlight disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                <ZoomOut size={16} aria-hidden="true" />
              </button>
              <span aria-live="polite" data-testid="compact-zoom-level" className="mosaic-general-text min-w-16 text-center text-xs text-textSecondary">
                {zoomLevel === 'month' ? 'Month' : zoomLevel === 'half-year' ? '6 months' : 'Year'}
              </span>
              <button type="button" aria-label="Zoom in activity grid"
                disabled={zoomLevel === 'month'} onClick={() => changeZoom(nextCompactActivityZoom(zoomLevel, 'in'))}
                className="mosaic-action-icon rounded-lg border-0 bg-transparent p-1.5 hover:bg-surfaceHighlight disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                <ZoomIn size={16} aria-hidden="true" />
              </button>
            </div>
            {markerMode === 'todo' && (
              <CalendarCategoryFilterTrigger label="to-do list" categories={ownedCategories}
                selectedIds={selectedCategoryIds} onToggle={toggleFilter} onClear={clearFilter} />
            )}
          </div>
        )}
        {zoomLevel !== 'month' && <CompactActivityLegend />}
        <TodoCalendarGrid
          onLayoutChangeReady={bindTodoRealign}
          zoomLevel={zoomLevel}
          onZoomLevelChange={changeZoom}
          selectedCategoryIds={selectedCategoryIds}
          showTaskCounts={showTaskCounts}
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
          getDiaryPreference={markerMode === 'diary' && variant !== 'friend' ? getSetting : undefined}
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
