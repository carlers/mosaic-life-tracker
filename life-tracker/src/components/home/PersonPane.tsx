import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PersonProfileHeader } from './PersonProfileHeader';
import { CalendarHeader } from './views/CalendarHeader';
import { CalendarBody } from './views/CalendarBody';
import { ComingSoon } from '../layout/ComingSoon';
import { useCalendarState } from './views/useCalendarState';
import { useTasks } from '../../hooks/useTasks';
import { useCategories } from '../../hooks/useCategories';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../hooks/useAuth';
import { useFriendCalendar } from '../../lib/useFriendCalendar';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';
import type { ViewType } from './ViewSwitcher';
import type { TaskDocument } from '../../db/schema';

interface PersonPaneProps {
  person: CarouselPerson;
  isActive: boolean;
}

const VIEW_KEY = 'mosaic_activeView';

function readMeView(): ViewType {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === 'calendar' || saved === 'diary') return saved;
  return 'calendar';
}

export const PersonPane: React.FC<PersonPaneProps> = ({ person, isActive }) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';
  const isMe = person.kind === 'me';
  const [activeView, setActiveView] = useState<ViewType>(() =>
    isMe ? readMeView() : 'calendar'
  );

  if (!isMe && !isActive && activeView !== 'calendar') {
    setActiveView('calendar');
  }

  useEffect(() => {
    if (isMe) localStorage.setItem(VIEW_KEY, activeView);
  }, [isMe, activeView]);

  const calendarState = useCalendarState();
  const { resetToToday } = calendarState;

  useEffect(() => {
    if (!isActive) return;
    resetToToday();
  }, [isActive, resetToToday]);

  const { tasks: myTasks } = useTasks();
  const { categories: myCategories } = useCategories();

  const friendId = !isMe ? person.userId : null;
  const {
    tasks: friendTasks,
    categories: friendCategories,
    error: friendError,
    errorKind: friendErrorKind,
    reactToTask,
  } = useFriendCalendar(friendId);
  const { sendTaskReaction } = useMessages(friendId);

  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(t);
  }, [feedback]);

  const tasks = isMe ? myTasks : friendTasks;
  const categories = isMe ? myCategories : friendCategories;

  const categoriesMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    for (const cat of categories) {
      map[cat.id] = { color: cat.color, name: cat.name };
    }
    return map;
  }, [categories]);

  const handleReactToTask = useCallback(
    async (task: TaskDocument, emoji: string) => {
      if (isMe) return;
      try {
        const op = await reactToTask(task.id, emoji);
        if (op === 'add') {
          const cat = categories.find((c) => c.id === task.categoryId);
          await sendTaskReaction(task, emoji, cat?.color || '');
          setFeedback('Reaction sent');
        } else {
          setFeedback('Reaction removed');
        }
      } catch (err) {
        console.error('[PersonPane] reactToTask failed:', err);
        setFeedback('Reaction failed');
      }
    },
    [isMe, reactToTask, sendTaskReaction, categories]
  );

  const showDiary = isMe && activeView === 'diary';

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-shrink-0">
        <PersonProfileHeader person={person} />
      </div>
      <div className="flex-shrink-0">
        <CalendarHeader
          title={calendarState.title}
          viewMode={calendarState.viewMode}
          onToggleMode={calendarState.handleToggle}
          onPrev={calendarState.handlePrev}
          onNext={calendarState.handleNext}
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </div>
      <div className="swiper-no-swiping flex-1 min-h-0 flex flex-col overflow-hidden">
        {showDiary ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ComingSoon />
          </div>
        ) : !isMe && friendError ? (
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-6 text-center">
            <div>
              <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333] mx-auto">
                <span className="text-2xl">🔒</span>
              </div>
              <p className="text-white font-medium mb-2">
                {friendErrorKind === 'forbidden'
                  ? 'No access'
                  : friendErrorKind === 'offline'
                  ? "You're offline"
                  : "Couldn't load calendar"}
              </p>
              <p className="text-sm text-gray-500 max-w-xs">{friendError}</p>
            </div>
          </div>
        ) : (
          <CalendarBody
            viewMode={calendarState.viewMode}
            slides={calendarState.slides}
            renderStart={calendarState.renderStart}
            renderEnd={calendarState.renderEnd}
            emblaRef={calendarState.emblaRef}
            tasks={tasks}
            categoriesMap={categoriesMap}
            variant={isMe ? 'me' : 'friend'}
            friendCategories={friendCategories}
            friendName={person.displayName}
            friendUserId={friendId}
            currentUserId={currentUserId}
            onReactToTask={handleReactToTask}
          />
        )}
      </div>
      {feedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          {feedback}
        </div>
      )}
    </div>
  );
};
