import React, { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../../src/index.css';
import { format } from 'date-fns';
import { MainLayout } from '../../src/components/layout/MainLayout';
import { CalendarBody } from '../../src/components/home/views/CalendarBody';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';
import { AuthContext } from '../../src/hooks/authContext';
import { UnreadMessagesContext } from '../../src/hooks/unreadMessagesContext';
import type { TaskDocument } from '../../src/db/schema';

export function FullHeightHomeCalendarProbe() {
  const calendar = useCalendarState();
  const selectedMonth = calendar.slides[calendar.activeIndex] ?? new Date();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const realistic = new URLSearchParams(window.location.search).get('fixture') === 'observed';
  const tasks = useMemo<TaskDocument[]>(() => {
    const middle = format(new Date(year, month, 15), 'yyyy-MM-dd');
    const last = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
    const observedDays = [
      ...Array(3).fill(13), ...Array(3).fill(14),
      ...Array(14).fill(15), ...Array(4).fill(16), ...Array(3).fill(17),
      31,
    ];
    const count = realistic ? observedDays.length : 65;
    return Array.from({ length: count }, (_, index) => ({
      id: `scroll_fixture_${index}`,
      userId: 'user_1',
      title: index === count - 1 ? 'Final sparse week task' : `Middle crowded week task ${index + 1}`,
      categoryId: 'test',
      date: realistic
        ? format(new Date(year, month, observedDays[index]), 'yyyy-MM-dd')
        : index === count - 1 ? last : middle,
      order: index,
      completed: false,
      completedAt: '',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      visibility: 'private',
      memo: '',
      isDeleted: false,
    }));
  }, [year, month, realistic]);
  const mode = new URLSearchParams(window.location.search).get('mode');
  const zoomPreference = mode === 'zoom' ? 3 : 7;
  const stickyWeekdayHeader = mode === 'zoom';
  return (
    <MainLayout activeTab="home" onTabChange={() => {}} routeKey="home">
      <div className="mosaic-home-workspace flex h-full min-h-0 min-w-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className={realistic ? "shrink-0 h-24" : "shrink-0 h-12"} data-testid="home-identity-header">Home search and friends</div>
          <div className="flex-1 min-h-0 relative flex flex-col">
            <Swiper className="absolute inset-0" noSwiping noSwipingClass="swiper-no-swiping">
              <SwiperSlide className="h-full">
                <div className="flex flex-col h-full">
                  <div className={realistic ? "shrink-0 h-20" : "shrink-0 h-12"} data-testid="home-profile-header">Account profile</div>
                  <div className={realistic ? "shrink-0 h-16" : "shrink-0 h-12"} data-testid="home-calendar-header">
                    <button onClick={calendar.handleToggle} type="button" data-testid="switch-calendar-mode">Switch week/month</button>
                  </div>
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
                    categories={[]}
                    categoriesMap={{ test: { color: '#376783', name: 'Test' } }}
                    variant="me"
                    currentUserId="user_1"
                    isActive
                    zoomPreference={zoomPreference}
                    stickyWeekdayHeader={stickyWeekdayHeader}
                    onPrev={calendar.handlePrev}
                    onNext={calendar.handleNext}
                  />
                </div>
              </SwiperSlide>
            </Swiper>
          </div>
        </div>
        <div data-home-panel-slot="true" className="relative flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden" />
      </div>
      {/* Canary for a Home layout with extra content: the page must not become
          a competing native scroller while a Calendar slide is active. */}
      <div data-testid="outer-home-overflow-sentinel" aria-hidden="true" className="h-40" />
    </MainLayout>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing root');
createRoot(root).render(
  <StrictMode>
    <AuthContext.Provider value={{
      user: { $id: 'user_1' } as never,
      isLoading: false, error: null, isOffline: false,
      login: async () => true, signup: async () => true, logout: async () => true,
      updateEmail: async () => true, updatePassword: async () => true, retry: async () => {},
    }}>
      <UnreadMessagesContext.Provider value={{ totalUnread: 0, isLoading: false }}>
        <FullHeightHomeCalendarProbe />
      </UnreadMessagesContext.Provider>
    </AuthContext.Provider>
  </StrictMode>
);
