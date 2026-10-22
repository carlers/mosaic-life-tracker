import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './dayDetailPanel.css';
import { X } from 'lucide-react';
const DayLayoutMenu = React.lazy(() => import('./DayLayoutMenu').then(m => ({ default: m.DayLayoutMenu })));
import { isSheetVisible } from '../../../lib/sheetVisibility';
import { DayPanelResizeHandle } from './DayPanelResizeHandle';
import { clampDayPanelWidth, DAY_PANEL_MIN_FRAME_WIDTH, DAY_PANEL_DIVIDER_WIDTH, readDayPanelWidth, saveDayPanelWidth, type DayPanelSide } from '../../../lib/dayPanelLayout';
import type { DayPanelHeight } from '../../../lib/preferences';
import { systemRequestsReducedMotion } from '../../../lib/motionPreferences';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { LazyDayViewSheet } from './dayViewSheetModule';
import { LazyFriendDayViewSheet } from '../../friend/friendDayViewSheetModule';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';
import type { HolidayDisplayConfig } from '../../../lib/holidays';

const PANEL_HISTORY_KEY = '__mosaicDayDetailPanel';
const issuedPanelIds = new Set<string>();
const activePanelIds = new Set<string>();
let guardInstalled = false;
let panelHistorySequence = 0;

function readPanelId(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const value = (state as Record<string, unknown>)[PANEL_HISTORY_KEY];
  return typeof value === 'string' ? value : null;
}

function installStalePanelGuard() {
  if (guardInstalled) return;
  guardInstalled = true;
  window.addEventListener('popstate', (event) => {
    const id = readPanelId(event.state);
    if (id && issuedPanelIds.has(id) && !activePanelIds.has(id)) {
      // Closed panels must not leave a dead Back/Forward step behind.
      window.history.back();
    }
  });
}

interface DayDetailPanelProps {
  side: DayPanelSide;
  isPresented: boolean;
  persistent?: boolean;
  onExited: () => void;
  initialHeightMode: DayPanelHeight;
  onCalendarLayoutChange?: (live?: boolean) => void | Promise<void>;
  initialFrameWidth: number;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onFocusCalendar?: () => void;
  isFriend: boolean;
  showDiaryAlways?: boolean;
  friendDiaryCard?: React.ReactNode;
  friendDiaryPosition?: 'top' | 'bottom';
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName?: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  holidayConfig: HolidayDisplayConfig;
}

export const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  side, isPresented, persistent = false, onExited, initialHeightMode,
  onCalendarLayoutChange, initialFrameWidth, frameRef,
  onClose, onFocusCalendar, isFriend, showDiaryAlways = false, friendDiaryCard, friendDiaryPosition = 'top', selectedDate, onDateChange, tasks,
  categories, friendName, currentUserId, onReplyToTask, onReactToTask, holidayConfig,
}) => {
  const [panelWidth, setPanelWidth] = useState(readDayPanelWidth);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelInnerRef = useRef<HTMLDivElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const heightMode = initialHeightMode;
  const [entered, setEntered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [frameWidth, setFrameWidth] = useState(initialFrameWidth);
  const [frameHeight, setFrameHeight] = useState(0);
  const [screenPortal, setScreenPortal] = useState<{ node: HTMLDivElement | null } | null>(null);
  useLayoutEffect(() => {
    const home = frameRef.current?.closest('.mosaic-home-workspace');
    const frame = heightMode === 'screen' && home ? home : frameRef.current;
    if (!frame) return;
    setScreenPortal({ node: heightMode === 'screen'
      ? home?.querySelector<HTMLDivElement>('[data-home-panel-slot]') ?? null : null });
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setFrameWidth(rect.width);
      // In grid mode the inspector starts beneath Home chrome, but its bottom
      // is the workspace bottom, not the possibly shorter month grid.
      const homeBottom = home?.getBoundingClientRect().bottom ?? rect.bottom;
      // The panel is itself a flex child of the measured frame in grid mode.
      // Using rect.height as a minimum feeds its previous screen-mode height
      // back into the measurement after a live screen → grid switch.
      setFrameHeight(Math.max(0, homeBottom - rect.top));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    if (home && home !== frame) observer.observe(home);
    return () => observer.disconnect();
  }, [heightMode, frameRef]);
  const portalHost = screenPortal?.node ?? null;
  const isSplit = frameWidth >= DAY_PANEL_MIN_FRAME_WIDTH;
  const appearance = useContext(AppearanceContext);
  const reduceMotion = appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion();
  const effectivePanelWidth = clampDayPanelWidth(panelWidth, frameWidth);
  // Change the divider geometry directly on the panel while dragging. A
  // React update every pointer frame re-renders the whole Day View and makes
  // Motion's reorderable rows trail behind the divider.
  const targetWidth = effectivePanelWidth + DAY_PANEL_DIVIDER_WIDTH;
  const resizePanel = (width: number) => {
    if (panelRef.current) panelRef.current.style.width = `${width + DAY_PANEL_DIVIDER_WIDTH}px`;
    if (panelInnerRef.current) panelInnerRef.current.style.width = `${width + DAY_PANEL_DIVIDER_WIDTH}px`;
    if (panelContentRef.current) panelContentRef.current.style.width = `${width}px`;
  };
  const exitedRef = useRef(onExited);
  const realignRef = useRef(onCalendarLayoutChange);
  useEffect(() => { exitedRef.current = onExited; }, [onExited]);
  useEffect(() => { realignRef.current = onCalendarLayoutChange; }, [onCalendarLayoutChange]);

  // Keep the mounted Day View and its editing state alive through exit.
  // Reverse an in-flight close without tearing down the same inspector.
  useEffect(() => {
    let canceled = false;
    let frame: number | null = null;
    let timeout: number | null = null;
    // Resolve the focused month before enabling the track's CSS-bound snap,
    // otherwise its fallback translate(0) would briefly expose slide zero.
    void Promise.resolve(realignRef.current?.(true)).then(() => {
      if (canceled) return;
      viewportRef.current?.setAttribute('data-panel-motion', 'true');
      frame = window.requestAnimationFrame(() => setEntered(isPresented));
      if (!isPresented) timeout = window.setTimeout(
        () => exitedRef.current(), reduceMotion ? 0 : 320);
    });
    return () => {
      canceled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [isPresented, reduceMotion]);

  // During flex width motion, CSS keeps the selected month pinned to the
  // current viewport width; ResizeObserver JS would land one frame too late.
  useLayoutEffect(() => {
    const viewport = frameRef.current?.querySelector<HTMLElement>(
      '[data-route-swipe-horizontal-owner="true"]'
    );
    if (!viewport) return;
    viewportRef.current = viewport;
    return () => {
      delete viewport.dataset.panelMotion;
      viewportRef.current = null;
    };
  }, [frameRef]);

  const finishResize = () => {
    requestAnimationFrame(() => {
      void Promise.resolve(realignRef.current?.()).then(() => {
        delete viewportRef.current?.dataset.panelMotion;
        setDragging(false);
      });
    });
  };
  useEffect(() => {
    if (!reduceMotion || !entered || !isPresented) return;
    void Promise.resolve(realignRef.current?.()).then(() => {
      delete viewportRef.current?.dataset.panelMotion;
    });
  }, [reduceMotion, entered, isPresented]);
  const panelIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const historyEntered = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (persistent) return;
    if (!panelIdRef.current) panelIdRef.current = `mosaic-day-panel-${++panelHistorySequence}`;
    const id = panelIdRef.current;
    installStalePanelGuard();
    activePanelIds.add(id);
    if (!historyEntered.current) {
      historyEntered.current = true;
      issuedPanelIds.add(id);
      window.history.pushState(
        { ...(window.history.state ?? {}), [PANEL_HISTORY_KEY]: id },
        '', window.location.href
      );
      headingRef.current?.focus({ preventScroll: true });
    }
    const onPop = (event: PopStateEvent) => {
      if (readPanelId(event.state) !== id) onCloseRef.current();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isSheetVisible()) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onEscape);
      // React StrictMode effect replay must not consume the newly created guard.
      queueMicrotask(() => {
        if (activePanelIds.has(id)) return;
        if (readPanelId(window.history.state) === id) window.history.back();
      });
    };
  }, [persistent]);

  useEffect(() => () => {
    if (panelIdRef.current) activePanelIds.delete(panelIdRef.current);
  }, []);

  const panel = (
    <div
      ref={panelRef}
      data-testid="day-panel-motion-host"
      data-day-panel-resizing={dragging ? 'true' : undefined}
      data-day-panel-side={side}
      data-panel-split={isSplit ? 'true' : undefined}
      aria-hidden={!isPresented}
      inert={!isPresented}
      className={isSplit
        ? 'swiper-no-swiping relative z-10 min-h-0 shrink-0 overflow-hidden'
        : `swiper-no-swiping absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} z-20 max-w-full overflow-hidden bg-surface`}
      style={{
        order: side === 'left' ? -1 : 1,
        width: entered ? (isSplit ? targetWidth : 'min(100%, 440px)') : 0,
        height: frameHeight || '100%',
        pointerEvents: isPresented ? 'auto' : 'none',
        transition: reduceMotion || dragging ? 'none' : 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onTransitionEnd={event => {
        if (event.target !== event.currentTarget || event.propertyName !== 'width') return;
        void Promise.resolve(realignRef.current?.()).then(() => {
          if (isPresented) delete viewportRef.current?.dataset.panelMotion;
        });
      }}
    >
      <div ref={panelInnerRef} className={`flex h-full min-h-0 ${side === 'left' ? 'flex-row-reverse' : ''}`}
        style={{ width: isSplit ? targetWidth : 'min(100%, 440px)' }}>
        {isSplit && (
          <DayPanelResizeHandle
            side={side} width={effectivePanelWidth} frameWidth={frameWidth} frameRef={frameRef}
            screenHeight={Boolean(portalHost) && heightMode === 'screen'}
            onResize={resizePanel}
            onResizeStart={() => {
              void realignRef.current?.(true);
              viewportRef.current?.setAttribute('data-panel-motion', 'true');
              setDragging(true);
            }}
            onCommit={width => {
              setPanelWidth(width);
              saveDayPanelWidth(width);
            }}
            onResizeEnd={finishResize}
          />
        )}
        <div ref={panelContentRef} className="h-full min-h-0 shrink-0 p-2"
          style={{ width: isSplit ? effectivePanelWidth : 'min(100%, 440px)' }}>
    <aside
      aria-label="Day details"
      className="swiper-no-swiping flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--mosaic-border)] bg-surface"
      data-testid="calendar-day-side-panel"
    >
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-[var(--mosaic-border)] px-3">
        <h2 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 text-sm font-semibold text-white outline-none">
          Day details
        </h2>
        <React.Suspense fallback={null}><DayLayoutMenu /></React.Suspense>
        {onFocusCalendar && (
          <button type="button" onClick={onFocusCalendar} className="rounded p-2 text-xs text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Focus calendar">
            Calendar
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close day details" className="rounded-lg p-2 text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isFriend ? (
          <>
          {friendDiaryPosition === 'top' && friendDiaryCard}
          <LazyFriendDayViewSheet
            isOpen
            onClose={onClose}
            date={selectedDate}
            onDateChange={onDateChange}
            tasks={tasks}
            categories={categories}
            friendName={friendName ?? ''}
            currentUserId={currentUserId}
            onReplyToTask={onReplyToTask}
            onReactToTask={onReactToTask}
            holidayConfig={holidayConfig}
            renderMode="panel"
          />
          {friendDiaryPosition === 'bottom' && friendDiaryCard}
          </>
        ) : (
          <LazyDayViewSheet
            isOpen
            onClose={onClose}
            selectedDate={selectedDate}
            onDateChange={onDateChange}
            showDiaryAlways={showDiaryAlways}
            tasks={tasks}
            categories={categories}
            holidayConfig={holidayConfig}
            renderMode="panel"
          />
        )}
      </div>
    </aside>
        </div>
      </div>
    </div>
  );
  if (heightMode === 'screen' && screenPortal === null) return null;
  return portalHost && heightMode === 'screen'
    ? createPortal(panel, portalHost)
    : panel;
};
