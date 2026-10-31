import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import { useCategories } from '../hooks/useCategories';
import type { TaskDocument } from '../db/schema';
import { markStartup } from '../lib/startupMetrics';
import { createPreloadedLazy } from '../lib/createPreloadedLazy';
import { LazyDayViewSheet, loadDayViewSheet } from '../components/home/views/dayViewSheetModule';

const LazyHomeCommandSheet = React.lazy(() => import('../components/home/HomeCommandSheet')
  .then(module => ({ default: module.HomeCommandSheet })));

const { Component: LazyFriendCarouselSettingsSheet, preload: preloadFriendSettings } =
  createPreloadedLazy(() => import('../components/home/FriendCarouselSettingsSheet').then(m => m.FriendCarouselSettingsSheet));


// Keep Home preloads after first usable paint, with the same idle and Safari
// fallback deadlines for settings, task views and neighbor person slides.
function whenHomeIdle(work: () => void, timeout: number, fallback: number) {
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(work, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, fallback);
  return () => window.clearTimeout(id);
}

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
  const { user } = useAuth();
  const activeCommandOwner = useRef<string | null>(user?.$id ?? null);
  useEffect(() => { activeCommandOwner.current = user?.$id ?? null; }, [user?.$id]);
  const { tasks: ownerTasks = [], isLoading: tasksLoading, addTask } = useTasks();
  const {
    categories: ownerCategories = [],
    isLoading: categoriesLoading,
    addCategory,
  } = useCategories();

  const [activePersonId, setActivePersonId] = useState<string>('me');
  const [renderWindow, setRenderWindow] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSheetMounted, setSettingsSheetMounted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandMounted, setCommandMounted] = useState(false);
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

  const personIndex = persons.findIndex(p => p.id === activePersonId);
  if (persons.length > 0 && personIndex < 0) setActivePersonId('me');

  const activeIndex = Math.max(0, personIndex);

  useEffect(() => {
    markStartup('home:mounted');
  }, []);

  useEffect(() => {
    if (tasksLoading || categoriesLoading) return;
    markStartup('home:owner-data-ready');
    if (!carouselLoading) markStartup('home:local-data-ready');
  }, [carouselLoading, categoriesLoading, tasksLoading]);

  useEffect(() => {
    if (carouselLoading) return;
    markStartup('home:carousel-ready');
    // Warm only the preferences module once its owning carousel is usable.
    const warm = () => { if (!document.hidden) void preloadFriendSettings().catch(() => {}); };
    return whenHomeIdle(warm, 1800, 700);
  }, [carouselLoading]);

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
        void loadDayViewSheet()
          .then(preloadTodoListView, preloadTodoListView)
          .catch(() => { /* On-demand navigation retries failed imports. */ });
      }
    };
    return whenHomeIdle(warm, 1200, 900);
  }, [activePersonId, categoriesLoading, tasksLoading]);

  useEffect(() => whenHomeIdle(() => setRenderWindow(1), 1200, 400), []);

  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    if (personIndex < 0 || s.activeIndex === personIndex) return;
    isProgrammaticMoveRef.current = true;
    s.slideTo(personIndex, 280);
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
      if (personIndex >= 0 && s.activeIndex !== personIndex)
        s.slideTo(personIndex, 0);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length, persons.map((p) => p.id).join('|')]);

  const handleSlideChange = useCallback(
    (s: SwiperClass) => {
      if (isProgrammaticMoveRef.current) return;
      const person = persons[s.activeIndex];
      if (!person) return;
      setActivePersonId(person.id);
    },
    [persons]
  );

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
    if (searchHistoryEntryRef.current) window.history.back();
    else setIsSearchOpen(false);
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

  const openDatedTask = useCallback((date: Date, id: string | null) => {
    setSearchSelectedDate(date);
    setSearchFocusTaskId(id);
    setSearchSheetKey(current => current + 1);
    searchDaySheetOpenRef.current = true;
    setSearchDaySheetOpen(true);
  }, []);

  // Open a real dated task from the Bucket List or Uncompleted Tasks.
  useEffect(() => {
    const state = location.state as {
      bucketLinkedFocusTaskId?: string; bucketLinkedFocusDate?: string;
      focusTaskId?: string; focusTaskDate?: string; openDayViewDate?: string;
    } | null;
    const taskId = state?.focusTaskId ?? state?.bucketLinkedFocusTaskId ?? null;
    const taskDate = state?.openDayViewDate ?? state?.focusTaskDate ?? state?.bucketLinkedFocusDate;
    if (!taskDate || (!taskId && !state?.openDayViewDate)) return;
    const date = parseISO(taskDate);
    if (!isValid(date)) return;
    // Navigation is an external event. Defer this update to its microtask,
    // not a synchronous state cascade inside the effect.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      openDatedTask(date, taskId);
      // Consume the route intent exactly once, including on Android Back.
      navigate('/home', { replace: true, state: null });
    });
    return () => { cancelled = true; };
  }, [location.key, location.state, navigate, openDatedTask]);

  const handleSelectSearchTask = useCallback((task: TaskDocument) => {
    if (task.date === '') {
      setIsSearchOpen(false);
      searchHistoryEntryRef.current = false;
      navigate('/backlog', { state: { ...makeRouteParentState('/home'), focusTaskId: task.id } });
      return;
    }
    const date = parseISO(task.date);
    if (!isValid(date)) return;
    openDatedTask(date, task.id);
  }, [navigate, openDatedTask]);

  const handleCloseSearchDaySheet = useCallback(() => {
    searchDaySheetOpenRef.current = false;
    setSearchDaySheetOpen(false);
    setSearchFocusTaskId(null);
  }, []);

  const handleOpenCommand = useCallback(() => {
    setCommandMounted(true);
    setIsCommandOpen(true);
  }, []);
  const handleCreateCommandTask = useCallback(async (
    task: { title: string; categoryId: string; date: string; newCategoryName?: string },
    position: 'top' | 'bottom'
  ) => {
    const { createCommandTask } = await import('../lib/taskCommandCreation');
    await createCommandTask({
      uid: user?.$id ?? null,
      ownerValid: () => activeCommandOwner.current === user?.$id,
      loading: tasksLoading || categoriesLoading,
      categories: ownerCategories,
      addCategory, addTask, task, position,
    });
  }, [addCategory, addTask, categoriesLoading, ownerCategories, tasksLoading, user?.$id]);

  const handleSearchDateChange = useCallback((date: Date) => {
    setSearchSelectedDate(date);
    setSearchFocusTaskId(null);
  }, []);

  // Home accelerators reuse the exact existing controls/actions so that Sync
  // opens its status sheet, rather than silently initiating a network write.
  useEffect(() => {
    if (!shortcutsEnabled || isSearchOpen || isSettingsOpen || searchDaySheetOpen || isCommandOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Slash retains its native typing/overlay exclusions before the
      // modifier-gated Home shortcuts share this one listener.
      if (event.key === '/') {
        if (event.defaultPrevented || event.isComposing ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          (event.target instanceof Element && event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
          )) || document.querySelector('[aria-modal="true"]')) return;
        event.preventDefault();
        handleOpenSearch();
        return;
      }
      const homeMenuShortcut = event.key === 'H' && event.shiftKey;
      if (!canUseKeyboardShortcut(event, { allowShift: homeMenuShortcut })) return;
      if (event.key === 'f') {
        const active = friendCarouselRef.current?.querySelector<HTMLButtonElement>(
          '[data-person-pill][aria-pressed="true"]'
        );
        if (active) {
          event.preventDefault();
          active.focus({ preventScroll: true });
        }
      } else if (homeMenuShortcut || event.key === 's') {
        const trigger = document.querySelector<HTMLButtonElement>(
          homeMenuShortcut ? '[data-home-menu-trigger="true"]' : '[data-home-sync-trigger="true"]'
        );
        if (!trigger) return;
        event.preventDefault();
        trigger.click();
      } else if (event.key === 'b') {
        event.preventDefault();
        handleOpenBacklog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, isSearchOpen, isSettingsOpen, searchDaySheetOpen, isCommandOpen, handleOpenBacklog, handleOpenSearch]);

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
          onOpenCommand={handleOpenCommand}
          onClose={handleCloseSearch}
          onSelectTask={handleSelectSearchTask}
          statusControls={<HomeStatusIndicators />}
          trailing={<HamburgerMenu onOpenBacklog={handleOpenBacklog} onOpenBucketList={handleOpenBucketList} onOpenUncompleted={handleOpenUncompleted} />}
        />

        <div inert={isSearchOpen || isCommandOpen} className="flex-1 min-h-0 flex flex-col relative">
          <div className="flex-shrink-0">
            <PersonCarousel
              persons={persons}
              activePersonId={activePersonId}
              onSelect={setActivePersonId}
              focusRootRef={friendCarouselRef}
              onOpenSettings={handleOpenSettings}
            />
          </div>

          <div className="flex-1 min-h-0 relative">
          <Swiper
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            speed={280}
            resistanceRatio={0.85}
            threshold={5}
            longSwipesRatio={0.25}
            longSwipesMs={250}
            noSwiping
            noSwipingClass="swiper-no-swiping"
            allowTouchMove={!isSettingsOpen && !isSearchOpen && !isCommandOpen}
            onSlideChange={handleSlideChange}
            className="absolute inset-0"
          >
            {persons.map((p, i) => (
              <SwiperSlide key={p.id} className="h-full">
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
          inert={isSearchOpen || isCommandOpen}
          data-home-panel-slot="true"
          className="relative flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden"
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

      {commandMounted && (
        <React.Suspense fallback={null}>
          <LazyHomeCommandSheet
            key={user?.$id ?? 'signed-out'}
            isOpen={isCommandOpen}
            onClose={() => setIsCommandOpen(false)}
            ownerId={user?.$id ?? null}
            categories={ownerCategories}
            isLoading={tasksLoading || categoriesLoading}
            onCreate={handleCreateCommandTask}
          />
        </React.Suspense>
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
