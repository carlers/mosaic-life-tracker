import React, { Profiler, StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import '../../src/index.css';
import { format } from 'date-fns';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';
import { TodoCalendarGrid } from '../../src/components/home/views/TodoCalendarGrid';
import { DaySlide } from '../../src/components/home/views/DaySlide';
import { DayViewSheet } from '../../src/components/home/views/DayViewSheet';
import { AuthContext } from '../../src/hooks/authContext';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { HomeTaskSearch } from '../../src/components/home/HomeTaskSearch';
import { MessageComposer } from '../../src/components/messages/MessageComposer';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';
import { useHorizontalArrowNavigation } from '../../src/hooks/useHorizontalArrowNavigation';
import { PrimaryRouteSwipeSurface } from '../../src/components/layout/PrimaryRouteSwipeSurface';
import { applyAppearanceMode } from '../../src/lib/appearance';
import { SettingsRow } from '../../src/components/ui/SettingsRow';

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

export function InteractionHarness() {
  const calendar = useCalendarState();
  const performanceHeavy = new URLSearchParams(window.location.search).get('perf') === 'heavy';
  const [friendIndex, setFriendIndex] = useState(0);
  const [todoDayIndex, setTodoDayIndex] = useState(0);
  const [todoGesture, setTodoGesture] = useState('idle');
  const [fullSheetOpen, setFullSheetOpen] = useState(false);
  const [dayViewSheetOpen, setDayViewSheetOpen] = useState(false);
  const [dayViewSelectedDate, setDayViewSelectedDate] = useState(
    () => new Date(2026, 8, 15)
  );
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
  const [primaryRoute, setPrimaryRoute] = useState<'home' | 'explore' | 'account' | 'settings'>('home');

  const todoCategories: CategoryDocument[] = React.useMemo(() => Array.from({ length: 5 }, (_, index) => ({
    id: `cat_${index}`,
    name: `Category ${index + 1}`,
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index],
    order: index,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  })), []);
  const todoTasks: TaskDocument[] = React.useMemo(
    () => todoCategories.flatMap((category, categoryIndex) =>
      Array.from(
        {
          length:
            !performanceHeavy && categoryIndex === 4
              ? 0
              : performanceHeavy
                ? 10
                : 3,
        },
        (_, taskIndex) => ({
        id: `task_${categoryIndex}_${taskIndex}`,
        title: `Task ${categoryIndex + 1}.${taskIndex + 1}`,
        completed: false,
        categoryId: category.id,
        order: taskIndex,
        date: '2026-09-15',
        createdAt: '2026-09-01T00:00:00.000Z',
        completedAt: '',
        updatedAt: '2026-09-01T00:00:00.000Z',
        userId: 'user_1',
        isDeleted: false,
        visibility: 'private',
        memo: categoryIndex === 0 && taskIndex === 0 ? 'Browser memo content' : '',
        })
      )
    ),
    [todoCategories, performanceHeavy]
  );

  const daySwipeDates = React.useMemo(() => [-1, 0, 1].map((offset) => {
    const date = new Date(2026, 8, 15 + offset);
    return { date, dateStr: format(date, 'yyyy-MM-dd') };
  }), []);

  const calendarTasksByDate = React.useMemo(
    () => new Map([[format(todoSelectedDate, 'yyyy-MM-dd'), todoTasks]]),
    [todoSelectedDate, todoTasks]
  );

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
            <div data-testid="calendar-region" style={{ height: 280, overflow: 'hidden' }}>
              <CalendarCarousel
                slides={calendar.slides}
                renderStart={calendar.renderStart}
                renderEnd={calendar.renderEnd}
                emblaRef={calendar.emblaRef}
                viewMode={calendar.viewMode}
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
          reorderEnabled
          onReorderTasks={(_, groups) => {
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

      {performanceHeavy && (
        <>
          <button
            type="button"
            data-testid="open-day-view-sheet"
            onClick={() => setDayViewSheetOpen(true)}
            className="px-3 py-2"
          >
            Open day view sheet
          </button>
          <button
            type="button"
            data-testid="open-next-day-view-sheet"
            onClick={() => {
              setDayViewSelectedDate(new Date(2026, 8, 16));
              setDayViewSheetOpen(true);
            }}
            className="px-3 py-2"
          >
            Open next day view sheet
          </button>
          <DayViewProbeBoundary>
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
                tasks={todoTasks}
                categories={todoCategories}
              />
            </Profiler>
          </DayViewProbeBoundary>
        </>
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
          canSwipeLeft={primaryRoute === 'home' || primaryRoute === 'explore' || primaryRoute === 'account'}
          canSwipeRight={
            primaryRoute === 'explore' ||
            primaryRoute === 'account' ||
            primaryRoute === 'settings'
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
            primaryRoute === 'settings' ? (
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
      <InteractionHarness />
    </AuthContext.Provider>
  </StrictMode>
);
