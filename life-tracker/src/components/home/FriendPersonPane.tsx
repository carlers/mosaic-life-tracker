import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { addMonths, format } from 'date-fns';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { IncompleteTaskBlockColorContext } from '../../hooks/incompleteTaskBlockColorContext';
import { fetchFriendDiaryMonth, reactToFriendDiary, type FriendDiaryDocument } from '../../lib/friendData';
import { createPreloadedLazy } from '../../lib/createPreloadedLazy';
import { useRetainedSheetValue } from '../../hooks/useRetainedSheetValue';
import { useCalendarState } from './views/useCalendarState';
import { useMessageActions } from '../../hooks/useMessageActions';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useHomeViewKeyboardShortcuts } from '../../hooks/useHomeViewKeyboardShortcuts';
import { useFriendCalendar } from '../../lib/useFriendCalendar';
import {
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_HOLIDAYS_SETTING_KEY,
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
import type { TaskDocument } from '../../db/schema';

const FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000;
const { Component: LazyDiaryEntrySheet } = createPreloadedLazy(() => import('./views/DiaryEntrySheet').then(m => m.DiaryEntrySheet));

import { LazyTodoListView, preloadTodoListView } from './views/todoListViewModule';

function readHomeView(): ViewType {
  try {
    const value = localStorage.getItem('mosaic_home_view');
    return value === 'diary' || value === 'todo' ? value : 'calendar';
  } catch {
    return 'calendar';
  }
}

interface FriendPersonPaneProps {
  person: CarouselPerson;
  isActive: boolean;
}

export const FriendPersonPane: React.FC<FriendPersonPaneProps> = ({
  person,
  isActive,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';
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
  const holidayConfig = createHolidayDisplayConfig(
    getSetting(SHOW_HOLIDAYS_SETTING_KEY, false),
    getSetting(HOLIDAY_REGION_SETTING_KEY, ''),
    getSetting(HOLIDAY_TYPES_SETTING_KEY, 'public-and-observances')
  );
  const { sendTaskReaction, sendDiaryReply } = useMessageActions(person.userId);

  const [activeView, setActiveView] = useState<ViewType>(readHomeView);
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryState, setDiaryState] = useState<{ key: string; entries: FriendDiaryDocument[] }>({ key: '', entries: [] });
  const [todoFocusDate, setTodoFocusDate] = useState(() => new Date());
  const calendarState = useCalendarState({ weekStartsOn });
  const diaryMonth = format(todoFocusDate, 'yyyy-MM');
  const diaryKey = `${currentUserId}:${person.userId}:${diaryMonth}`;
  useEffect(() => {
    if (!isActive || activeView !== 'diary' || !currentUserId) return;
    let mounted = true;
    fetchFriendDiaryMonth(currentUserId, person.userId, diaryMonth).then(entries => {
      if (mounted) setDiaryState({ key: diaryKey, entries });
    }).catch(() => { if (mounted) setDiaryState({ key: diaryKey, entries: [] }); });
    return () => { mounted = false; };
  }, [isActive, activeView, diaryKey, diaryMonth, currentUserId, person.userId]);
  const diaryEntries = diaryState.key === diaryKey ? diaryState.entries : [];
  const activeDiaryEntry = diaryDate ? diaryEntries.find(entry => entry.date === diaryDate) : undefined;
  const friendDiaryOpen = Boolean(isActive && activeView === 'diary' && currentUserId && diaryDate && activeDiaryEntry);
  const { value: friendDiarySession, onExitComplete: clearFriendDiarySession } = useRetainedSheetValue(
    friendDiaryOpen && diaryDate && activeDiaryEntry
      ? { id: `${currentUserId}:${person.userId}:${diaryDate}`, viewerId: currentUserId, friendId: person.userId,
          date: diaryDate, entry: activeDiaryEntry }
      : null,
    friendDiaryOpen
  );
  const onDiaryReact = async (emoji: string, op: 'add' | 'remove') => {
    const entry = diaryEntries.find(item => item.date === diaryDate);
    if (!entry) return;
    await reactToFriendDiary(person.userId, entry.id, emoji, op);
    const updated = await fetchFriendDiaryMonth(currentUserId, person.userId, diaryMonth);
    setDiaryState({ key: diaryKey, entries: updated });
  };
  const onDiaryReply = async (content: string) => {
    const entry = diaryEntries.find(item => item.date === diaryDate);
    if (!entry) throw new Error('Diary unavailable.');
    await sendDiaryReply(entry, content);
  };
  const viewRequestRef = useRef(0);
  const handleViewChange = useCallback((next: ViewType) => {
    const request = ++viewRequestRef.current;
    setDiaryDate(null);
    setDiaryState({ key: '', entries: [] });
    if (next === 'calendar') {
      setActiveView(next);
      return;
    }
    void preloadTodoListView().then(
      () => { if (viewRequestRef.current === request) React.startTransition(() => setActiveView(next)); },
      () => { if (viewRequestRef.current === request) React.startTransition(() => setActiveView(next)); }
    );
  }, []);
  useHomeViewKeyboardShortcuts(isActive, activeView, handleViewChange);
  const openDiary = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    if (diaryEntries.some(entry => entry.date === key)) setDiaryDate(key);
  };

  const {
    tasks = [],
    categories = [],
    refetch: refetchFriendCalendar,
  } = useFriendCalendar(person.userId);
  const lastRefetchRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const now = Date.now();
    if (now - lastRefetchRef.current < FRIEND_REFETCH_MIN_INTERVAL_MS) return;
    lastRefetchRef.current = now;
    refetchFriendCalendar(true);
  }, [isActive, refetchFriendCalendar]);

  const categoriesMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    for (const category of categories) {
      map[category.id] = { color: category.color, name: category.name };
    }
    return map;
  }, [categories]);

  const handleReactToTask = useCallback(
    (task: TaskDocument, emoji: string) => {
      sendTaskReaction(task, emoji, '');
    },
    [sendTaskReaction]
  );

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
      <PersonProfileHeader person={person} isActive={isActive} />
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
          tasks={tasks}
          categoriesMap={categoriesMap}
          variant="friend"
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
          friendCategories={categories}
          friendName={person.displayName}
          friendUserId={person.userId}
          currentUserId={currentUserId}
          isActive={isActive}
          onPrev={calendarState.handlePrev}
          onNext={calendarState.handleNext}
          onReactToTask={handleReactToTask}
          weekStartsOn={weekStartsOn}
          holidayConfig={holidayConfig}
        />
      ) : activeView === 'todo' ? (
        <React.Suspense fallback={null}>
          <LazyTodoListView
            variant="friend"
            focusDate={todoFocusDate}
            tasks={tasks}
            categories={categories}
            categoriesMap={categoriesMap}
            onFocusDateChange={setTodoFocusDate}
            friendName={person.displayName}
            friendUserId={person.userId}
            currentUserId={currentUserId}
            onReactToTask={handleReactToTask}
            weekStartsOn={weekStartsOn}
            holidayConfig={holidayConfig}
          />
        </React.Suspense>
      ) : (
        <React.Suspense fallback={null}>
          <LazyTodoListView variant="friend" markerMode="diary" diaryEntries={diaryEntries}
            onOpenDiary={openDiary} focusDate={todoFocusDate} tasks={tasks}
            categories={categories} categoriesMap={categoriesMap}
            onFocusDateChange={setTodoFocusDate} friendName={person.displayName}
            friendUserId={person.userId} currentUserId={currentUserId}
            onReactToTask={handleReactToTask} weekStartsOn={weekStartsOn}
            holidayConfig={holidayConfig} />
        </React.Suspense>
      )}
      {isActive && friendDiarySession?.viewerId === currentUserId &&
        friendDiarySession.friendId === person.userId && (!diaryDate || !!activeDiaryEntry) && <React.Suspense fallback={null}>
        <LazyDiaryEntrySheet key={friendDiarySession.id} isOpen={friendDiaryOpen}
          onExitComplete={clearFriendDiarySession} date={friendDiarySession.date}
          entry={friendDiarySession.entry} author={person.displayName} friendUserId={person.userId}
          onReact={onDiaryReact} onReply={onDiaryReply} onClose={() => setDiaryDate(null)} />
      </React.Suspense>}
    </div>
    </IncompleteTaskBlockColorContext.Provider>
  );
};
