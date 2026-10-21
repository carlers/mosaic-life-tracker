import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { makeRouteParentState } from '../lib/primarySwipeNavigation';
import { canUseKeyboardShortcut } from '../lib/keyboardShortcuts';
import { useKeyboardShortcuts } from '../hooks/keyboardShortcutsContext';
import { isValid, parseISO } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { HamburgerMenu } from '../components/home/HamburgerMenu';
import { HomeTaskSearch } from '../components/home/HomeTaskSearch';
import { HomeStatusIndicators } from '../components/home/HomeStatusIndicators';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { PersonPane } from '../components/home/PersonPane';
import { preloadTodoListView } from '../components/home/views/todoListViewModule';
import { useFriendCarousel } from '../hooks/useFriendCarousel';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import type { TaskDocument } from '../db/schema';
import { markStartup } from '../lib/startupMetrics';
import { createPreloadedLazy } from '../lib/createPreloadedLazy';
import { LazyDayViewSheet, loadDayViewSheet } from '../components/home/views/dayViewSheetModule';

const { Component: LazyFriendCarouselSettingsSheet, preload: preloadFriendSettings } =
  createPreloadedLazy(() => import('../components/home/FriendCarouselSettingsSheet').then(m => m.FriendCarouselSettingsSheet));

const RENDER_WINDOW = 1;
const INITIAL_RENDER_WINDOW = 0;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { enabled: shortcutsEnabled } = useKeyboardShortcuts();
  const location = useLocation();
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
  const [settingsSheetMounted, setSettingsSheetMounted] = useState(false);
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
  const friendCarouselRef = useRef<HTMLDivElement>(null);
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
    if (tasksLoading || categoriesLoading) return;
    markStartup('home:owner-data-ready');
  }, [categoriesLoading, tasksLoading]);

  useEffect(() => {
    if (carouselLoading) return;
    markStartup('home:carousel-ready');
    // Warm only the preferences module once its owning carousel is usable.
    const warm = () => { if (!document.hidden) void preloadFriendSettings().catch(() => {}); };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 700);
    return () => window.clearTimeout(id);
  }, [carouselLoading]);

  useEffect(() => {
    if (tasksLoading || categoriesLoading || carouselLoading) return;
    markStartup('home:local-data-ready');
  }, [carouselLoading, categoriesLoading, tasksLoading]);

  // Warm the code after first usable local Home data, never in the startup graph.
  // This does not mount the sheet or start its data hooks. Early taps still load
  // on demand through the same cached import.
  useEffect(() => {
    // Friend/profile reads can remain pending while the owner Calendar is usable.
    // They must not indefinitely suppress idle Day View module warmup.
    if (tasksLoading || categoriesLoading || activePersonId !== 'me') return;

    const warm = () => {
      if (document.visibilityState === 'visible') {
        // After Calendar is usable, warm the shared Todo/Diary module too.
        // Delay its JS evaluation until after the critical Calendar path;
        // no task view, provider or offscreen DOM is mounted by this work.
        void loadDayViewSheet().catch(() => {}).then(() =>
          preloadTodoListView().catch(() => {
            // On-demand navigation will retry a failed module import.
          })
        );
      }
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(id);
    }
    // Safari fallback retains the delayed, startup-safe import.
    const id = window.setTimeout(warm, 900);
    return () => window.clearTimeout(id);
  }, [activePersonId, categoriesLoading, tasksLoading]);

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
    setSettingsSheetMounted(true);
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

  const handleOpenBucketList = useCallback(() => {
    navigate('/bucket-list', { state: makeRouteParentState('/home') });
  }, [navigate]);

  const handleOpenBacklog = useCallback(() => {
    navigate('/backlog', { state: makeRouteParentState('/home') });
  }, [navigate]);

  const handleOpenUncompleted = useCallback(() => {
    navigate('/backlog?view=uncompleted', { state: makeRouteParentState('/home') });
  }, [navigate]);

  // Open a real dated task from the Bucket List or Uncompleted Tasks.
  useEffect(() => {
    const state = location.state as { bucketLinkedFocusTaskId?: string; bucketLinkedFocusDate?: string; focusTaskId?: string; focusTaskDate?: string } | null;
    const taskId = state?.focusTaskId ?? state?.bucketLinkedFocusTaskId;
    const taskDate = state?.focusTaskDate ?? state?.bucketLinkedFocusDate;
    if (!taskId || !taskDate) return;
    const date = parseISO(taskDate);
    if (!isValid(date)) return;
    // Navigation is an external event. Defer this update to its microtask,
    // not a synchronous state cascade inside the effect.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSearchSelectedDate(date);
      setSearchFocusTaskId(taskId);
      setSearchSheetKey(current => current + 1);
      searchDaySheetOpenRef.current = true;
      setSearchDaySheetOpen(true);
      // Consume the route intent exactly once, including on Android Back.
      navigate('/home', { replace: true, state: null });
    });
    return () => { cancelled = true; };
  }, [location.key, location.state, navigate]);

  const handleSelectSearchTask = useCallback((task: TaskDocument) => {
    if (task.date === '') {
      setIsSearchOpen(false);
      searchHistoryEntryRef.current = false;
      navigate('/backlog', { state: { ...makeRouteParentState('/home'), focusTaskId: task.id } });
      return;
    }
    const date = parseISO(task.date);
    if (!isValid(date)) return;
    setSearchSelectedDate(date);
    setSearchFocusTaskId(task.id);
    setSearchSheetKey((current) => current + 1);
    searchDaySheetOpenRef.current = true;
    setSearchDaySheetOpen(true);
  }, [navigate]);

  const handleCloseSearchDaySheet = useCallback(() => {
    searchDaySheetOpenRef.current = false;
    setSearchDaySheetOpen(false);
    setSearchFocusTaskId(null);
  }, []);

  const handleSearchDateChange = useCallback((date: Date) => {
    setSearchSelectedDate(date);
    setSearchFocusTaskId(null);
  }, []);

  // F jumps directly to the selected person without switching their calendar.
  // Left/Right in the carousel moves focus; Enter/Space activates that person.
  useEffect(() => {
    if (!shortcutsEnabled || isSearchOpen || isSettingsOpen || searchDaySheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.key.length !== 1 ||
          !canUseKeyboardShortcut(event)) return;
      const active = friendCarouselRef.current?.querySelector<HTMLButtonElement>(
        '[data-person-pill][aria-pressed="true"]'
      );
      if (!active) return;
      event.preventDefault();
      active.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, isSearchOpen, isSettingsOpen, searchDaySheetOpen]);

  // Home-only search launcher. Keep native typing and all nested sheet
  // keyboard ownership untouched; the existing Search control still handles
  // Escape and focus when the field opens.
  useEffect(() => {
    if (!shortcutsEnabled || isSearchOpen || isSettingsOpen || searchDaySheetOpen) return;
    const handleSlash = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.target instanceof Element && event.target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
        )) || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      handleOpenSearch();
    };
    window.addEventListener('keydown', handleSlash);
    return () => window.removeEventListener('keydown', handleSlash);
  }, [shortcutsEnabled, handleOpenSearch, isSearchOpen, isSettingsOpen, searchDaySheetOpen]);

  // Home accelerators reuse the exact existing controls/actions so that Sync
  // opens its status sheet, rather than silently initiating a network write.
  useEffect(() => {
    if (!shortcutsEnabled || isSearchOpen || isSettingsOpen || searchDaySheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const homeMenuShortcut = event.key === 'H' && event.shiftKey;
      if (!canUseKeyboardShortcut(event, { allowShift: homeMenuShortcut })) return;
      if (homeMenuShortcut) {
        const menu = document.querySelector<HTMLButtonElement>('[data-home-menu-trigger="true"]');
        if (!menu) return;
        event.preventDefault();
        menu.click();
      } else if (event.key === 's') {
        const sync = document.querySelector<HTMLButtonElement>('[data-home-sync-trigger="true"]');
        if (!sync) return;
        event.preventDefault();
        sync.click();
      } else if (event.key === 'b') {
        event.preventDefault();
        handleOpenBacklog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, isSearchOpen, isSettingsOpen, searchDaySheetOpen, handleOpenBacklog]);

  return (
    <>
      <div
        className="mosaic-home-workspace flex h-full min-h-0 min-w-0"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <HomeTaskSearch
          isOpen={isSearchOpen}
          tasks={ownerTasks}
          categories={ownerCategories}
          isLoading={tasksLoading || categoriesLoading}
          onOpen={handleOpenSearch}
          onClose={handleCloseSearch}
          onSelectTask={handleSelectSearchTask}
          statusControls={<HomeStatusIndicators />}
          trailing={<HamburgerMenu onOpenBacklog={handleOpenBacklog} onOpenBucketList={handleOpenBucketList} onOpenUncompleted={handleOpenUncompleted} />}
        />

        <div inert={isSearchOpen ? true : undefined} className="flex-1 min-h-0 flex flex-col relative">
          <div className="flex-shrink-0">
            <PersonCarousel
              persons={persons}
              activePersonId={activePersonId}
              onSelect={handlePillSelect}
              focusRootRef={friendCarouselRef}
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
        <div
          inert={isSearchOpen ? true : undefined}
          data-home-panel-slot="true"
          className="flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden"
        />
      </div>

      {settingsSheetMounted && (
          <LazyFriendCarouselSettingsSheet
            isOpen={isSettingsOpen}
            onClose={handleCloseSettings}
            friends={rawFriends}
            order={order}
            hidden={hidden}
            onReorder={reorder}
            onToggleVisibility={toggleVisibility}
            onReset={resetOrder}
          />
      )}

      {searchSelectedDate && (
        <LazyDayViewSheet
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
