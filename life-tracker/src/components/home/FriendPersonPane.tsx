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
import { ComingSoon } from '../layout/ComingSoon';
import { useCalendarState } from './views/useCalendarState';
import { useMessageActions } from '../../hooks/useMessageActions';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useFriendCalendar } from '../../lib/useFriendCalendar';
import {
  TAP_CALENDAR_DATE_TO_TODAY_SETTING_KEY,
  WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
  resolveWeekStartsOn,
} from '../../lib/preferences';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';
import type { ViewType } from './ViewSwitcher';
import type { TaskDocument } from '../../db/schema';

const FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000;

const LazyTodoListView = React.lazy(() =>
  import('./views/TodoListView').then(({ TodoListView }) => ({
    default: TodoListView,
  }))
);

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
  const { getSetting } = useSettings();
  const weekStartsOn = resolveWeekStartsOn(
    getSetting(WEEK_STARTS_ON_SUNDAY_SETTING_KEY, true) === true
  );
  const tapCalendarDateToToday =
    getSetting(TAP_CALENDAR_DATE_TO_TODAY_SETTING_KEY, false) === true;
  const { sendTaskReaction } = useMessageActions(person.userId);

  const [activeView, setActiveView] = useState<ViewType>(readHomeView);
  const [todoFocusDate, setTodoFocusDate] = useState(() => new Date());
  const calendarState = useCalendarState({ weekStartsOn });

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

  return (
    <div className="flex flex-col h-full">
      <PersonProfileHeader person={person} isActive={isActive} />
      <CalendarHeader
        title={
          activeView === 'todo'
            ? format(todoFocusDate, 'MMMM yyyy')
            : calendarState.title
        }
        viewMode={calendarState.viewMode}
        onToggleMode={calendarState.handleToggle}
        onPrev={
          activeView === 'todo' ? handleTodoPrev : calendarState.handlePrev
        }
        onNext={
          activeView === 'todo' ? handleTodoNext : calendarState.handleNext
        }
        activeView={activeView}
        onViewChange={setActiveView}
        onTitleClick={
          activeView === 'calendar' && tapCalendarDateToToday
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
          tasks={tasks}
          categoriesMap={categoriesMap}
          variant="friend"
          friendCategories={categories}
          friendName={person.displayName}
          friendUserId={person.userId}
          currentUserId={currentUserId}
          isActive={isActive}
          onPrev={calendarState.handlePrev}
          onNext={calendarState.handleNext}
          onReactToTask={handleReactToTask}
          weekStartsOn={weekStartsOn}
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
          />
        </React.Suspense>
      ) : (
        <ComingSoon />
      )}
    </div>
  );
};
