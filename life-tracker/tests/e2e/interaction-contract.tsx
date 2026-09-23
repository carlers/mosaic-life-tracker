import React, { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import '../../src/index.css';
import { format } from 'date-fns';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';
import { TodoCalendarGrid } from '../../src/components/home/views/TodoCalendarGrid';
import { DaySlide } from '../../src/components/home/views/DaySlide';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { MessageComposer } from '../../src/components/messages/MessageComposer';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';
import { useHorizontalArrowNavigation } from '../../src/hooks/useHorizontalArrowNavigation';

export function InteractionHarness() {
  const calendar = useCalendarState();
  const [friendIndex, setFriendIndex] = useState(0);
  const [todoDayIndex, setTodoDayIndex] = useState(0);
  const [todoGesture, setTodoGesture] = useState('idle');
  const [fullSheetOpen, setFullSheetOpen] = useState(false);
  const [sheetDayIndex, setSheetDayIndex] = useState(0);
  const sheetSwiperRef = useRef<SwiperClass | null>(null);
  const [todoMonth, setTodoMonth] = useState(() => new Date(2026, 8, 15));
  const [todoSelectedDate, setTodoSelectedDate] = useState(
    () => new Date(2026, 8, 15)
  );
  const [composerBlurCount, setComposerBlurCount] = useState(0);

  const todoCategories: CategoryDocument[] = Array.from({ length: 5 }, (_, index) => ({
    id: `cat_${index}`,
    name: `Category ${index + 1}`,
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index],
    order: index,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  }));
  const todoTasks: TaskDocument[] = todoCategories.flatMap((category, categoryIndex) =>
    Array.from({ length: 3 }, (_, taskIndex) => ({
      id: `task_${categoryIndex}_${taskIndex}`,
      title: `Task ${categoryIndex + 1}.${taskIndex + 1}`,
      completed: false,
      categoryId: category.id,
      date: '2026-09-15',
      createdAt: '2026-09-01T00:00:00.000Z',
      completedAt: '',
      updatedAt: '2026-09-01T00:00:00.000Z',
      userId: 'user_1',
      isDeleted: false,
      visibility: 'private',
      memo: categoryIndex === 0 && taskIndex === 0 ? 'Browser memo content' : '',
    }))
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
                <SwiperSlide>
                  <div className="h-full flex items-center justify-center">Todo day 1</div>
                </SwiperSlide>
                <SwiperSlide>
                  <div className="h-full flex items-center justify-center">Todo day 2</div>
                </SwiperSlide>
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
                tasksByDate={new Map()}
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
        />
      </div>

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
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing interaction harness root');
createRoot(root).render(
  <StrictMode>
    <InteractionHarness />
  </StrictMode>
);
