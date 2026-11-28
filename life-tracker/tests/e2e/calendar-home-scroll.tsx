import React, { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../../src/index.css';
import '../../src/components/layout/WallpaperMaterial.css';
import { addMonths, format } from 'date-fns';
import { MainLayout } from '../../src/components/layout/MainLayout';
import { CalendarBody } from '../../src/components/home/views/CalendarBody';
import { CompactActivityOverview } from '../../src/components/home/views/CompactActivityOverview';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';
import { AuthContext } from '../../src/hooks/authContext';
import { UnreadMessagesContext } from '../../src/hooks/unreadMessagesContext';
import type { TaskDocument } from '../../src/db/schema';
import { initializeDatabase } from '../../src/db/database';
import { upsertLocalDoc } from '../../src/lib/localUpsert';
import { makeSettingsRowId } from '../../src/lib/settingsRowId';
import { FLOATING_NAV_SETTING_KEY } from '../../src/lib/floatingNavigation';

/** The real app's wallpaper owner sets the shell markers in a layout effect.
 * This account-free fixture renders a synthetic paint, so mirror that
 * lifecycle without restoring global descendant :has() dependencies. */
function FixtureHomeWallpaper() {
  const paintRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const shell = paintRef.current?.parentElement;
    if (!shell?.classList.contains('mosaic-app-layout')) return;
    shell.dataset.mosaicWallpaperHome = 'true';
    shell.dataset.mosaicWallpaperHomeMaterial = 'soft';
    shell.dataset.mosaicWallpaperHomeTransparency = '50';
    return () => {
      delete shell.dataset.mosaicWallpaperHome;
      delete shell.dataset.mosaicWallpaperHomeMaterial;
      delete shell.dataset.mosaicWallpaperHomeTransparency;
    };
  }, []);
  return <div ref={paintRef} data-home-wallpaper-paint="true" data-wallpaper-material="soft"
    data-glass-transparency="50" aria-hidden="true"
    className="pointer-events-none absolute inset-0 -z-10"
    style={{ background: 'linear-gradient(160deg, #536391, #182447 65%, #351b52)' }} />;
}

export function FullHeightHomeCalendarProbe() {
  const calendar = useCalendarState();
  // Fix the performance dataset to the logical base month.  Regenerating all
  // fixture records as soon as Embla selects a month would itself manufacture
  // a huge React workload and mask the real product behavior.
  const selectedMonth = calendar.slides[new URLSearchParams(window.location.search).get('scenario') === 'dense-performance' ? 30 : calendar.activeIndex] ?? new Date();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const scenario = new URLSearchParams(window.location.search).get('scenario');
  const reported = scenario === 'reported';
  const compact = scenario === 'compact';
  const compactPanel = new URLSearchParams(window.location.search).get('panel') === 'true';
  const glass = new URLSearchParams(window.location.search).get('glass') === 'soft';
  const densePerformance = scenario === 'dense-performance';
  const imagePerformance = densePerformance && new URLSearchParams(window.location.search).get('photos') === '1';
  const tasksPerMonth = densePerformance ? Math.max(0, Math.min(252, Number(new URLSearchParams(window.location.search).get('count') ?? 126))) : 0;
  const tasks = useMemo<TaskDocument[]>(() => {
    if (densePerformance) {
      // Stable seven-month fixture: real month, real adjacent months, fixed
      // task identity while the pointer moves, and synthetic local photo IDs.
      // The old perf=heavy fixture accidentally targeted a past, offscreen
      // date and had no images.
      return Array.from({ length: 7 }, (_, slot) => addMonths(new Date(year, month, 15), slot - 3))
        .flatMap((period, slot) => Array.from({ length: tasksPerMonth }, (_, index): TaskDocument => ({
          id: `dense_${slot}_${index}`,
          userId: 'user_1',
          title: `Calendar month ${slot} task ${index + 1}`,
          categoryId: 'test',
          date: format(new Date(period.getFullYear(), period.getMonth(), 1 + index % 28), 'yyyy-MM-dd'),
          order: index, completed: index % 5 === 0, completedAt: '',
          image: imagePerformance && index % 3 === 0 ? `perf_photo_${Math.floor(index / 3) % 12}` : undefined,
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
          visibility: 'private', memo: '', isDeleted: false,
        })));
    }
    const middle = format(new Date(year, month, 15), 'yyyy-MM-dd');
    const last = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
    // Screenshot-like October: crowded Oct 15, with 4 sparse weeks below.
    const observedDays = [
      ...Array(3).fill(13), ...Array(3).fill(14),
      ...Array(14).fill(15), ...Array(4).fill(16), ...Array(3).fill(17), 31,
    ];
    const count = reported ? observedDays.length : 65;
    return Array.from({ length: count }, (_, index) => ({
      id: `scroll_fixture_${index}`,
      userId: 'user_1',
      title: index === count - 1 ? 'Final sparse week task' : `Middle crowded week task ${index + 1}`,
      categoryId: 'test',
      date: reported
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
  }, [year, month, reported, densePerformance, imagePerformance, tasksPerMonth]);
  const mode = new URLSearchParams(window.location.search).get('mode');
  const [compactDate, setCompactDate] = React.useState(() => new Date(2026, 9, 15));
  const dense = new URLSearchParams(window.location.search).get('dense') === 'true';
  const compactCounts = useMemo(() => {
    const result = new Map<string, number>();
    if (dense) for (let y = 2025; y < 2029; y++)
      for (let m = 0; m < 12; m++)
        for (let d = 1; d <= 28; d++)
          result.set(format(new Date(y, m, d), 'yyyy-MM-dd'), 3);
    return result;
  }, [dense]);
  const [openedMonth, setOpenedMonth] = React.useState('');
  const zoomPreference = mode === 'zoom' ? 3 : 7;
  const stickyWeekdayHeader = mode === 'zoom';
  return (
    <MainLayout activeTab="home" onTabChange={() => {}} routeKey="home"
      wallpaper={glass ? <FixtureHomeWallpaper /> : null}>
      <div className="mosaic-home-workspace flex h-full min-h-0 min-w-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className={reported || compactPanel ? 'shrink-0 h-24' : 'shrink-0 h-12'} data-testid="home-identity-header">Home search and friends</div>
          <div className="flex-1 min-h-0 relative">
            <div data-mosaic-tour="calendar" className="relative h-full min-h-0">
            <Swiper className="absolute inset-0" style={{ position: 'absolute' }}
              noSwiping noSwipingClass="swiper-no-swiping">
              <SwiperSlide className="h-full">
                <div className="flex flex-col h-full">
                  <div className={reported || compactPanel ? 'shrink-0 h-16' : 'shrink-0 h-12'} data-testid="home-profile-header">Account profile</div>
                  <div className={reported || compactPanel ? 'shrink-0 h-14' : 'shrink-0 h-12'} data-testid="home-calendar-header" data-dense-calendar-performance={densePerformance ? 'true' : undefined}>
                    {compact ? <>
                      <button type="button" aria-label={mode === 'year' ? 'Previous year' : 'Previous six months'}
                        data-testid="compact-prev-arrow"
                        onClick={() => setCompactDate(date => addMonths(date, mode === 'year' ? -12 : -6))}>Previous</button>
                      <button type="button" aria-label={mode === 'year' ? 'Next year' : 'Next six months'}
                        data-testid="compact-next-arrow"
                        onClick={() => setCompactDate(date => addMonths(date, mode === 'year' ? 12 : 6))}>Next</button>
                      <output data-testid="compact-period-focus">{format(compactDate, 'yyyy-MM')}</output>
                    </> : <button onClick={calendar.handleToggle} type="button" data-testid="switch-calendar-mode">Switch week/month</button>}
                  </div>
                  {compact ? (
                    <section data-testid="compact-home-scroll"
                      className="swiper-no-swiping min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pb-8 pt-4">
                      {compactPanel && <div className="h-16" data-testid="compact-toolbar-probe" aria-hidden="true" />}
                      <CompactActivityOverview focusDate={compactDate} zoom={mode === 'year' ? 'year' : 'half-year'}
                        counts={compactCounts} weekStartsOn={0} noun="task" showTaskCounts={dense}
                        onMonthSelect={date => setOpenedMonth(format(date, 'yyyy-MM'))}
                        onPeriodChange={step => setCompactDate(date => addMonths(date, step * (mode === 'year' ? 12 : 6)))} />
                      <output data-testid="compact-month-opened">{openedMonth}</output>
                    </section>
                  ) : <CalendarBody
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
                  />}
                </div>
              </SwiperSlide>
            </Swiper>
            </div>
          </div>
        </div>
        <div data-home-panel-slot="true" className={'relative flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden' + (compactPanel ? ' w-[420px]' : '')} />
      </div>
      {/* Canary for a Home layout with extra content: the page must not become
          a competing native scroller while a Calendar slide is active. */}
      <div data-testid="outer-home-overflow-sentinel" aria-hidden="true" className="h-40" />
    </MainLayout>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing root');
async function startProbe(root: HTMLElement) {
  if (new URLSearchParams(window.location.search).get('floating') === '1') {
    await initializeDatabase();
    const id = makeSettingsRowId('user_1', FLOATING_NAV_SETTING_KEY);
    await upsertLocalDoc('settings', id, {
      id, userId: 'user_1', key: FLOATING_NAV_SETTING_KEY, value: 'true',
      isDeleted: false, updatedAt: new Date().toISOString(),
    });
  }
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
}
void startProbe(root);
