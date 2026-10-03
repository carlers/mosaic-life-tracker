import React, { useCallback, useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { ComingSoon } from '../layout/ComingSoon';
import { useCalendarState } from './views/useCalendarState';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import {
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_HOLIDAYS_SETTING_KEY,
  WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
  resolveWeekStartsOn,
} from '../../lib/preferences';
import { createHolidayDisplayConfig } from '../../lib/holidays';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';
import type { ViewType } from './ViewSwitcher';
import type { CategoryDocument, TaskDocument } from '../../db/schema';

const LazyTodoListView = React.lazy(() =>
  import('./views/TodoListView').then(({ TodoListView }) => ({
    default: TodoListView,
  }))
);
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
  const { getSetting } = useSettings();
  const weekStartsOn = resolveWeekStartsOn(
    getSetting(WEEK_STARTS_ON_SUNDAY_SETTING_KEY, true) === true
  );
  const holidayConfig = createHolidayDisplayConfig(
    getSetting(SHOW_HOLIDAYS_SETTING_KEY, false),
    getSetting(HOLIDAY_REGION_SETTING_KEY, ''),
    getSetting(HOLIDAY_TYPES_SETTING_KEY, 'public-and-observances')
  );
  const [activeView, setActiveView] = useState<ViewType>(readHomeView);
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
          activeView === 'todo'
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
          tasks={ownerTasks}
          categories={ownerCategories}
          categoriesMap={categoriesMap}
          variant="me"
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
            categoriesMap={categoriesMap}
            onFocusDateChange={setTodoFocusDate}
            weekStartsOn={weekStartsOn}
            holidayConfig={holidayConfig}
          />
        </React.Suspense>
      ) : (
        <ComingSoon />
      )}
    </div>
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
