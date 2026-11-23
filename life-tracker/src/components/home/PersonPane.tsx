import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { IncompleteTaskBlockColorContext } from '../../hooks/incompleteTaskBlockColorContext';
import type { CalendarDiarySnapshot } from '../../lib/calendarDiary';
import { CalendarDiaryContext } from '../../hooks/calendarDiaryContext';
import { createPreloadedLazy } from '../../lib/createPreloadedLazy';
import { useCalendarState } from './views/useCalendarState';
import { useAuth } from '../../hooks/useAuth';
import { useSharedTasks } from '../../hooks/useSharedTasks';
import { sharedByDate } from '../../lib/sharedTaskPresentation';
import { useSettings } from '../../hooks/useSettings';
import { CALENDAR_CATEGORY_FILTER_SETTING_KEY, selectCalendarCategoryIds } from '../../lib/calendarCategoryFilter';
import { CALENDAR_WALLPAPER_SETTING_KEY, resolveCalendarWallpaper } from '../../lib/calendarWallpaper';
import { useHomeViewKeyboardShortcuts } from '../../hooks/useHomeViewKeyboardShortcuts';
import {
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_HOLIDAYS_SETTING_KEY,
  SHOW_DIARY_TODAY_SHORTCUT_SETTING_KEY,
  WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
  INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY,
  DAY_DETAIL_PRESENTATION_SETTING_KEY,
  DAY_PANEL_SIDE_SETTING_KEY,
  DAY_PANEL_HEIGHT_SETTING_KEY,
  resolveDayPanelHeight,
  resolveDayDetailPresentation,
  CALENDAR_ZOOM_DAYS_SETTING_KEY,
  CALENDAR_PINCH_ZOOM_SETTING_KEY,
  CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY,
  SHOW_DIARY_IN_CALENDAR_SETTING_KEY,
  resolveCalendarTaskPreviewLimit,
  STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY,
  resolveCalendarZoomDays,
  resolveIncompleteTaskBlockColorMode,
  resolveWeekStartsOn,
} from '../../lib/preferences';
import { createHolidayDisplayConfig } from '../../lib/holidays';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';
import type { ViewType } from './ViewSwitcher';
import type { CategoryDocument, TaskDocument } from '../../db/schema';

import { LazyTodoListView, preloadTodoListView } from './views/todoListViewModule';
const { Component: LazyDiaryOwnerWorkspace, preload: preloadDiaryOwnerWorkspace } = createPreloadedLazy(() =>
  import('./views/DiaryOwnerWorkspace').then(m => m.DiaryOwnerWorkspace));
const { Component: LazyCategoryView, preload: preloadCategoryView } = createPreloadedLazy(() =>
  import('./views/CategoryView').then(m => m.CategoryView));
const { Component: LazyReviewOwnerWorkspace, preload: preloadReviewOwnerWorkspace } = createPreloadedLazy(() =>
  import('./views/ReviewOwnerWorkspace').then(m => m.ReviewOwnerWorkspace));
const LazyCalendarDiarySubscriber = React.lazy(() => import('./views/CalendarDiarySubscriber'));
const LazyFriendPersonPane = React.lazy(() =>
  import('./FriendPersonPane').then(({ FriendPersonPane }) => ({
    default: FriendPersonPane,
  }))
);

interface PersonPaneProps {
  person: CarouselPerson;
  isActive: boolean;
  ownerTasks?: TaskDocument[];
  ownerCategories?: CategoryDocument[];
  shortcutView?: { key: string; view: 'calendar' | 'todo' | 'diary' } | null;
  widgetTodayRequest?: { key: number; date: Date } | null;
  onWidgetTodayConsumed?: (key: number) => void;
}

function readHomeView(): ViewType {
  try {
    const value = localStorage.getItem('mosaic_home_view');
    return value === 'diary' || value === 'todo' || value === 'category' || value === 'review' ? value : 'calendar';
  } catch {
    return 'calendar';
  }
}

const EMPTY_CALENDAR_CATEGORY_FILTER: string[] = [];

const OwnerPersonPane: React.FC<PersonPaneProps> = ({
  person,
  isActive,
  ownerTasks = [],
  ownerCategories = [],
  shortcutView,
  widgetTodayRequest,
  onWidgetTodayConsumed,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';
  const { activeItems: receivedShares } = useSharedTasks('received', isActive);
  const { items: ownedShares } = useSharedTasks('owned', isActive);
  const sharedByDay = useMemo(() => sharedByDate(receivedShares), [receivedShares]);
  const ownedSharedTaskIds = useMemo(
    () => new Set(ownedShares.map(share => share.taskId)), [ownedShares]
  );
  const { getSetting, setSetting, isLoading: settingsLoading } = useSettings();
  const incompleteTaskBlockColor = resolveIncompleteTaskBlockColorMode(
    getSetting(INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY, 'default')
  );
  const dayDetailPresentation = resolveDayDetailPresentation(getSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet'));
  const dayPanelSide = getSetting(DAY_PANEL_SIDE_SETTING_KEY, 'right') === 'left' ? 'left' : 'right';
  const dayPanelHeight = resolveDayPanelHeight(getSetting(DAY_PANEL_HEIGHT_SETTING_KEY, 'grid'));
  const calendarZoomDays = resolveCalendarZoomDays(getSetting(CALENDAR_ZOOM_DAYS_SETTING_KEY, 7));
  const calendarPinchZoom = getSetting(CALENDAR_PINCH_ZOOM_SETTING_KEY, false) === true;
  const calendarTaskPreviewLimit = resolveCalendarTaskPreviewLimit(getSetting(CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY, 'unlimited'));
  const showDiaryInCalendar = getSetting(SHOW_DIARY_IN_CALENDAR_SETTING_KEY, false) === true;
  const stickyWeekdayHeader = getSetting(STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY, false) === true;
  // Both shipped presets and the authenticated owner's uploaded photo slots
  // are valid Home wallpapers. The photo source stays in the lazy backdrop.
  const wallpaperEnabled = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none')) !== 'none';
  const wallpaperFullHome = getSetting('calendarWallpaperScope') === 'home';
  const weekStartsOn = resolveWeekStartsOn(
    getSetting(WEEK_STARTS_ON_SUNDAY_SETTING_KEY, true) === true
  );
  const showDiaryTodayShortcut = getSetting(SHOW_DIARY_TODAY_SHORTCUT_SETTING_KEY, true) === true;
  const holidayConfig = createHolidayDisplayConfig(
    getSetting(SHOW_HOLIDAYS_SETTING_KEY, false),
    getSetting(HOLIDAY_REGION_SETTING_KEY, ''),
    getSetting(HOLIDAY_TYPES_SETTING_KEY, 'public-and-observances')
  );
  const [activeView, setActiveView] = useState<ViewType>(readHomeView);
  // Keep the older accepted compact-grid navigation, without replacing
  // the newer Category, Review or DiaryOwnerWorkspace routing on dev.
  const compactZoom = getSetting(activeView === 'diary' ? 'diaryCompactActivityZoom' : 'todoCompactActivityZoom');
  const compactPeriodStep = compactZoom === 'year' ? 12 : compactZoom === 'half-year' ? 6 : 1;
  const [diaryTodayRequest, setDiaryTodayRequest] = useState(0);
  // Transient per-owner search is not written to settings or sent over the network.
  const [textState, setTextState] = useState<[string, string]>([currentUserId, '']);
  if (textState[0] !== currentUserId) setTextState([currentUserId, '']);
  const filterText = textState[0] === currentUserId ? textState[1] : '';
  const viewRequestRef = useRef(0);
  const handleViewChange = useCallback((next: ViewType) => {
    const request = ++viewRequestRef.current;
    try { localStorage.setItem('mosaic_home_view', next); } catch { /* Optional local view memory. */ }
    if (next === 'calendar') {
      setActiveView(next);
      return;
    }
    // Keep Calendar visible until the requested lazy view is ready.
    const ready = () => {
      if (viewRequestRef.current === request) React.startTransition(() => setActiveView(next));
    };
    void (next === 'category' ? preloadCategoryView() : next === 'review'
      ? preloadReviewOwnerWorkspace() : next === 'diary'
        ? Promise.all([preloadDiaryOwnerWorkspace(), preloadTodoListView()])
        : preloadTodoListView()).then(ready, ready);
  }, []);
  const handledShortcutRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActive || !shortcutView || handledShortcutRef.current === shortcutView.key) return;
    handledShortcutRef.current = shortcutView.key;
    handleViewChange(shortcutView.view);
  }, [isActive, shortcutView, handleViewChange]);
  useHomeViewKeyboardShortcuts(isActive, activeView, handleViewChange);
  const [todoFocusDate, setTodoFocusDate] = useState(() => new Date());
  const compactPeriodTitle = compactPeriodStep === 1 ? format(todoFocusDate, 'MMMM yyyy')
    : compactPeriodStep === 12 ? format(todoFocusDate, 'yyyy')
    : (todoFocusDate.getMonth() < 6 ? 'Jan–Jun ' : 'Jul–Dec ') + todoFocusDate.getFullYear();
  const calendarState = useCalendarState({ weekStartsOn });
  const resetCalendarToToday = calendarState.resetToToday;
  const lastWidgetTodayRequestRef = useRef<number | null>(null);
  const [calendarOpenRequest, setCalendarOpenRequest] = useState<{ key: number; date: Date } | null>(null);
  useEffect(() => {
    if (!isActive || !currentUserId || !widgetTodayRequest ||
      lastWidgetTodayRequestRef.current === widgetTodayRequest.key) return;
    lastWidgetTodayRequestRef.current = widgetTodayRequest.key;
    // Switch to the actual Calendar, reset its Embla month/week focus, then
    // let CalendarBody open its existing owned Day View (sheet OR panel).
    handleViewChange('calendar');
    resetCalendarToToday();
    setCalendarOpenRequest(widgetTodayRequest);
  }, [isActive, currentUserId, widgetTodayRequest, handleViewChange, resetCalendarToToday]);
  const consumeCalendarOpen = useCallback((key: number) => {
    setCalendarOpenRequest(current => current?.key === key ? null : current);
    onWidgetTodayConsumed?.(key);
  }, [onWidgetTodayConsumed]);
  const [calendarDiaryState, setCalendarDiaryState] = useState<CalendarDiarySnapshot | null>(null);

  // Calendar-only projection; Day View keeps the full owner task list.
  const [optimisticCalendarFilter, setOptimisticCalendarFilter] =
    useState<{ userId: string; ids: string[] } | null>(null);
  const ownedFilterCategories = useMemo(
    () => ownerCategories.filter(category => !category.isDeleted && category.userId === currentUserId),
    [ownerCategories, currentUserId]
  );
  const calendarFilterIds = useMemo(() => selectCalendarCategoryIds(
    optimisticCalendarFilter?.userId === currentUserId
      ? optimisticCalendarFilter.ids
      : settingsLoading ? EMPTY_CALENDAR_CATEGORY_FILTER
        : getSetting(CALENDAR_CATEGORY_FILTER_SETTING_KEY, EMPTY_CALENDAR_CATEGORY_FILTER),
    ownedFilterCategories
  ), [optimisticCalendarFilter, currentUserId, settingsLoading, getSetting, ownedFilterCategories]);
  const liveCalendarFilterRef = useRef<string[]>(calendarFilterIds);
  useEffect(() => { liveCalendarFilterRef.current = calendarFilterIds; }, [calendarFilterIds]);
  const filterWritesRef = useRef<Promise<void>>(Promise.resolve());
  const categoriesMap = useMemo(() =>
    Object.fromEntries(ownerCategories.map(({ id, color, name }) => [id, { color, name }])),
  [ownerCategories]);

  const stepHomeDate = useCallback((delta: number) => {
    setTodoFocusDate(date => {
      if (activeView === 'review') {
        const next = new Date(date);
        next.setDate(next.getDate() + delta);
        return next;
      }
      return addMonths(date, delta * (activeView === 'todo' || activeView === 'diary'
        ? compactPeriodStep : 1));
    });
  }, [activeView, compactPeriodStep]);
  const handleTodoToday = useCallback(() => setTodoFocusDate(new Date()), []);

  return (
    <IncompleteTaskBlockColorContext.Provider value={incompleteTaskBlockColor}>
    <div className="flex h-full min-h-0 flex-col">
      <PersonProfileHeader person={person} isActive={isActive} onDiaryToday={activeView === 'diary' && showDiaryTodayShortcut ? () => setDiaryTodayRequest(count => count + 1) : undefined} />
      <CalendarHeader
        title={
          activeView === 'category' ? 'Category View' : activeView === 'review'
            ? format(todoFocusDate, 'EEE, MMM d, yyyy')
            : activeView === 'todo' || activeView === 'diary'
              ? compactPeriodTitle : calendarState.title
        }
        viewMode={calendarState.viewMode}
        periodLabel={activeView === 'review' ? 'day' : activeView === 'todo' || activeView === 'diary'
          ? compactPeriodStep === 12 ? 'year' : compactPeriodStep === 6 ? 'six months' : 'month' : 'month'}
        enableTitleSwipe={calendarZoomDays !== 7 && activeView !== 'review'}
        calendarFilter={activeView === 'calendar' ? {
          categories: ownedFilterCategories,
          selectedIds: calendarFilterIds,
          textQuery: filterText,
          onTextChange: query => setTextState([currentUserId, query.slice(0, 120)]),
          userId: currentUserId,
          liveIdsRef: liveCalendarFilterRef,
          writesRef: filterWritesRef,
          setOptimisticCalendarFilter,
          saveIds: ids => setSetting(CALENDAR_CATEGORY_FILTER_SETTING_KEY, ids),
        } : undefined}
        onToggleMode={calendarState.handleToggle}
        onPrev={
          activeView === 'calendar' ? calendarState.handlePrev : () => stepHomeDate(-1)
        }
        onNext={
          activeView === 'calendar' ? calendarState.handleNext : () => stepHomeDate(1)
        }
        activeView={activeView}
        onViewChange={handleViewChange}
        onTitleClick={activeView === 'calendar' ? calendarState.resetToToday : handleTodoToday}
      />
      {activeView === 'calendar' ? (
        <>
        <CalendarDiaryContext.Provider value={showDiaryInCalendar && isActive &&
          calendarDiaryState?.ownerId === currentUserId ? calendarDiaryState : null}>
        <CalendarBody
          viewMode={calendarState.viewMode}
          slides={calendarState.slides}
          renderStart={calendarState.renderStart}
          renderEnd={calendarState.renderEnd}
          emblaRef={calendarState.emblaRef}
          onCalendarLayoutChange={calendarState.resnapAfterResize}
          tasks={ownerTasks}
          calendarCategoryIds={calendarFilterIds}
          query={filterText}
          categories={ownerCategories}
          categoriesMap={categoriesMap}
          variant="me"
          dayDetailPresentation={dayDetailPresentation}
          dayPanelSide={dayPanelSide}
          dayPanelHeight={dayPanelHeight}
          zoomPreference={calendarZoomDays}
          pinchGestureEnabled={calendarPinchZoom}
          onZoomPreferenceChange={(days) => { void setSetting(CALENDAR_ZOOM_DAYS_SETTING_KEY, days); }}
          taskPreviewLimit={calendarTaskPreviewLimit}
          stickyWeekdayHeader={stickyWeekdayHeader}
          wallpaperEnabled={wallpaperEnabled}
          wallpaperInHome={wallpaperFullHome}
          activeIndex={calendarState.activeIndex}
          isZoomTransitioning={calendarState.isZoomTransitioning}
          onZoomNavigate={calendarState.handleZoomNavigate}
          sharedByDay={sharedByDay}
          ownedSharedTaskIds={ownedSharedTaskIds}
          currentUserId={currentUserId}
          isActive={isActive}
          openDateRequest={calendarOpenRequest}
          onOpenDateConsumed={consumeCalendarOpen}
          onPrev={calendarState.handlePrev}
          onNext={calendarState.handleNext}
          weekStartsOn={weekStartsOn}
          holidayConfig={holidayConfig}
        />
        </CalendarDiaryContext.Provider>
        {showDiaryInCalendar && isActive && currentUserId && (
          <React.Suspense fallback={null}>
            <LazyCalendarDiarySubscriber userId={currentUserId}
              slides={calendarState.slides} renderStart={calendarState.renderStart}
              renderEnd={calendarState.renderEnd} viewMode={calendarState.viewMode}
              weekStartsOn={weekStartsOn} onPreviews={setCalendarDiaryState} />
          </React.Suspense>
        )}
        </>
      ) : activeView === 'category' ? (
        <React.Suspense fallback={null}>
          <LazyCategoryView key={currentUserId} userId={currentUserId}
            tasks={ownerTasks} categories={ownerCategories} />
        </React.Suspense>
      ) : activeView === 'review' ? (
        <React.Suspense fallback={null}>
          <LazyReviewOwnerWorkspace key={currentUserId} date={todoFocusDate}
            tasks={ownerTasks} categories={ownerCategories} userId={currentUserId}
            author={person.displayName} isActive={isActive}
            onDateChange={setTodoFocusDate} />
        </React.Suspense>
      ) : activeView === 'todo' ? (
        <React.Suspense fallback={null}>
          <LazyTodoListView isActive={isActive} currentUserId={currentUserId}
            dayDetailPresentation={dayDetailPresentation} dayPanelHeight={dayPanelHeight}
            focusDate={todoFocusDate} tasks={ownerTasks} categories={ownerCategories}
            sharedByDay={sharedByDay} ownedSharedTaskIds={ownedSharedTaskIds}
            categoriesMap={categoriesMap} onFocusDateChange={setTodoFocusDate}
            weekStartsOn={weekStartsOn} holidayConfig={holidayConfig} />
        </React.Suspense>
      ) : (
        <React.Suspense fallback={null}>
          <LazyDiaryOwnerWorkspace key={currentUserId} userId={currentUserId}
            currentUserId={currentUserId} dayDetailPresentation={dayDetailPresentation}
            dayPanelHeight={dayPanelHeight} author={person.displayName} isActive={isActive}
            diaryTodayRequest={diaryTodayRequest}
            focusDate={todoFocusDate} tasks={ownerTasks} categories={ownerCategories}
            sharedByDay={sharedByDay} ownedSharedTaskIds={ownedSharedTaskIds}
            categoriesMap={categoriesMap} onFocusDateChange={setTodoFocusDate}
            weekStartsOn={weekStartsOn} holidayConfig={holidayConfig} />
        </React.Suspense>
      )}
    </div>
    </IncompleteTaskBlockColorContext.Provider>
  );
};

export const PersonPane: React.FC<PersonPaneProps> = (props) => {
  if (props.person.kind === 'friend') {
    return (
      <React.Suspense fallback={null}>
        <LazyFriendPersonPane
          person={props.person}
          isActive={props.isActive}
        />
      </React.Suspense>
    );
  }

  return <OwnerPersonPane {...props} />;
};
