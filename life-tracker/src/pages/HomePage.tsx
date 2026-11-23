import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { makeRouteParentState } from '../lib/primarySwipeNavigation';
import { whenHomeIdle } from '../lib/whenHomeIdle';
import { isValid, parseISO } from 'date-fns';
import { LayoutDashboard } from 'lucide-react';
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
import { useFeatureEnabled } from '../hooks/useFeatureEnabled';
import { useHomeOwnerCollections } from '../hooks/useHomeOwnerCollections';
import type { TaskDocument } from '../db/schema';
import { markStartup } from '../lib/startupMetrics';
import { AppearanceContext } from '../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../lib/motionPreferences';
import { createPreloadedLazy } from '../lib/createPreloadedLazy';
import { LazyDayViewSheet, loadDayViewSheet } from '../components/home/views/dayViewSheetModule';

// New-owner invitations and replay/history are optional, not Calendar startup work.
const LazyHomeTourExperience = React.lazy(() => import('../components/onboarding/HomeTourExperience'));
const LazyHomeKeyboardShortcuts = React.lazy(() => import('../lib/HomeKeyboardShortcutBridge'));
const loadWidgetsPage = () => import('../components/home/WidgetsPage');
const LazyWidgetsPage = React.lazy(() => loadWidgetsPage().then(module => ({ default: module.WidgetsPage })));
const LazyWidgetsHeader = React.lazy(() => loadWidgetsPage().then(module => ({ default: module.WidgetsHeader })));
const WIDGETS_SLIDE_ID = '__mosaic_widgets__';

const { Component: LazyFriendCarouselSettingsSheet, preload: preloadFriendSettings } =
  createPreloadedLazy(() => import('../components/home/FriendCarouselSettingsSheet').then(m => m.FriendCarouselSettingsSheet));


export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const appearance = React.useContext(AppearanceContext);
  const reduceMotion = appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion();
  const personSlideSpeed = reduceMotion ? 0 : 320;
  const taskSearchEnabled = useFeatureEnabled('mosaic_disable_task_search');
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
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
  const {
    tasks: ownerTasks = [],
    categories: ownerCategories = [],
    isTasksLoading: tasksLoading,
    isCategoriesLoading: categoriesLoading,
  } = useHomeOwnerCollections();

  const [activePersonId, setActivePersonId] = useState<string>('me');
  const [renderWindow, setRenderWindow] = useState(0);
  const [hasVisitedWidgets, setHasVisitedWidgets] = useState(false);
  const [todayOpenRequest, setTodayOpenRequest] = useState<{ key: number; date: Date } | null>(null);
  const [menuShortcut, setMenuShortcut] = useState<{ key: string; action: 'menu' | 'categories' } | null>(null);
  const [viewShortcut, setViewShortcut] = useState<{ key: string; view: 'calendar' | 'todo' | 'diary' } | null>(null);
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
  const widgetTapPendingRef = useRef(false);
  const todayRequestSeqRef = useRef(0);

  const visiblePersons = React.useMemo(() => socialEnabled ? persons : persons.filter(p => p.kind === 'me'), [persons, socialEnabled]);
  const widgetsActive = activePersonId === WIDGETS_SLIDE_ID;
  const personIndex = widgetsActive ? -1 : visiblePersons.findIndex(p => p.id === activePersonId);
  if (visiblePersons.length > 0 && personIndex < 0 && !widgetsActive) setActivePersonId('me');

  // Keep Me at the original Home default; Widgets is the extra left neighbor.
  const activeIndex = widgetsActive ? 0 : Math.max(0, personIndex) + 1;

  useEffect(() => {
    markStartup('home:mounted');
  }, []);

  // Owner-local query completion is the readiness boundary for Home and
  // adjacent-route warmup. An optional remote social profile must not hold it.
  useEffect(() => {
    if (tasksLoading || categoriesLoading) return;
    markStartup('home:owner-data-ready');
    markStartup('home:local-data-ready');
  }, [categoriesLoading, tasksLoading]);

  useEffect(() => {
    if (carouselLoading || !socialEnabled) return;
    markStartup('home:carousel-ready');
    // Warm only the preferences module once its owning carousel is usable.
    const warm = () => { if (!document.hidden) void preloadFriendSettings().catch(() => {}); };
    return whenHomeIdle(warm, 1800, 700);
  }, [carouselLoading, socialEnabled]);

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

  const handleWidgetTodayConsumed = useCallback((key: number) => {
    setTodayOpenRequest(current => current?.key === key ? null : current);
  }, []);

  const handleWidgetTodayOpen = useCallback(() => {
    if (widgetTapPendingRef.current) return;
    widgetTapPendingRef.current = true;
    const date = new Date();
    setActivePersonId('me');
    void import('../lib/widgetSlideSettle').then(({ settleWidgetReturn }) => {
      settleWidgetReturn(swiperRef.current, personSlideSpeed, success => {
        widgetTapPendingRef.current = false;
        if (success) setTodayOpenRequest({ key: ++todayRequestSeqRef.current, date });
      });
    }).catch(() => { widgetTapPendingRef.current = false; });
  }, [personSlideSpeed]);

  useEffect(() => {
    const s = swiperRef.current;
    if (s && s.activeIndex !== activeIndex) s.slideTo(activeIndex, personSlideSpeed);
  }, [activeIndex, personSlideSpeed]);

  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    const sync = (keepSwipe = false) => {
      if (s.destroyed) return;
      const target = keepSwipe ? s.activeIndex : activeIndex;
      s.update();
      if (s.activeIndex !== target) s.slideTo(target, 0);
    };
    // A friend-list refresh cannot undo an in-flight swipe on release.
    const settleSync = () => sync(true);
    const raf = requestAnimationFrame(() => {
      if (s.animating) s.once('transitionEnd', settleSync);
      else sync();
    });
    return () => {
      cancelAnimationFrame(raf);
      s.off('transitionEnd', settleSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePersons.length, visiblePersons.map((p) => p.id).join('|')]);

  // Avoid committing and activating heavy Calendar panes while Swiper is still
  // animating its release. Gesture translation stays owned by Swiper.
  const handleSlideChange = useCallback(
    (s: SwiperClass) => {
      if (s.activeIndex === 0) {
        setHasVisitedWidgets(true);
        setActivePersonId(WIDGETS_SLIDE_ID);
        return;
      }
      const person = visiblePersons[s.activeIndex - 1];
      if (!person) return;
      setActivePersonId(person.id);
    },
    [visiblePersons]
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsSheetMounted(true);
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    if (!taskSearchEnabled) return;
    // Opening Search replaces its header: expire any earlier Menu shortcut
    // before that header remounts, so only a fresh gesture can reopen Menu.
    setMenuShortcut(null);
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
  }, [taskSearchEnabled]);

  const handleCloseSearch = useCallback(() => {
    if (searchHistoryEntryRef.current) window.history.back();
    else setIsSearchOpen(false);
  }, []);


  useEffect(() => {
    if (taskSearchEnabled || (!isSearchOpen && !searchDaySheetOpen)) return;
    // Defer local state updates to avoid synchronous state writes inside an effect.
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (isSearchOpen) handleCloseSearch();
      if (searchDaySheetOpen) {
        searchDaySheetOpenRef.current = false;
        setSearchDaySheetOpen(false);
      }
    });
    return () => { active = false; };
  }, [taskSearchEnabled, isSearchOpen, searchDaySheetOpen, handleCloseSearch]);

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

  const handleSearchDateChange = useCallback((date: Date) => {
    setSearchSelectedDate(date);
    setSearchFocusTaskId(null);
  }, []);

  return (
    <>
      <React.Suspense fallback={null}>
        <LazyHomeKeyboardShortcuts
          isSearchOpen={isSearchOpen} isSettingsOpen={isSettingsOpen}
          searchDaySheetOpen={searchDaySheetOpen} taskSearchEnabled={taskSearchEnabled}
          friendCarouselRef={friendCarouselRef}
          handleOpenBacklog={handleOpenBacklog} handleOpenSearch={handleOpenSearch}
          routeState={location.state} routeKey={location.key} navigate={navigate}
          setMenuShortcut={setMenuShortcut} setViewShortcut={setViewShortcut}
          setActivePersonId={setActivePersonId}
        />
      </React.Suspense>
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
          trailing={<div className="flex items-center gap-2">
            {!isSearchOpen && <button type="button" aria-label={widgetsActive ? 'Back to Home' : 'Open Widgets'}
              onClick={() => {
                if (!widgetsActive) setHasVisitedWidgets(true);
                setActivePersonId(widgetsActive ? 'me' : WIDGETS_SLIDE_ID);
              }}
              className="mosaic-action-icon mosaic-material-control rounded-lg bg-[#1E1E1E] p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
              <LayoutDashboard size={20} aria-hidden="true" />
            </button>}
            <HamburgerMenu onOpenBacklog={handleOpenBacklog} onOpenBucketList={handleOpenBucketList} onOpenUncompleted={handleOpenUncompleted} shortcutRequest={menuShortcut} />
          </div>}
        />

        <div inert={isSearchOpen && taskSearchEnabled} className="flex-1 min-h-0 flex flex-col relative">
          <div className={'relative flex-shrink-0 ' + (socialEnabled || widgetsActive ? 'h-12' : 'h-0')}>
            {socialEnabled && (
              <div inert={widgetsActive} aria-hidden={widgetsActive}
                className={'absolute inset-0 transition-opacity duration-200 ' +
                  (widgetsActive ? 'pointer-events-none opacity-0' : 'opacity-100')}>
                <PersonCarousel
                  persons={visiblePersons}
                  activePersonId={widgetsActive ? 'me' : activePersonId}
                  onSelect={setActivePersonId}
                  focusRootRef={friendCarouselRef}
                  onOpenSettings={handleOpenSettings}
                />
              </div>
            )}
            {(hasVisitedWidgets || widgetsActive) && (
              <div inert={!widgetsActive} aria-hidden={!widgetsActive}
                className={'absolute inset-0 transition-opacity duration-200 ' +
                  (widgetsActive ? 'opacity-100' : 'pointer-events-none opacity-0')}>
                <React.Suspense fallback={<div className="px-4 py-3 text-sm font-semibold text-white">Widgets</div>}>
                  <LazyWidgetsHeader onBack={() => setActivePersonId('me')} />
                </React.Suspense>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 relative">
          <div data-mosaic-tour="calendar" className="relative h-full min-h-0">
          <Swiper
            initialSlide={1}
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            speed={personSlideSpeed}
            resistanceRatio={0.48}
            threshold={6}
            longSwipesRatio={0.38}
            longSwipesMs={260}
            noSwiping
            noSwipingClass="swiper-no-swiping"
            allowTouchMove={!isSettingsOpen && !isSearchOpen}
            onSlideChange={reduceMotion ? handleSlideChange : undefined}
            onTransitionEnd={handleSlideChange}
            onTouchStart={s => {
              if (s.activeIndex <= 1) void loadWidgetsPage().catch(() => {});
            }}
            style={{ position: 'absolute', '--swiper-wrapper-transition-timing-function': 'cubic-bezier(0.3, 0.7, 0.35, 1)' } as React.CSSProperties}
            className="absolute inset-0"
          >
            <SwiperSlide key="widgets" className="h-full" inert={!widgetsActive} aria-hidden={!widgetsActive}>
              {hasVisitedWidgets || widgetsActive ? (
                <React.Suspense fallback={<div className="px-3 pt-3"><div className="rounded-2xl border border-[#333333] bg-surface px-4 py-4 text-sm font-semibold text-white">Today</div></div>}>
                  <LazyWidgetsPage tasks={ownerTasks} categories={ownerCategories}
                    onOpenToday={handleWidgetTodayOpen} />
                </React.Suspense>
              ) : activeIndex === 1 ? (
                <div aria-hidden="true" className="px-3 pt-3">
                  <div className="rounded-2xl border border-[#333333] bg-surface px-4 py-4 text-sm font-semibold text-white">Today</div>
                </div>
              ) : null}
            </SwiperSlide>
            {visiblePersons.map((p, i) => (
              <SwiperSlide key={p.id} className="h-full">
                {Math.abs(i + 1 - activeIndex) <= renderWindow ? (
                  <PersonPane
                    person={p}
                    isActive={i + 1 === activeIndex}
                    ownerTasks={ownerTasks}
                    ownerCategories={ownerCategories}
                    shortcutView={p.kind === 'me' ? viewShortcut : null}
                    widgetTodayRequest={p.kind === 'me' ? todayOpenRequest : null}
                    onWidgetTodayConsumed={p.kind === 'me' ? handleWidgetTodayConsumed : undefined}
                  />
                ) : null}
              </SwiperSlide>
            ))}
          </Swiper>
          </div>
          </div>
        </div>
        </div>
        <div
          inert={isSearchOpen && taskSearchEnabled}
          data-home-panel-slot="true"
          className="relative flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden"
        />
      </div>

      {!tasksLoading && !categoriesLoading && (
        <React.Suspense fallback={null}>
          <LazyHomeTourExperience taskCount={ownerTasks.length} setActivePersonId={setActivePersonId} />
        </React.Suspense>
      )}

      {socialEnabled && settingsSheetMounted && (
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
