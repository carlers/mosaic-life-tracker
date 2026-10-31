import React, { Profiler, StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import '../../src/index.css';
import { addMonths, format } from 'date-fns';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';
import { CalendarBody } from '../../src/components/home/views/CalendarBody';
import { TaskBlock } from '../../src/components/home/views/TaskBlock';
import { IncompleteTaskBlockColorContext } from '../../src/hooks/incompleteTaskBlockColorContext';
import { loadDayViewSheet } from '../../src/components/home/views/dayViewSheetModule';
import { TodoCalendarGrid } from '../../src/components/home/views/TodoCalendarGrid';
import { DaySlide } from '../../src/components/home/views/DaySlide';
import { DayViewSheet } from '../../src/components/home/views/DayViewSheet';
import { AuthContext } from '../../src/hooks/authContext';
import { UnreadMessagesContext } from '../../src/hooks/unreadMessagesContext';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { useRetainedSheetValue } from '../../src/hooks/useRetainedSheetValue';
import { CategoryRow } from '../../src/components/modals/CategoryManagerSheet';
import { Reorder } from 'framer-motion';
import { HomeTaskSearch } from '../../src/components/home/HomeTaskSearch';
import { MessageComposer } from '../../src/components/messages/MessageComposer';
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../../src/db/schema';
import type { DiaryPlacement } from '../../src/lib/diaryPlacement';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';
import { useHorizontalArrowNavigation } from '../../src/hooks/useHorizontalArrowNavigation';
import { PrimaryRouteSwipeSurface } from '../../src/components/layout/PrimaryRouteSwipeSurface';
import { MainLayout } from '../../src/components/layout/MainLayout';
import { RouteViewportTransition } from '../../src/components/layout/RouteViewportTransition';
import { applyAppearanceMode } from '../../src/lib/appearance';
import { SettingsRow } from '../../src/components/ui/SettingsRow';

function asRxLikeTask(task: TaskDocument): TaskDocument {
  const data = { ...task };

  return new Proxy({} as TaskDocument, {
    get(_target, property) {
      if (property === 'toJSON') {
        return () => ({ ...data });
      }
      return data[property as keyof TaskDocument];
    },
  });
}

class DayViewProbeBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div data-testid="day-view-probe-error">
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function ChatViewportMotionProbe() {
  const [chat, setChat] = useState(false);
  const route = chat ? '/messages/friend_1' : '/messages';
  const direction = chat ? 'forward' : 'backward';
  return (
    <RouteViewportTransition pathname={route} direction={direction}>
      <MainLayout
        activeTab="messages"
        routeKey={route}
        routeTransitionDirection={direction}
        onTabChange={() => {}}
        hideBottomNav={chat}
      >
        {chat ? (
          <div data-testid="motion-chat-screen" className="flex h-full min-h-0 flex-col overflow-hidden">
            <header className="shrink-0 border-b p-4">Conversation</header>
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="motion-chat-scroller">
              <div style={{ height: 1500 }}>Messages</div>
            </div>
            <footer className="shrink-0 p-3" data-testid="motion-chat-dock">
              <button type="button" data-testid="close-chat-motion" onClick={() => setChat(false)}>Back to messages</button>
            </footer>
          </div>
        ) : (
          <div data-testid="motion-messages-screen" className="min-h-full">
            <header className="p-4">Conversations</header>
            <button type="button" data-testid="open-chat-motion" onClick={() => setChat(true)}>Open conversation</button>
            <div style={{ height: 1300 }}>Conversation list</div>
          </div>
        )}
      </MainLayout>
    </RouteViewportTransition>
  );
}

/** Dedicated state owner: Day View opening must not rerender the oversized
 * interaction harness, which would contaminate cold-open measurements. */
function ColdDayViewProbe({ tasks, categories, emptyDayTasks }: {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  emptyDayTasks: boolean;
}) {
  const [dayViewSheetOpen, setDayViewSheetOpen] = useState(false);
  const [dayViewSheetMounted, setDayViewSheetMounted] = useState(false);
  const [dayViewSelectedDate, setDayViewSelectedDate] = useState(() => new Date(2026, 8, 15));
  return (
        <>
          <button
            type="button"
            data-testid="open-day-view-sheet"
            onClick={() => { setDayViewSheetMounted(true); setDayViewSheetOpen(true); }}
            className="px-3 py-2"
          >
            Open day view sheet
          </button>
          <button
            type="button"
            data-testid="open-next-day-view-sheet"
            onClick={() => {
              setDayViewSelectedDate(new Date(2026, 8, 16));
              setDayViewSheetMounted(true);
              setDayViewSheetOpen(true);
            }}
            className="px-3 py-2"
          >
            Open next day view sheet
          </button>
          <button
            type="button"
            data-testid="open-far-day-view-sheet"
            onClick={() => {
              setDayViewSelectedDate(new Date(2026, 10, 14));
              setDayViewSheetMounted(true);
              setDayViewSheetOpen(true);
            }}
          >
            Open far day view sheet
          </button>
          {dayViewSheetMounted && <DayViewProbeBoundary>
            <Profiler
              id="DayViewSheet"
              onRender={(
                id,
                phase,
                actualDuration,
                baseDuration,
                startTime,
                commitTime,
              ) => {
                const profile = {
                  id,
                  phase,
                  timestamp: Number(performance.now().toFixed(2)),
                  actualDuration: Number(actualDuration.toFixed(2)),
                  baseDuration: Number(baseDuration.toFixed(2)),
                  startTime: Number(startTime.toFixed(2)),
                  commitTime: Number(commitTime.toFixed(2)),
                  renderToCommitMs: Number((commitTime - startTime).toFixed(2)),
                };
                const profileWindow = window as typeof window & {
                  __mosaicReactProfile?: typeof profile[];
                };
                profileWindow.__mosaicReactProfile ??= [];
                profileWindow.__mosaicReactProfile.push(profile);
                console.log(`MOSAIC_REACT_PROFILE ${JSON.stringify(profile)}`);
              }}
            >
              <DayViewSheet
                isOpen={dayViewSheetOpen}
                onClose={() => setDayViewSheetOpen(false)}
                selectedDate={dayViewSelectedDate}
                onDateChange={setDayViewSelectedDate}
                tasks={emptyDayTasks ? [] : tasks}
                categories={categories}
              />
            </Profiler>
          </DayViewProbeBoundary>}
        </>
  );
}


/** Isolated, opt-in compositor probe; it must not rerender the large Calendar
 * fixture on each sheet transition. Uses the real shared BottomSheet stack. */
function NestedSheetPerformanceProbe({ blur }: { blur: boolean }) {
  const [parentOpen, setParentOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const rows = React.useMemo(
    () => Array.from({ length: 50 }, (_, index) => `Task ${index + 1}: nested sheet performance fixture`),
    []
  );
  return (
    <div>
      <button type="button" data-testid="nested-parent-open" onClick={() => setParentOpen(true)}>
        Open task list sheet
      </button>
      <Profiler id="NestedBottomSheet" onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        const profile = {
          id, phase,
          timestamp: Number(performance.now().toFixed(2)),
          actualDuration: Number(actualDuration.toFixed(2)),
          baseDuration: Number(baseDuration.toFixed(2)),
          startTime: Number(startTime.toFixed(2)),
          commitTime: Number(commitTime.toFixed(2)),
        };
        const global = window as typeof window & { __mosaicReactProfile?: typeof profile[] };
        global.__mosaicReactProfile ??= [];
        global.__mosaicReactProfile.push(profile);
      }}>
        <BottomSheet isOpen={parentOpen} onClose={() => setParentOpen(false)}
          title="Task list" height="full">
          <div data-testid="nested-parent-content">
            <button type="button" data-testid="nested-parent-close" onClick={() => setParentOpen(false)}>
              Close task list
            </button>
            <button type="button" data-testid="nested-detail-open" onClick={() => setDetailOpen(true)}>
              Open task actions
            </button>
            {rows.map((row, index) => <div key={index} className="p-3">{row}</div>)}
          </div>
        </BottomSheet>
        <BottomSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)}
          title="Task actions" backdropBlur={blur}>
          <div data-testid="nested-detail-content" className="p-5">
            <button type="button" data-testid="nested-detail-close" onClick={() => setDetailOpen(false)}>
              Close task actions
            </button>
          </div>
        </BottomSheet>
      </Profiler>
    </div>
  );
}

/** Browser ownership contract: the real DiaryEntrySheet must survive the close
 * request and finish its exit before its retained record is discarded. */
const LazyDiaryExitSheet = React.lazy(() =>
  import('../../src/components/home/views/DiaryEntrySheet')
    .then(module => ({ default: module.DiaryEntrySheet }))
);
function DiarySheetExitProbe() {
  const [opened, setOpened] = useState(false);
  const [exits, setExits] = useState(0);
  const { value: session, onExitComplete: release } = useRetainedSheetValue(
    opened ? { id: 'diary-exit-fixture', date: '2026-09-15' } : null,
    opened
  );
  return (
    <div>
      <button type="button" data-testid="diary-exit-open" onClick={() => setOpened(true)}>
        Open diary
      </button>
      <div data-testid="diary-exit-count">{exits}</div>
      {session && <React.Suspense fallback={null}>
        <LazyDiaryExitSheet key={session.id} isOpen={opened}
          date={session.date} author="Fixture" onClose={() => setOpened(false)}
          onReact={async () => {}} onReply={async () => {}}
          onExitComplete={() => { release(); setExits(count => count + 1); }} />
      </React.Suspense>}
    </div>
  );
}

/** Desktop split regression: real Embla, flex geometry, and lazy Day View
 * without authentication or network. This catches half-scrolled adjacent
 * months that a mocked DOM test cannot detect. */
function SplitPanelLayoutProbe() {
  const calendar = useCalendarState({ weekStartsOn: 0 });
  const [mode, setMode] = useState<'screen' | 'grid'>(
    new URLSearchParams(window.location.search).get('splitPanelProbe') === 'screen' ? 'screen' : 'grid'
  );
  const side = new URLSearchParams(window.location.search).get('side') === 'right' ? 'right' : 'left';
  const withRows = new URLSearchParams(window.location.search).has('splitRows');
  const categories = React.useMemo<CategoryDocument[]>(() => withRows ? [
    { id: 'split_cat_a', userId: 'user_1', name: 'Work', order: 0, color: '#3B82F6', visibility: 'private', isDeleted: false },
    { id: 'split_cat_b', userId: 'user_1', name: 'Life', order: 1, color: '#10B981', visibility: 'private', isDeleted: false },
  ] : [], [withRows]);
  const month = calendar.slides[30] ?? new Date(2026, 8, 1);
  const tasks = React.useMemo<TaskDocument[]>(() => withRows ? Array.from({ length: 42 }, (_, index) => ({
    id: `split_task_${index}`, userId: 'user_1', title: `Resize task ${index}`,
    categoryId: 'split_cat_a', date: format(new Date(month.getFullYear(), month.getMonth(), index - 6), 'yyyy-MM-dd'),
    order: index, completed: false, completedAt: '', createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z', visibility: 'private', memo: '', isDeleted: false,
  })) : [], [withRows, month]);
  return (
    <div data-testid="split-workspace" className="mosaic-home-workspace flex w-full min-w-0 bg-[#111111]" style={{ height: 750 }}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header data-testid="split-header" className="shrink-0 p-3">Search · Menu · Profile</header>
        <div className="shrink-0 px-3">
          <span data-testid="split-focused-title">{calendar.title}</span>
          <button type="button" data-testid="split-next-month" onClick={calendar.handleNext}>Next month</button>
          <button type="button" data-testid="split-toggle-height" onClick={() => setMode(value => value === 'screen' ? 'grid' : 'screen')}>Toggle height</button>
        </div>
        {/* Reproduce a shorter month grid with remaining space above the app nav. */}
        <div data-testid="split-calendar-frame" className="flex min-h-0 shrink-0 flex-col" style={{ height: 470 }}>
          <CalendarBody viewMode={calendar.viewMode}
            slides={calendar.slides} renderStart={calendar.renderStart} renderEnd={calendar.renderEnd}
            emblaRef={calendar.emblaRef} activeIndex={calendar.activeIndex}
            isZoomTransitioning={calendar.isZoomTransitioning}
            onZoomNavigate={calendar.handleZoomNavigate}
            onCalendarLayoutChange={calendar.resnapAfterResize}
            tasks={tasks} categories={categories} categoriesMap={{}} variant="me" isActive
            currentUserId="user_1" dayDetailPresentation="panel"
            dayPanelSide={side} dayPanelHeight={mode}
            onPrev={calendar.handlePrev} onNext={calendar.handleNext} />
        </div>
      </div>
      <div data-home-panel-slot="true"
        className="relative flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden" />
    </div>
  );
}

/** The actual CalendarBody / DayCell / lazy DayViewSheet entry path, rather than an isolated open button. */
function CalendarPathColdProbe({ tasks, categories }: { tasks: TaskDocument[]; categories: CategoryDocument[] }) {
  const calendar = useCalendarState();
  const [moduleReady, setModuleReady] = useState(false);
  React.useEffect(() => {
    // Test-only bridge: let the browser assert the already-warm first click
    // commits the sheet in the *same* React transaction (no lazy suspension).
    (window as typeof window & { __mosaicFlushCalendarClick?: typeof flushSync }).__mosaicFlushCalendarClick = flushSync;
    void loadDayViewSheet().then(() => setModuleReady(true));
    return () => {
      delete (window as typeof window & { __mosaicFlushCalendarClick?: typeof flushSync }).__mosaicFlushCalendarClick;
    };
  }, []);
  const categoriesMap = React.useMemo(
    () => Object.fromEntries(categories.map(category => [category.id, { name: category.name, color: category.color }])),
    [categories],
  );
  return (
    <div data-testid="real-calendar-cold-probe" data-module-ready={moduleReady ? "true" : "false"} className="flex h-[600px] w-[390px] flex-col overflow-hidden">
      <CalendarBody
        viewMode={calendar.viewMode}
        slides={calendar.slides}
        renderStart={calendar.renderStart}
        renderEnd={calendar.renderEnd}
        emblaRef={calendar.emblaRef}
        activeIndex={calendar.activeIndex}
        isZoomTransitioning={calendar.isZoomTransitioning}
        onZoomNavigate={calendar.handleZoomNavigate}
        tasks={tasks}
        categories={categories}
        categoriesMap={categoriesMap}
        variant="me"
        currentUserId="user_1"
        isActive
        onPrev={calendar.handlePrev}
        onNext={calendar.handleNext}
      />
    </div>
  );
}

export function InteractionHarness() {
  const calendar = useCalendarState();
  const searchParams = new URLSearchParams(window.location.search);
  const performanceHeavy = searchParams.get('perf') === 'heavy';
  const performanceTaskCount = searchParams.has('perfTaskCount')
    ? Math.max(0, Math.min(200, Number(searchParams.get('perfTaskCount')) || 0))
    : 50;
  const stickyCalendarProbe = searchParams.get('stickyCalendar') === '3';
  const calendarScrollProbe = searchParams.get('calendarScrollProbe') === '1';
  const compactDiaryMode = searchParams.get('compactDiary') === '1';
  const emptyDayTasks = searchParams.get('emptyDayTasks') === '1';
  const performanceCalendarPath = searchParams.get('calendarPath') === '1';
  const rxLikeLegacyTasks = searchParams.get('rxdocs') === 'legacy';
  const diaryDragProbe = searchParams.get('diaryDrag') === '1';
  const crossDayDestinations = searchParams.get('crossDayDestinations') === '1';
  const [diaryTestPlacement, setDiaryTestPlacement] = useState<DiaryPlacement>({kind: 'slot', categoryId: 'cat_0', index: 3});
  const diaryTestEntry = React.useMemo<DiaryDocument>(() => ({
    id: 'fixture_diary', userId: 'user_1', date: '2026-09-15',
    content: 'Diary drag parity fixture. Long content should follow the finger just like the full task block.',
    emoji: '✨', photos: '[]', visibility: 'private',
    createdAt: '2026-09-15T00:00:00Z', updatedAt: '2026-09-15T00:00:00Z',
    isDeleted: false,
  }), []);
  const [friendIndex, setFriendIndex] = useState(0);
  const [todoDayIndex, setTodoDayIndex] = useState(0);
  const [todoGesture, setTodoGesture] = useState('idle');
  const [fullSheetOpen, setFullSheetOpen] = useState(false);
  const [homeSearchOpen, setHomeSearchOpen] = useState(false);
  const [searchResultSheetOpen, setSearchResultSheetOpen] = useState(false);
  const [selectedSearchTask, setSelectedSearchTask] = useState<TaskDocument | null>(null);
  const [sheetDayIndex, setSheetDayIndex] = useState(0);
  const sheetSwiperRef = useRef<SwiperClass | null>(null);
  const [todoMonth, setTodoMonth] = useState(() => new Date(2026, 8, 15));
  const [todoSelectedDate, setTodoSelectedDate] = useState(
    () => new Date(2026, 8, 15)
  );
  const [composerBlurCount, setComposerBlurCount] = useState(0);
  const [primaryRoute, setPrimaryRoute] = useState<'home' | 'explore' | 'account' | 'settings' | 'friend-detail'>('home');

  const todoCategories: CategoryDocument[] = React.useMemo(() => Array.from({ length: 5 }, (_, index) => ({
    id: `cat_${index}`,
    name: `Category ${index + 1}`,
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index],
    order: index,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  })), []);
  const [todoTasks, setTodoTasks] = useState<TaskDocument[]>(() =>
    todoCategories.flatMap((category, categoryIndex) =>
      Array.from(
        {
          length: crossDayDestinations ? 3
            : !performanceHeavy && categoryIndex === 2
              ? 0
              : performanceHeavy
                ? Math.ceil(performanceTaskCount / todoCategories.length)
                : 3,
        },
        (_, taskIndex) => ({
          id: `task_${categoryIndex}_${taskIndex}`,
          title: `Task ${categoryIndex + 1}.${taskIndex + 1}`,
          completed: false,
          categoryId: category.id,
          order: rxLikeLegacyTasks ? 0 : taskIndex,
          // Controlled browser-only fixture: keep Task 1.1 on the source
          // day but distribute existing siblings across the next two
          // categories, with no extra data volume or duplicate IDs.
          date: crossDayDestinations && (categoryIndex === 1 ||
            (categoryIndex === 0 && taskIndex > 0)) ? '2026-09-16' : '2026-09-15',
          createdAt: '2026-09-01T00:00:00.000Z',
          completedAt: '',
          updatedAt: '2026-09-01T00:00:00.000Z',
          userId: 'user_1',
          isDeleted: false,
          visibility: 'private',
          memo:
            categoryIndex === 0 && taskIndex === 0
              ? 'Browser memo content'
              : '',
        }))
    )
  );
  const renderedTodoTasks = React.useMemo(
    () =>
      rxLikeLegacyTasks
        ? todoTasks.map(asRxLikeTask)
        : todoTasks,
    [rxLikeLegacyTasks, todoTasks]
  );

  const daySwipeDates = React.useMemo(() => [-1, 0, 1].map((offset) => {
    const date = new Date(2026, 8, 15 + offset);
    return { date, dateStr: format(date, 'yyyy-MM-dd') };
  }), []);

  const calendarTasksByDate = React.useMemo(() => {
    // A task-heavy final calendar week exposes whether the last preview can
    // actually be reached inside the native month scroller.
    const activeMonth = calendar.slides[calendar.activeIndex] ?? new Date();
    const date = calendarScrollProbe
      ? new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0)
      : todoSelectedDate;
    return new Map([[format(date, 'yyyy-MM-dd'), todoTasks]]);
  }, [calendar.activeIndex, calendar.slides, calendarScrollProbe, todoSelectedDate, todoTasks]);

  useHorizontalArrowNavigation({
    enabled: friendIndex === 0,
    onLeft: calendar.handlePrev,
    onRight: calendar.handleNext,
  });

  return (
    <main className="min-h-screen bg-[#111111] text-white p-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2" aria-live="polite">
        <span>Friend index: <output data-testid="friend-index">{friendIndex}</output></span>
        <span>Todo day: <output data-testid="todo-day-index">{todoDayIndex}</output></span>
        <span>Todo month: <output data-testid="todo-month">{format(todoMonth, 'MMMM yyyy')}</output></span>
        <button type="button" data-testid="compact-next-month"
          onClick={() => setTodoMonth(current => addMonths(current, 1))}>Next compact month</button>
        <button type="button" data-testid="compact-prev-month"
          onClick={() => setTodoMonth(current => addMonths(current, -1))}>Previous compact month</button>
        <button type="button" data-testid="compact-reset-today"
          onClick={() => { setTodoMonth(new Date(2026, 8, 15)); setTodoSelectedDate(new Date(2026, 8, 15)); }}>Compact back to September</button>
        <button type="button" data-testid="compact-jump-future"
          onClick={() => setTodoMonth(new Date(2032, 8, 15))}>Compact jump to September 2032</button>
        <span>Todo selected: <output data-testid="todo-selected-date">{format(todoSelectedDate, 'yyyy-MM-dd')}</output></span>
        <span>Todo gesture: <output data-testid="todo-gesture">{todoGesture}</output></span>
        <span>Calendar: <output data-testid="calendar-title">{calendar.title}</output></span>
        <span>Sheet day: <output data-testid="sheet-day-index">{sheetDayIndex}</output></span>
        <span>Primary route: <output data-testid="primary-route">{primaryRoute}</output></span>
      </div>

      <div
        className="mb-2"
        onBlurCapture={(event) => {
          if ((event.target as HTMLElement).getAttribute('aria-label') === 'Message') {
            setComposerBlurCount((count) => count + 1);
          }
        }}
      >
        <MessageComposer onSend={() => {}} placeholder="Browser message" />
        <output data-testid="composer-blur-count">{composerBlurCount}</output>
      </div>

      <button type="button" data-testid="keyboard-target" className="px-3 py-2 mb-2">
        Calendar keyboard target
      </button>
      <input
        aria-label="Editable arrow target"
        defaultValue="abcd"
        className="block bg-[#222222] px-3 py-2 mb-2"
      />

      <div style={{ height: 720, position: 'relative' }}>
        <Swiper
          slidesPerView={1}
          speed={120}
          threshold={5}
          followFinger
          longSwipes
          shortSwipes
          noSwiping
          noSwipingClass="swiper-no-swiping"
          onSlideChange={(swiper: SwiperClass) => setFriendIndex(swiper.activeIndex)}
          style={{ height: '100%' }}
        >
          <SwiperSlide style={{ height: '100%' }}>
            <div
              data-testid="friend-swipe-zone"
              style={{
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #444',
              }}
            >
              Swipe here to change friend
            </div>
            <div
              data-testid="todo-calendar-region"
              style={{ height: 250, overflow: 'hidden' }}
            >
              <TodoCalendarGrid
                focusDate={todoMonth}
                selectedDate={todoSelectedDate}
                tasks={[]}
                categories={todoCategories}
                categoriesMap={{}}
                onDateSelect={setTodoSelectedDate}
                onMonthChange={(date) => {
                  setTodoMonth(date);
                  setTodoSelectedDate(date);
                }}
                markerMode={compactDiaryMode ? 'diary' : 'todo'}
              />
            </div>
            <div
              data-testid="todo-region"
              className="swiper-no-swiping"
              style={{ height: 100, overflow: 'hidden', border: '1px solid #444' }}
            >
              <Swiper
                nested
                noSwiping={false}
                slidesPerView={1}
                speed={120}
                threshold={5}
                followFinger
                longSwipes
                shortSwipes
                onSlideChange={(swiper: SwiperClass) =>
                  setTodoDayIndex(swiper.activeIndex)
                }
                style={{ height: '100%' }}
              >
                {daySwipeDates.map(({ date, dateStr }) => (
                  <SwiperSlide key={dateStr}>
                    {performanceHeavy ? (
                      <DaySlide
                        date={date}
                        dateStr={dateStr}
                        tasks={todoTasks}
                        categories={todoCategories}
                        currentUserId="user_1"
                        editingTaskId={null}
                        editValue=""
                        onToggleTask={() => {}}
                        onAddTask={() => {}}
                        onOpenActions={() => setTodoGesture('actions')}
                        onOpenMemo={(_, mode) => setTodoGesture(`memo-${mode}`)}
                        onEditTask={() => setTodoGesture('edit')}
                        onViewImage={() => {}}
                        onEditChange={() => {}}
                        onEditSave={() => {}}
                        onEditCancel={() => {}}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">Todo day</div>
                    )}
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
            <div data-testid="calendar-region" style={{ height: 280, overflow: 'hidden', ...(stickyCalendarProbe ? { display: 'flex', flexDirection: 'column' } as const : {}) }}>
              <CalendarCarousel
                slides={calendar.slides}
                renderStart={calendar.renderStart}
                renderEnd={calendar.renderEnd}
                emblaRef={calendar.emblaRef}
                viewMode={calendar.viewMode}
                zoomDays={stickyCalendarProbe ? 3 : 7}
                stickyWeekdayHeader={stickyCalendarProbe}
                onDayClick={() => {}}
                tasksByDate={performanceHeavy ? calendarTasksByDate : new Map()}
                categoriesMap={{}}
              />
            </div>
          </SwiperSlide>
          <SwiperSlide style={{ height: '100%' }}>
            <div className="h-full flex items-center justify-center">Friend 2</div>
          </SwiperSlide>
        </Swiper>
      </div>

      <div
        data-testid="todo-full-month-scroll"
        className="swiper-no-swiping w-full max-w-full overflow-y-auto"
        style={{ height: 280, display: 'flex', flexDirection: 'column' }}
      >
        <TodoCalendarGrid
          focusDate={new Date(2026, 7, 15)}
          selectedDate={new Date(2026, 7, 15)}
          tasks={[]}
          categories={[]}
          categoriesMap={{}}
          onDateSelect={() => {}}
          onMonthChange={() => {}}
        />
        <div style={{ height: 420, flexShrink: 0 }} aria-hidden="true" />
      </div>

      <div
        data-testid="todo-day-content"
        className="swiper-no-swiping w-full max-w-full overflow-x-hidden"
      >
        <DaySlide
          date={todoSelectedDate}
          dateStr={format(todoSelectedDate, 'yyyy-MM-dd')}
          tasks={renderedTodoTasks}
          categories={todoCategories}
          currentUserId="user_1"
          editingTaskId={null}
          editValue=""
          onToggleTask={() => {}}
          onAddTask={() => {}}
          onOpenActions={() => setTodoGesture('actions')}
          onOpenMemo={(_, mode) => setTodoGesture(`memo-${mode}`)}
          onEditTask={() => setTodoGesture('edit')}
          onViewImage={() => {}}
          onEditChange={() => {}}
          onEditSave={() => {}}
          onEditCancel={() => {}}
          reorderEnabled
          diaryEnabled={diaryDragProbe}
          diaryEntryOverride={diaryDragProbe ? diaryTestEntry : undefined}
          diaryPlacement={diaryTestPlacement}
          onMoveDiary={async placement => {
            setDiaryTestPlacement(placement);
            setTodoGesture(`diary-moved:${placement.kind === 'slot' ? `${placement.categoryId}:${placement.index}` : placement.kind}`);
          }}
          onReorderTasks={(_, groups) => {
            const assignments = new Map<
              string,
              { categoryId: string; order: number }
            >();
            groups.forEach((group) => {
              group.taskIds.forEach((taskId, order) => {
                assignments.set(taskId, {
                  categoryId: group.categoryId,
                  order,
                });
              });
            });
            const updatedAt = new Date().toISOString();
            setTodoTasks((current) =>
              current.map((task) => {
                const assignment = assignments.get(task.id);
                return assignment
                  ? { ...task, ...assignment, updatedAt }
                  : task;
              })
            );

            if (groups.length === 1) {
              setTodoGesture(
                `reordered:${groups[0]?.taskIds.join(',') ?? ''}`
              );
              return;
            }
            setTodoGesture(
              `reordered:${groups
                .map(
                  (group) =>
                    `${group.categoryId}=${group.taskIds.join(',')}`
                )
                .join('|')}`
            );
          }}
          onReorderActiveChange={(active) => {
            if (active) setTodoGesture('sorting');
          }}
        />
      </div>

      <div
        data-testid="home-search-harness"
        className="relative mb-3 min-h-14 border border-[#333333]"
      >
        <HomeTaskSearch
          isOpen={homeSearchOpen}
          tasks={todoTasks}
          categories={todoCategories}
          now={new Date(2026, 8, 15, 12)}
          onOpen={() => setHomeSearchOpen(true)}
          onClose={() => setHomeSearchOpen(false)}
          onSelectTask={(task) => {
            setSelectedSearchTask(task);
            setSearchResultSheetOpen(true);
          }}
          trailing={<button type="button" className="px-2 py-1">Menu</button>}
        />
      </div>
      <BottomSheet
        isOpen={searchResultSheetOpen}
        onClose={() => setSearchResultSheetOpen(false)}
        ariaLabel="Search result day"
        height="full"
        contentMode="fixed"
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 p-4 text-center">
            Search result day
          </div>
          <div className="px-4">
            {selectedSearchTask?.title ?? 'No task selected'}
          </div>
        </div>
      </BottomSheet>

      {performanceHeavy && (performanceCalendarPath
        ? <CalendarPathColdProbe tasks={emptyDayTasks ? [] : todoTasks} categories={todoCategories} />
        : <ColdDayViewProbe tasks={todoTasks} categories={todoCategories} emptyDayTasks={emptyDayTasks} />
      )}
      <button
        type="button"
        data-testid="open-full-sheet"
        onClick={() => setFullSheetOpen(true)}
        className="px-3 py-2"
      >
        Open full sheet
      </button>
      <BottomSheet
        isOpen={fullSheetOpen}
        onClose={() => setFullSheetOpen(false)}
        ariaLabel="Responsive test sheet"
        height="full"
        contentMode="fixed"
        onHorizontalSwipe={(direction) => {
          if (direction === 'left') {
            sheetSwiperRef.current?.slideNext();
          } else {
            sheetSwiperRef.current?.slidePrev();
          }
        }}
      >
        <div
          data-testid="sheet-live-drag-header"
          data-bottom-sheet-drag-handle="true"
          className="flex min-h-12 shrink-0 cursor-grab touch-none select-none items-center justify-center"
        >
          Pull this header to close
        </div>
        <Swiper
          noSwiping
          touchStartPreventDefault={false}
          touchMoveStopPropagation={false}
          onSwiper={(swiper) => {
            sheetSwiperRef.current = swiper;
          }}
          onSlideChange={(swiper) => setSheetDayIndex(swiper.activeIndex)}
          data-bottom-sheet-native-horizontal-swipe="true"
          style={{ height: '100%', touchAction: 'pan-y' }}
        >
          <SwiperSlide style={{ height: '100%' }}>
            <div className="flex h-full min-h-0 flex-col">
              <div
                data-testid="sheet-date-row-1"
                data-bottom-sheet-directional-drag-handle
                className="p-4"
              >
                Sheet day 1 date row
              </div>
              <p className="px-4">Sheet day 1 body</p>
              <div
                data-testid="sheet-blank-swipe-zone-1"
                className="flex-1"
                aria-hidden="true"
              />
            </div>
          </SwiperSlide>
          <SwiperSlide style={{ height: '100%' }}>
            <div className="flex h-full min-h-0 flex-col">
              <div
                data-testid="sheet-date-row-2"
                data-bottom-sheet-directional-drag-handle
                className="p-4"
              >
                Sheet day 2 date row
              </div>
              <p className="px-4">Sheet day 2 body</p>
              <div className="flex-1" aria-hidden="true" />
            </div>
          </SwiperSlide>
        </Swiper>
      </BottomSheet>

      <div
        className="mt-2 h-40 overflow-hidden border border-[#333333]"
        data-testid="primary-route-harness"
      >
        <PrimaryRouteSwipeSurface
          key={primaryRoute}
          homeZoneOnly={primaryRoute === 'home'}
          activationMode={primaryRoute === 'friend-detail' ? 'edge-back' : undefined}
          canSwipeLeft={primaryRoute === 'home' || primaryRoute === 'explore' || primaryRoute === 'account'}
          canSwipeRight={
            primaryRoute === 'explore' ||
            primaryRoute === 'account' ||
            primaryRoute === 'settings' ||
            primaryRoute === 'friend-detail'
          }
          leftPreview={
            primaryRoute === 'home' ? (
              <div data-testid="primary-left-preview" className="h-full bg-[#181818] p-4">
                Explore preview
              </div>
            ) : primaryRoute === 'explore' ? (
              <div data-testid="primary-left-preview" className="h-full bg-[#181818] p-4">
                Me preview
              </div>
            ) : primaryRoute === 'account' ? (
              <div data-testid="primary-left-preview" className="h-full bg-[#181818] p-4">
                Settings preview
              </div>
            ) : null
          }
          rightPreview={
            primaryRoute === 'explore' ||
            primaryRoute === 'account' ||
            primaryRoute === 'settings' ||
            primaryRoute === 'friend-detail' ? (
              <div data-testid="primary-right-preview" className="h-full bg-[#181818] p-4">
                Previous preview
              </div>
            ) : null
          }
          onSwipe={(direction) => {
            if (primaryRoute === 'home' && direction === 'left') {
              setPrimaryRoute('explore');
            } else if (primaryRoute === 'explore' && direction === 'right') {
              setPrimaryRoute('home');
            } else if (primaryRoute === 'explore' && direction === 'left') {
              setPrimaryRoute('account');
            } else if (primaryRoute === 'account' && direction === 'left') {
              setPrimaryRoute('settings');
            } else if (primaryRoute === 'account' && direction === 'right') {
              setPrimaryRoute('explore');
            } else if (primaryRoute === 'settings' && direction === 'right') {
              setPrimaryRoute('account');
            } else if (primaryRoute === 'friend-detail' && direction === 'right') {
              setPrimaryRoute('explore');
            }
          }}
        >
          <div className={primaryRoute === 'home' ? 'flex h-40 flex-col' : 'flex min-h-[32rem] flex-col'}>
            <div
              data-testid="primary-home-menu-layer"
              data-route-swipe-zone="home-to-explore"
              className="h-12 shrink-0 touch-pan-y px-3 py-2"
            >
              Home menu layer
            </div>
            <div data-testid="primary-page-body" className="flex-1 px-3 py-2">
              {primaryRoute}
              {primaryRoute !== 'home' && (
                <div
                  data-testid="primary-page-lower-swipe-zone"
                  className="mt-[22rem] h-16"
                >
                  Lower page swipe zone
                </div>
              )}
            </div>
          </div>
        </PrimaryRouteSwipeSurface>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="set-primary-explore"
          className="mb-2 px-3 py-2"
          onClick={() => setPrimaryRoute('explore')}
        >
          Set Explore route
        </button>
        <button
          type="button"
          data-testid="set-primary-account"
          className="mb-2 px-3 py-2"
          onClick={() => setPrimaryRoute('account')}
        >
          Set Me route
        </button>
        <button
          type="button"
          data-testid="set-primary-friend-detail"
          className="mb-2 px-3 py-2"
          onClick={() => setPrimaryRoute('friend-detail')}
        >
          Set Friend detail route
        </button>
      </div>

      <div
        data-testid="appearance-sample"
        className="bg-[#111111] text-white border border-[#333333] p-2"
      >
        Appearance sample
        <div
          data-testid="appearance-surface-sample"
          className="bg-[#1E1E1E] text-gray-400 border border-[#333333] p-1"
        >
          Surface
        </div>
        <div data-testid="appearance-semantic-sample" className="bg-red-500 text-white p-1">
          Semantic
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="set-appearance-light"
          onClick={() => applyAppearanceMode('light')}
        >
          Light appearance
        </button>
        <button
          type="button"
          data-testid="set-appearance-black"
          onClick={() => applyAppearanceMode('black')}
        >
          Black appearance
        </button>
      </div>
      <section data-testid="taskblock-color-probe" data-category-color="#FF6B6B" aria-label="Calendar task color probe">
        {(['default', 'text', 'border'] as const).map(mode => (
          <IncompleteTaskBlockColorContext.Provider key={mode} value={mode}>
            <div data-testid={`incomplete-taskblock-${mode}`}>
              <TaskBlock task={todoTasks[0]} categoryColor="#FF6B6B" />
            </div>
            <div data-testid={`completed-taskblock-${mode}`}>
              <TaskBlock task={{ ...todoTasks[0], completed: true }} categoryColor="#FF6B6B" />
            </div>
          </IncompleteTaskBlockColorContext.Provider>
        ))}
      </section>

      <div data-testid="settings-switch-geometry" className="mt-3 max-w-sm">
        <SettingsRow
          icon={<span />}
          label="Switch off"
          showChevron={false}
          isToggle
          checked={false}
          onClick={() => {}}
        />
        <SettingsRow
          icon={<span />}
          label="Switch on"
          showChevron={false}
          isToggle
          checked
          onClick={() => {}}
        />
      </div>
    </main>
  );
}

/** Isolated browser fixture exercises the production category row animation. */
function CategoryEditorMotionProbe() {
  const [items, setItems] = useState<CategoryDocument[]>(() =>
    ['First', 'Second', 'Third'].map((name, order) => ({
      id: `motion_${order}`,
      name,
      color: '#64748b',
      icon: '',
      order,
      visibility: 'private',
      userId: 'fixture',
      isDeleted: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const orderSignature = items.map((item) => item.id).join('|');
  return (
    <div className="max-w-md p-4" data-testid="category-editor-motion-probe">
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
        {items.map((item) => (
          <CategoryRow
            key={item.id}
            cat={item}
            overriddenCount={0}
            isEditing={editingId === item.id}
            orderSignature={orderSignature}
            onEditStart={(category) => setEditingId(category.id)}
            onDeleteRequest={() => setEditingId(null)}
            onReorderEnd={() => {}}
            disabled={false}
          >
            {editingId === item.id && (
              <div className="space-y-3">
                <label className="block text-white">Name <input aria-label="Name" defaultValue={item.name} /></label>
                <div className="h-32 rounded-md border border-[#333333]">Visibility settings</div>
                <button type="button" onClick={() => setEditingId(null)}>Save Changes</button>
              </div>
            )}
          </CategoryRow>
        ))}
      </Reorder.Group>
    </div>
  );
}

/** Browser-only: compact calendar inside a left/right split with divider motion. */
function TodoSplitSwipeProbe() {
  const [month, setMonth] = useState(() => new Date(2026, 8, 1));
  const [day, setDay] = useState(() => new Date(2026, 8, 15));
  const [panelWidth, setPanelWidth] = useState(412);
  const side = new URLSearchParams(window.location.search).get('side') === 'right' ? 'right' : 'left';
  const realign = useRef<((live?: boolean) => void) | null>(null);
  const bindRealign = React.useCallback((fn: ((live?: boolean) => void) | null) => { realign.current = fn; }, []);
  const changePanelWidth = () => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="todo-calendar-grid"]');
    realign.current?.(true);
    if (viewport) viewport.dataset.panelMotion = 'true';
    setPanelWidth(width => width === 412 ? 500 : 412);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      realign.current?.();
      if (viewport) delete viewport.dataset.panelMotion;
    }));
  };
  return (
    <div data-testid="todo-split-probe" className="relative flex min-w-0 bg-[#111111]" style={{ width: '100%', height: 750 }}>
      <div className="shrink-0 border-r border-[#444]" style={{ width: panelWidth, order: side === 'left' ? -1 : 1 }}>
        <div>Day details · {side}</div>
        <button type="button" data-testid="todo-resize-panel" onClick={changePanelWidth}>Resize panel</button>
      </div>
      <div className="min-w-0 flex-1" style={{ order: 0 }}>
        <h2 data-testid="todo-split-month-title">{format(month, 'MMMM yyyy')}</h2>
        <div className="relative min-w-0" data-testid="todo-split-calendar-container">
          <TodoCalendarGrid focusDate={month} selectedDate={day}
            tasks={[]} categories={[]} categoriesMap={{}}
            onDateSelect={setDay} onMonthChange={setMonth}
            onLayoutChangeReady={bindRealign} />
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing interaction harness root');
createRoot(root).render(
  <StrictMode>
    <AuthContext.Provider
      value={{
        user: { $id: 'user_1' } as never,
        isLoading: false,
        error: null,
        isOffline: false,
        login: async () => true,
        signup: async () => true,
        logout: async () => true,
        updateEmail: async () => true,
        updatePassword: async () => true,
        retry: async () => {},
      }}
    >
      {new URLSearchParams(window.location.search).has('nestedSheetProbe')
        ? <NestedSheetPerformanceProbe blur={new URLSearchParams(window.location.search).get('nestedBlur') === '1'} />
        : new URLSearchParams(window.location.search).has('diaryExitProbe')
        ? <DiarySheetExitProbe />
        : new URLSearchParams(window.location.search).has('todoSplitProbe')
        ? <TodoSplitSwipeProbe />
        : new URLSearchParams(window.location.search).has('splitPanelProbe')
        ? <SplitPanelLayoutProbe />
        : new URLSearchParams(window.location.search).has('chatMotion')
        ? <UnreadMessagesContext.Provider value={{ totalUnread: 0, isLoading: false }}><ChatViewportMotionProbe /></UnreadMessagesContext.Provider>
        : new URLSearchParams(window.location.search).has('categoryMotion')
          ? <CategoryEditorMotionProbe />
          : <InteractionHarness />}
    </AuthContext.Provider>
  </StrictMode>
);
