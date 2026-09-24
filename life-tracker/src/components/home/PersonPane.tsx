import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { addMonths, format } from 'date-fns';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { TodoListView } from './views/TodoListView';
import { ComingSoon } from '../layout/ComingSoon';
import { useCalendarState } from './views/useCalendarState';
import { useMessageActions } from '../../hooks/useMessageActions';
import { useAuth } from '../../hooks/useAuth';
import { useFriendCalendar } from '../../lib/useFriendCalendar';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';
import type { ViewType } from './ViewSwitcher';
import type { CategoryDocument, TaskDocument } from '../../db/schema';

interface PersonPaneProps {
  person: CarouselPerson;
  isActive: boolean;
  ownerTasks?: TaskDocument[];
  ownerCategories?: CategoryDocument[];
}

const FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000;

function readMeView(): ViewType {
  try {
    const v = localStorage.getItem('mosaic_home_view');
    return v === 'diary' || v === 'todo' ? v : 'calendar';
  } catch {
    return 'calendar';
  }
}

export const PersonPane: React.FC<PersonPaneProps> = ({
  person,
  isActive,
  ownerTasks = [],
  ownerCategories = [],
}) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';
  const tasks = ownerTasks;
  const categories = ownerCategories;

  const { sendTaskReaction } = useMessageActions(
    person.kind === 'friend' ? person.userId : null
  );

  const [activeView, setActiveView] = useState<ViewType>(readMeView);
  const [todoFocusDate, setTodoFocusDate] = useState(() => new Date());

  const calendarState = useCalendarState();

  const friendUserId = person.kind === 'friend' ? person.userId : null;
  const {
    tasks: friendTasks = [],
    categories: friendCategories = [],
    refetch: refetchFriendCalendar,
  } = useFriendCalendar(friendUserId);

  const lastRefetchRef = useRef<number>(0);

  useEffect(() => {
    if (person.kind !== 'friend' || !isActive) return;
    const now = Date.now();
    if (now - lastRefetchRef.current < FRIEND_REFETCH_MIN_INTERVAL_MS) return;
    lastRefetchRef.current = now;
    refetchFriendCalendar(true);
  }, [person.kind, isActive, refetchFriendCalendar]);

  const categoriesMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    for (const cat of categories) {
      map[cat.id] = { color: cat.color, name: cat.name };
    }
    return map;
  }, [categories]);

  const friendCategoriesMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    for (const cat of friendCategories) {
      map[cat.id] = { color: cat.color, name: cat.name };
    }
    return map;
  }, [friendCategories]);

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

  if (person.kind === 'friend' && friendUserId) {
    return (
      <div className="flex flex-col h-full">
        <PersonProfileHeader person={person} isActive={isActive} />
        <CalendarHeader
          title={activeView === 'todo' ? format(todoFocusDate, 'MMMM yyyy') : calendarState.title}
          viewMode={calendarState.viewMode}
          onToggleMode={calendarState.handleToggle}
          onPrev={activeView === 'todo' ? handleTodoPrev : calendarState.handlePrev}
          onNext={activeView === 'todo' ? handleTodoNext : calendarState.handleNext}
          activeView={activeView}
          onViewChange={setActiveView}
        />
        {activeView === 'calendar' ? (
          <CalendarBody
            viewMode={calendarState.viewMode}
            slides={calendarState.slides}
            renderStart={calendarState.renderStart}
            renderEnd={calendarState.renderEnd}
            emblaRef={calendarState.emblaRef}
            tasks={friendTasks}
            categoriesMap={friendCategoriesMap}
            variant="friend"
            friendCategories={friendCategories}
            friendName={person.displayName}
            friendUserId={friendUserId}
            currentUserId={currentUserId}
            isActive={isActive}
            onPrev={calendarState.handlePrev}
            onNext={calendarState.handleNext}
            onReactToTask={handleReactToTask}
          />
        ) : activeView === 'todo' ? (
          <TodoListView
            variant="friend"
            focusDate={todoFocusDate}
            tasks={friendTasks}
            categories={friendCategories}
            categoriesMap={friendCategoriesMap}
            onFocusDateChange={setTodoFocusDate}
            friendName={person.displayName}
            friendUserId={friendUserId}
            currentUserId={currentUserId}
            onReactToTask={handleReactToTask}
          />
        ) : (
          <ComingSoon />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PersonProfileHeader person={person} isActive={isActive} />
      <CalendarHeader
        title={activeView === 'todo' ? format(todoFocusDate, 'MMMM yyyy') : calendarState.title}
        viewMode={calendarState.viewMode}
        onToggleMode={calendarState.handleToggle}
        onPrev={activeView === 'todo' ? handleTodoPrev : calendarState.handlePrev}
        onNext={activeView === 'todo' ? handleTodoNext : calendarState.handleNext}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      {activeView === 'calendar' ? (
        <CalendarBody
          viewMode={calendarState.viewMode}
          slides={calendarState.slides}
          renderStart={calendarState.renderStart}
          renderEnd={calendarState.renderEnd}
          emblaRef={calendarState.emblaRef}
          tasks={tasks}
          categories={categories}
          categoriesMap={categoriesMap}
          variant="me"
          currentUserId={currentUserId}
          isActive={isActive}
          onPrev={calendarState.handlePrev}
          onNext={calendarState.handleNext}
        />
      ) : activeView === 'todo' ? (
        <TodoListView
          focusDate={todoFocusDate}
          tasks={tasks}
          categories={categories}
          categoriesMap={categoriesMap}
          onFocusDateChange={setTodoFocusDate}
        />
      ) : (
        <ComingSoon />
      )}
    </div>
  );
};
