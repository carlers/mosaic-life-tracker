import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { isValid, parseISO } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { HamburgerMenu } from '../components/home/HamburgerMenu';
import { HomeTaskSearch } from '../components/home/HomeTaskSearch';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { PersonPane } from '../components/home/PersonPane';
import { FriendCarouselSettingsSheet } from '../components/home/FriendCarouselSettingsSheet';
import { DayViewSheet } from '../components/home/views/DayViewSheet';
import { useFriendCarousel } from '../hooks/useFriendCarousel';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import type { TaskDocument } from '../db/schema';

const RENDER_WINDOW = 1;

export const HomePage: React.FC = () => {
  const {
    persons,
    reorder,
    toggleVisibility,
    resetOrder,
    rawFriends,
    order,
    hidden,
  } = useFriendCarousel();
  const { tasks: ownerTasks = [], isLoading: tasksLoading } = useTasks();
  const {
    categories: ownerCategories = [],
    isLoading: categoriesLoading,
  } = useCategories();

  const [activePersonId, setActivePersonId] = useState<string>('me');
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
    setIsSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSelectSearchTask = useCallback((task: TaskDocument) => {
    const date = parseISO(task.date);
    if (!isValid(date)) return;
    setSearchSelectedDate(date);
    setSearchFocusTaskId(task.id);
    setSearchSheetKey((current) => current + 1);
    setSearchDaySheetOpen(true);
  }, []);

  const handleCloseSearchDaySheet = useCallback(() => {
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
          trailing={<HamburgerMenu />}
        />

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
                {Math.abs(i - activeIndex) <= RENDER_WINDOW ? (
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
