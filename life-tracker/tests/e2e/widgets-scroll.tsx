import React, { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../../src/index.css';
import { MainLayout } from '../../src/components/layout/MainLayout';
import { WidgetLayoutGrid } from '../../src/components/home/WidgetLayoutGrid';
import { HeavyCategoriesWidget } from '../../src/components/home/WidgetCards';
import { AuthContext } from '../../src/hooks/authContext';
import { UnreadMessagesContext } from '../../src/hooks/unreadMessagesContext';
import { DEFAULT_WIDGET_LAYOUT, type WidgetLayoutItem } from '../../src/lib/widgetLayout';
import type { CategoryRangeDays, CategoryLoad } from '../../src/lib/widgetDashboardData';

export function WidgetsScrollProbe() {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<WidgetLayoutItem[]>(() =>
    DEFAULT_WIDGET_LAYOUT.map(item => ({ ...item })));
  const [range, setRange] = useState<CategoryRangeDays>(7);
  const [active, setActive] = useState(0);
  const [routeSwipes, setRouteSwipes] = useState(0);
  const categories = useMemo<CategoryLoad[]>(() => Array.from({ length: 15 }, (_, index) => ({
    id: 'c' + index, name: 'Category ' + index,
    count: 15 - index, color: '#14b8a6',
  })), []);
  return <MainLayout activeTab="home" routeKey="widgets-scroll"
    onTabChange={() => {}} routeSwipeActivationMode="home-zone"
    canSwipeLeft leftPreview={<div>Explore preview</div>}
    onRouteSwipe={() => setRouteSwipes(n => n + 1)}>
    <div className="mosaic-home-workspace flex h-full min-h-0 min-w-0"
      data-route-swipe-ignore={editing ? 'true' : undefined}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div data-route-swipe-zone="home-to-explore" className="h-14 shrink-0">
          <button type="button" onClick={() => setEditing(value => !value)} data-testid="toggle-widgets-edit">
            {editing ? 'Done' : 'Edit widgets'}
          </button>
          <output data-testid="route-swipes">{routeSwipes}</output>
          <output data-testid="swiper-active">{active}</output>
        </div>
        <div className="flex-1 min-h-0 flex flex-col relative">
          <div className="h-12 shrink-0">Widgets</div>
          <div className="flex-1 min-h-0 relative">
            <div data-mosaic-tour="calendar" className="relative h-full min-h-0 w-full">
              <Swiper initialSlide={0} speed={140} noSwiping
                noSwipingClass="swiper-no-swiping"
                allowTouchMove={!editing} allowSlidePrev={!editing} allowSlideNext={!editing}
                onSlideChange={swiper => setActive(swiper.activeIndex)}
                className="absolute inset-0">
                <SwiperSlide key="widgets" data-testid="widgets-slide-scrollport"
                  data-widgets-scrollport="true"
                  className={'h-full min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y ' +
                    (editing ? 'swiper-no-swiping' : '')}
                  style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div data-testid="widgets-page"
                    className="relative min-h-full min-w-0 touch-pan-y px-3 pt-3">
                    <div className="pb-[max(7rem,env(safe-area-inset-bottom))]">
                      <WidgetLayoutGrid items={items} editing={editing} reducedMotion={false}
                        onStartEditing={() => setEditing(true)} onPreview={setItems} onCommit={setItems}>
                        {id => id === 'categories'
                          ? <HeavyCategoriesWidget categories={categories}
                              rangeDays={range} onRangeChange={setRange} />
                          : id === 'today'
                            ? <section className="mosaic-material-control flex h-60 min-h-0 flex-col overflow-hidden rounded-2xl bg-surface px-4 py-4">
                              <h2>Today</h2>
                              <ul aria-label="Today's tasks"
                                className="mt-3 min-h-0 overflow-y-auto overscroll-auto">
                                {Array.from({ length: 24 }, (_, i) =>
                                  <li key={i} className="py-2">Task {i + 1}</li>)}
                              </ul>
                            </section>
                            : <section className="mosaic-material-control flex h-60 flex-col rounded-2xl bg-surface p-4">
                              <h2>{id}</h2><p>Widget contents</p>
                            </section>}
                      </WidgetLayoutGrid>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide key="other" className="h-full">Other Home slide</SwiperSlide>
              </Swiper>
            </div>
          </div>
        </div>
      </div>
      <div data-home-panel-slot="true"
        className="relative flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden" />
    </div>
  </MainLayout>;
}
const root = document.getElementById('root');
if (!root) throw Error('Missing root');
createRoot(root).render(<StrictMode>
  <AuthContext.Provider value={{
    user: { $id: 'user_1' } as never, isLoading: false, error: null, isOffline: false,
    login: async () => true, signup: async () => true, logout: async () => true,
    updateEmail: async () => true, updatePassword: async () => true, retry: async () => {},
  }}>
    <UnreadMessagesContext.Provider value={{ totalUnread: 0, isLoading: false }}>
      <WidgetsScrollProbe />
    </UnreadMessagesContext.Provider>
  </AuthContext.Provider>
</StrictMode>);
