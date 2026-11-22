import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { IncompleteTaskBlockColorContext } from '../../hooks/incompleteTaskBlockColorContext';
import { useDiary } from '../../hooks/useDiary';
import type { CalendarDiarySnapshot } from '../../lib/calendarDiary';
import { CalendarDiaryContext } from '../../hooks/calendarDiaryContext';
import { useRetainedSheetValue } from '../../hooks/useRetainedSheetValue';
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
const { Component: LazyOwnerDiaryEditorAdapter, preload: preloadDiaryEntrySheet } = createPreloadedLazy(() => import('./views/OwnerDiaryEditorAdapter').then(m => m.OwnerDiaryEditorAdapter));
const { Component: LazyCategoryView, preload: preloadCategoryView } = createPreloadedLazy(() =>
  import('./views/CategoryView').then(m => m.CategoryView));
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
}

function readHomeView(): ViewType {
  try {
    const value = localStorage.getItem('mosaic_home_view');
    return value === 'diary' || value === 'todo' || value === 'category' ? value : 'calendar';
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
  // Transient per-owner search is not written to settings or sent over the network.
  const [textState, setTextState] = useState<[string, string]>([currentUserId, '']);
  if (textState[0] !== currentUserId) setTextState([currentUserId, '']);
  const filterText = textState[0] === currentUserId ? textState[1] : '';
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryEntryId, setDiaryEntryId] = useState<string | null>(null);
  const { entries: diaryEntries, getEntriesByDate, createEntry, updateEntry, deleteEntryById } =
    useDiary(isActive && activeView === 'diary');
  const ownerDiaryOpen = Boolean(isActive && activeView === 'diary' && currentUserId && diaryDate);
  const { value: ownerDiarySession, onExitComplete: clearOwnerDiarySession } = useRetainedSheetValue(
    ownerDiaryOpen && diaryDate && currentUserId
      ? { id: `${currentUserId}:${diaryDate}:${diaryEntryId || 'new'}`,
          userId: currentUserId, date: diaryDate, entryId: diaryEntryId,
          entry: diaryEntryId ? getEntriesByDate(diaryDate).find(item => item.id === diaryEntryId) : undefined }
      : null,
    ownerDiaryOpen
  );
  const viewRequestRef = useRef(0);
  const handleViewChange = useCallback((next: ViewType) => {
    const request = ++viewRequestRef.current;
    setDiaryDate(null);
    if (next === 'diary') void preloadDiaryEntrySheet().catch(() => {});
    try { localStorage.setItem('mosaic_home_view', next); } catch { /* Optional local view memory. */ }
    if (next === 'calendar') {
      setActiveView(next);
      return;
    }
    // Keep Calendar visible until the requested lazy view is ready.
    const ready = () => {
      if (viewRequestRef.current === request) React.startTransition(() => setActiveView(next));
    };
    void (next === 'category' ? preloadCategoryView() : preloadTodoListView()).then(ready, ready);
  }, []);
  const handledShortcutRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActive || !shortcutView || handledShortcutRef.current === shortcutView.key) return;
    handledShortcutRef.current = shortcutView.key;
    handleViewChange(shortcutView.view);
  }, [isActive, shortcutView, handleViewChange]);
  useHomeViewKeyboardShortcuts(isActive, activeView, handleViewChange);
  const openDiary = useCallback((date: Date, entryId?: string) => {
    const key = format(date, 'yyyy-MM-dd');
    const entriesOnDay = getEntriesByDate(key);
    if (!entryId && entriesOnDay.length > 1) {
      setDiaryDate(null);
      return;
    }
    setDiaryEntryId(entryId ?? entriesOnDay[0]?.id ?? null);
    setDiaryDate(key);
  }, [getEntriesByDate]);
  const [todoFocusDate, setTodoFocusDate] = useState(() => new Date());
  const calendarState = useCalendarState({ weekStartsOn });
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

  const [handleTodoPrev, handleTodoNext, handleTodoToday] = useMemo(() => [
    () => setTodoFocusDate(date => addMonths(date, -1)),
    () => setTodoFocusDate(date => addMonths(date, 1)),
    () => setTodoFocusDate(new Date()),
  ] as const, []);

  return (
    <IncompleteTaskBlockColorContext.Provider value={incompleteTaskBlockColor}>
    <div className="flex h-full min-h-0 flex-col">
      <PersonProfileHeader person={person} isActive={isActive} onDiaryToday={activeView === 'diary' && showDiaryTodayShortcut ? () => openDiary(new Date()) : undefined} />
      <CalendarHeader
        title={
          activeView === 'category' ? 'Category View' : activeView !== 'calendar'
            ? format(todoFocusDate, 'MMMM yyyy')
            : calendarState.title
        }
        viewMode={calendarState.viewMode}
        enableTitleSwipe={calendarZoomDays !== 7}
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
          activeView !== 'calendar' ? handleTodoPrev : calendarState.handlePrev
        }
        onNext={
          activeView !== 'calendar' ? handleTodoNext : calendarState.handleNext
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
      ) : (
        <React.Suspense fallback={null}>
          <LazyTodoListView
            markerMode={activeView === 'diary' ? 'diary' : undefined}
            diaryEntries={activeView === 'diary' ? diaryEntries : undefined}
            onOpenDiary={activeView === 'diary' ? openDiary : undefined}
            focusDate={todoFocusDate} tasks={ownerTasks} categories={ownerCategories}
            sharedByDay={sharedByDay} ownedSharedTaskIds={ownedSharedTaskIds}
            categoriesMap={categoriesMap} onFocusDateChange={setTodoFocusDate}
            weekStartsOn={weekStartsOn} holidayConfig={holidayConfig} />
        </React.Suspense>
      )}
      {isActive && currentUserId && ownerDiarySession?.userId === currentUserId && <React.Suspense fallback={null}>
        <LazyOwnerDiaryEditorAdapter key={ownerDiarySession.id} session={ownerDiarySession}
          isOpen={ownerDiaryOpen} onExitComplete={clearOwnerDiarySession}
          author={person.displayName} createEntry={createEntry} updateEntry={updateEntry}
          deleteEntryById={deleteEntryById}
          onClose={() => { setDiaryDate(null); setDiaryEntryId(null); }} />
      </React.Suspense>}
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
