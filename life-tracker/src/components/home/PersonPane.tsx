import React, { useCallback, useMemo, useRef, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { IncompleteTaskBlockColorContext } from '../../hooks/incompleteTaskBlockColorContext';
import { useDiary } from '../../hooks/useDiary';
import { useRetainedSheetValue } from '../../hooks/useRetainedSheetValue';
import { createPreloadedLazy } from '../../lib/createPreloadedLazy';
import { useCalendarState } from './views/useCalendarState';
import { useAuth } from '../../hooks/useAuth';
import { useSharedTasks } from '../../hooks/useSharedTasks';
import { sharedByDate } from '../../lib/sharedTaskPresentation';
import { useSettings } from '../../hooks/useSettings';
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
const { Component: LazyDiaryEntrySheet, preload: preloadDiaryEntrySheet } = createPreloadedLazy(() => import('./views/DiaryEntrySheet').then(m => m.DiaryEntrySheet));
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
}

function readHomeView(): ViewType {
  try {
    const value = localStorage.getItem('mosaic_home_view');
    return value === 'diary' || value === 'todo' ? value : 'calendar';
  } catch {
    return 'calendar';
  }
}

const OwnerPersonPane: React.FC<PersonPaneProps> = ({
  person,
  isActive,
  ownerTasks = [],
  ownerCategories = [],
}) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';
  const { activeItems: receivedShares } = useSharedTasks('received', isActive);
  const { items: ownedShares } = useSharedTasks('owned', isActive);
  const sharedByDay = useMemo(() => sharedByDate(receivedShares), [receivedShares]);
  const ownedSharedTaskIds = useMemo(
    () => new Set(ownedShares.map(share => share.taskId)), [ownedShares]
  );
  const { getSetting, setSetting } = useSettings();
  const incompleteTaskBlockColor = resolveIncompleteTaskBlockColorMode(
    getSetting(INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY, 'default')
  );
  const dayDetailPresentation = resolveDayDetailPresentation(getSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet'));
  const dayPanelSide = getSetting(DAY_PANEL_SIDE_SETTING_KEY, 'right') === 'left' ? 'left' : 'right';
  const dayPanelHeight = resolveDayPanelHeight(getSetting(DAY_PANEL_HEIGHT_SETTING_KEY, 'grid'));
  const calendarZoomDays = resolveCalendarZoomDays(getSetting(CALENDAR_ZOOM_DAYS_SETTING_KEY, 7));
  const calendarPinchZoom = getSetting(CALENDAR_PINCH_ZOOM_SETTING_KEY, false) === true;
  const calendarTaskPreviewLimit = resolveCalendarTaskPreviewLimit(getSetting(CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY, 'unlimited'));
  const stickyWeekdayHeader = getSetting(STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY, false) === true;
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
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const { entries: diaryEntries, getEntryByDate, saveEntry, deleteEntry } = useDiary(isActive && activeView === 'diary');
  const ownerDiaryOpen = Boolean(isActive && activeView === 'diary' && currentUserId && diaryDate);
  const { value: ownerDiarySession, onExitComplete: clearOwnerDiarySession } = useRetainedSheetValue(
    ownerDiaryOpen && diaryDate && currentUserId
      ? { id: `${currentUserId}:${diaryDate}`, userId: currentUserId, date: diaryDate, entry: getEntryByDate(diaryDate) }
      : null,
    ownerDiaryOpen
  );
  const viewRequestRef = useRef(0);
  const handleViewChange = useCallback((next: ViewType) => {
    const request = ++viewRequestRef.current;
    setDiaryDate(null);
    if (next === 'diary') void preloadDiaryEntrySheet().catch(() => {});
    if (next === 'calendar') {
      setActiveView(next);
      return;
    }
    // Retain the visible Calendar until the next module has downloaded.
    // Ignore older pending switches when the user changes their mind.
    void preloadTodoListView().then(
      () => { if (viewRequestRef.current === request) React.startTransition(() => setActiveView(next)); },
      () => { if (viewRequestRef.current === request) React.startTransition(() => setActiveView(next)); }
    );
  }, []);
  useHomeViewKeyboardShortcuts(isActive, activeView, handleViewChange);
  const openDiary = useCallback((date: Date) => { setDiaryDate(format(date, 'yyyy-MM-dd')); }, []);
  const [todoFocusDate, setTodoFocusDate] = useState(() => new Date());
  const calendarState = useCalendarState({ weekStartsOn });

  const categoriesMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    for (const category of ownerCategories) {
      map[category.id] = { color: category.color, name: category.name };
    }
    return map;
  }, [ownerCategories]);

  const handleTodoPrev = useCallback(() => {
    setTodoFocusDate((date) => addMonths(date, -1));
  }, []);

  const handleTodoNext = useCallback(() => {
    setTodoFocusDate((date) => addMonths(date, 1));
  }, []);

  const handleTodoToday = useCallback(() => {
    setTodoFocusDate(new Date());
  }, []);

  return (
    <IncompleteTaskBlockColorContext.Provider value={incompleteTaskBlockColor}>
    <div className="flex flex-col h-full">
      <PersonProfileHeader person={person} isActive={isActive} onDiaryToday={activeView === 'diary' && showDiaryTodayShortcut ? () => openDiary(new Date()) : undefined} />
      <CalendarHeader
        title={
          activeView !== 'calendar'
            ? format(todoFocusDate, 'MMMM yyyy')
            : calendarState.title
        }
        viewMode={calendarState.viewMode}
        enableTitleSwipe={calendarZoomDays !== 7}
        onToggleMode={calendarState.handleToggle}
        onPrev={
          activeView !== 'calendar' ? handleTodoPrev : calendarState.handlePrev
        }
        onNext={
          activeView !== 'calendar' ? handleTodoNext : calendarState.handleNext
        }
        activeView={activeView}
        onViewChange={handleViewChange}
        onTitleClick={
          activeView !== 'calendar'
            ? handleTodoToday
            : activeView === 'calendar'
              ? calendarState.resetToToday
              : undefined
        }
      />
      {activeView === 'calendar' ? (
        <CalendarBody
          viewMode={calendarState.viewMode}
          slides={calendarState.slides}
          renderStart={calendarState.renderStart}
          renderEnd={calendarState.renderEnd}
          emblaRef={calendarState.emblaRef}
          onCalendarLayoutChange={calendarState.resnapAfterResize}
          tasks={ownerTasks}
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
      ) : activeView === 'todo' ? (
        <React.Suspense fallback={null}>
          <LazyTodoListView
            focusDate={todoFocusDate}
            tasks={ownerTasks}
            categories={ownerCategories}
            sharedByDay={sharedByDay}
            ownedSharedTaskIds={ownedSharedTaskIds}
            categoriesMap={categoriesMap}
            onFocusDateChange={setTodoFocusDate}
            weekStartsOn={weekStartsOn}
            holidayConfig={holidayConfig}
          />
        </React.Suspense>
      ) : (
        <React.Suspense fallback={null}>
          <LazyTodoListView markerMode="diary" diaryEntries={diaryEntries} onOpenDiary={openDiary}
            focusDate={todoFocusDate} tasks={ownerTasks} categories={ownerCategories}
            sharedByDay={sharedByDay} ownedSharedTaskIds={ownedSharedTaskIds}
            categoriesMap={categoriesMap} onFocusDateChange={setTodoFocusDate}
            weekStartsOn={weekStartsOn} holidayConfig={holidayConfig} />
        </React.Suspense>
      )}
      {isActive && currentUserId && ownerDiarySession?.userId === currentUserId && <React.Suspense fallback={null}>
        <LazyDiaryEntrySheet key={ownerDiarySession.id} isOpen={ownerDiaryOpen}
          onExitComplete={clearOwnerDiarySession} date={ownerDiarySession.date}
          entry={ownerDiarySession.entry} author={person.displayName} onSave={saveEntry} onDelete={deleteEntry}
          onClose={() => setDiaryDate(null)} />
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
