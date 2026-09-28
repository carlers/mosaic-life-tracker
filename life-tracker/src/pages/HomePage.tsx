import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { isValid, parseISO } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { HamburgerMenu } from '../components/home/HamburgerMenu';
import { HomeTaskSearch } from '../components/home/HomeTaskSearch';
import { HomeStatusIndicators } from '../components/home/HomeStatusIndicators';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { PersonPane } from '../components/home/PersonPane';
import { FriendCarouselSettingsSheet } from '../components/home/FriendCarouselSettingsSheet';
import { DayViewSheet } from '../components/home/views/DayViewSheet';
import { useFriendCarousel } from '../hooks/useFriendCarousel';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import type { TaskDocument } from '../db/schema';
import { markStartup } from '../lib/startupMetrics';

const RENDER_WINDOW = 1;
const INITIAL_RENDER_WINDOW = 0;

export const HomePage: React.FC = () => {
  const {
    persons,
    reorder,
    toggleVisibility,
    resetOrder,
    rawFriends,
    order,
    hidden,
    isLoading: carouselLoading,
  } = useFriendCarousel();
  const { tasks: ownerTasks = [], isLoading: tasksLoading } = useTasks();
  const {
    categories: ownerCategories = [],
    isLoading: categoriesLoading,
  } = useCategories();

  const [activePersonId, setActivePersonId] = useState<string>('me');
  const [renderWindow, setRenderWindow] = useState(INITIAL_RENDER_WINDOW);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchDaySheetOpen, setSearchDaySheetOpen] = useState(false);
  const [searchSelectedDate, setSearchSelectedDate] = useState<Date | null>(
    null
  );
  const [searchFocusTaskId, setSearchFocusTaskId] = useState<string | null>(
    null
  );
  const [searchSheetKey, setSearchSheetKey] = useState(0);
  const searchHistoryEntryRef = useRef(false);
  const searchDaySheetOpenRef = useRef(false);

  const swiperRef = useRef<SwiperClass | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  if (persons.length > 0 && !persons.some((p) => p.id === activePersonId)) {
    setActivePersonId('me');
  }

  const activeIndex = useMemo(() => {
    const idx = persons.findIndex((p) => p.id === activePersonId);
    return idx >= 0 ? idx : 0;
  }, [persons, activePersonId]);

  useEffect(() => {
    markStartup('home:mounted');
  }, []);

  useEffect(() => {
    if (tasksLoading || categoriesLoading || carouselLoading) return;
    markStartup('home:local-data-ready');
  }, [carouselLoading, categoriesLoading, tasksLoading]);

  useEffect(() => {
    const schedule = () => setRenderWindow(RENDER_WINDOW);
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(schedule, { timeout: 1200 });
      return () => {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
      };
    }
    const timer = window.setTimeout(schedule, 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    const idx = persons.findIndex((p) => p.id === activePersonId);
    if (idx < 0) return;
    if (s.activeIndex === idx) return;
    isProgrammaticMoveRef.current = true;
    s.slideTo(idx, 280);
    const raf = requestAnimationFrame(() => {
      isProgrammaticMoveRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [activePersonId, persons]);

  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    const raf = requestAnimationFrame(() => {
      s.update();
      s.updateSize();
      s.updateSlides();
      const idx = persons.findIndex((p) => p.id === activePersonId);
      if (idx >= 0 && s.activeIndex !== idx) {
        s.slideTo(idx, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length, persons.map((p) => p.id).join('|')]);

  const handleSlideChange = useCallback(
    (s: SwiperClass) => {
      if (isProgrammaticMoveRef.current) return;
      const person = persons[s.activeIndex];
      if (!person) return;
      if (person.id !== activePersonId) setActivePersonId(person.id);
    },
    [persons, activePersonId]
  );

  const handlePillSelect = useCallback((personId: string) => {
    setActivePersonId((current) => (current === personId ? current : personId));
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setActivePersonId('me');
    if (!searchHistoryEntryRef.current) {
      window.history.pushState(
        { ...window.history.state, mosaicHomeSearch: true },
        '',
        window.location.href
      );
      searchHistoryEntryRef.current = true;
    }
    setIsSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    if (searchHistoryEntryRef.current) {
      window.history.back();
      return;
    }
    setIsSearchOpen(false);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;

    const handlePopState = () => {
      if (!searchHistoryEntryRef.current || searchDaySheetOpenRef.current) return;
      searchHistoryEntryRef.current = false;
      setIsSearchOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSearchOpen]);

  const handleSelectSearchTask = useCallback((task: TaskDocument) => {
    const date = parseISO(task.date);
    if (!isValid(date)) return;
    setSearchSelectedDate(date);
    setSearchFocusTaskId(task.id);
    setSearchSheetKey((current) => current + 1);
    searchDaySheetOpenRef.current = true;
    setSearchDaySheetOpen(true);
  }, []);

  const handleCloseSearchDaySheet = useCallback(() => {
    searchDaySheetOpenRef.current = false;
    setSearchDaySheetOpen(false);
    setSearchFocusTaskId(null);
  }, []);

  const handleSearchDateChange = useCallback((date: Date) => {
    setSearchSelectedDate(date);
    setSearchFocusTaskId(null);
  }, []);

  return (
    <>
      <div className="h-full flex flex-col min-h-0">
        <HomeTaskSearch
          isOpen={isSearchOpen}
          tasks={ownerTasks}
          categories={ownerCategories}
          isLoading={tasksLoading || categoriesLoading}
          onOpen={handleOpenSearch}
          onClose={handleCloseSearch}
          onSelectTask={handleSelectSearchTask}
          statusControls={<HomeStatusIndicators />}
          trailing={<HamburgerMenu />}
        />

        <div inert={isSearchOpen ? true : undefined} className="flex-1 min-h-0 flex flex-col relative">
          <div className="flex-shrink-0">
            <PersonCarousel
              persons={persons}
              activePersonId={activePersonId}
              onSelect={handlePillSelect}
              onOpenSettings={handleOpenSettings}
            />
          </div>

          <div className="flex-1 min-h-0 relative">
          <Swiper
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            slidesPerView={1}
            spaceBetween={0}
            speed={280}
            resistanceRatio={0.85}
            threshold={5}
            followFinger
            longSwipes
            longSwipesRatio={0.25}
            longSwipesMs={250}
            shortSwipes
            noSwiping
            noSwipingClass="swiper-no-swiping"
            allowTouchMove={!isSettingsOpen && !isSearchOpen}
            onSlideChange={handleSlideChange}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {persons.map((p, i) => (
              <SwiperSlide key={p.id} style={{ height: '100%' }}>
                {Math.abs(i - activeIndex) <= renderWindow ? (
                  <PersonPane
                    person={p}
                    isActive={i === activeIndex}
                    ownerTasks={ownerTasks}
                    ownerCategories={ownerCategories}
                  />
                ) : null}
              </SwiperSlide>
            ))}
          </Swiper>
          </div>
        </div>
      </div>

      <FriendCarouselSettingsSheet
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        friends={rawFriends}
        order={order}
        hidden={hidden}
        onReorder={reorder}
        onToggleVisibility={toggleVisibility}
        onReset={resetOrder}
      />

      {searchSelectedDate && (
        <DayViewSheet
          key={searchSheetKey}
          isOpen={searchDaySheetOpen}
          onClose={handleCloseSearchDaySheet}
          selectedDate={searchSelectedDate}
          onDateChange={handleSearchDateChange}
          tasks={ownerTasks}
          categories={ownerCategories}
          focusTaskId={searchFocusTaskId}
        />
      )}
    </>
  );
};
