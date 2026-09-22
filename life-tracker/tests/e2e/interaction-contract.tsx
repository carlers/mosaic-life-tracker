import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import '../../src/index.css';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';
import { useHorizontalArrowNavigation } from '../../src/hooks/useHorizontalArrowNavigation';

export function InteractionHarness() {
  const calendar = useCalendarState();
  const [friendIndex, setFriendIndex] = useState(0);
  const [todoDayIndex, setTodoDayIndex] = useState(0);

  useHorizontalArrowNavigation({
    enabled: friendIndex === 0,
    onLeft: calendar.handlePrev,
    onRight: calendar.handleNext,
  });

  return (
    <main className="min-h-screen bg-[#111111] text-white p-2">
      <div className="flex gap-4 text-sm mb-2" aria-live="polite">
        <span>Friend index: <output data-testid="friend-index">{friendIndex}</output></span>
        <span>Todo day: <output data-testid="todo-day-index">{todoDayIndex}</output></span>
        <span>Calendar: <output data-testid="calendar-title">{calendar.title}</output></span>
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
                height: 90,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #444',
              }}
            >
              Swipe here to change friend
            </div>
            <div
              data-testid="todo-region"
              className="swiper-no-swiping"
              style={{ height: 120, overflow: 'hidden', border: '1px solid #444' }}
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
            <div data-testid="calendar-region" style={{ height: 480, overflow: 'hidden' }}>
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
