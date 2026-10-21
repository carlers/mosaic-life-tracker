import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './dayDetailPanel.css';
import { X } from 'lucide-react';
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
  onExited: () => void;
  initialHeightMode: DayPanelHeight;
  onCalendarLayoutChange?: () => void;
  initialFrameWidth: number;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onFocusCalendar?: () => void;
  isFriend: boolean;
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
  side, isPresented, onExited, initialHeightMode,
  onCalendarLayoutChange, initialFrameWidth, frameRef,
  onClose, onFocusCalendar, isFriend, selectedDate, onDateChange, tasks,
  categories, friendName, currentUserId, onReplyToTask, onReactToTask, holidayConfig,
}) => {
  const [panelWidth, setPanelWidth] = useState(readDayPanelWidth);
  const [heightMode] = useState(initialHeightMode);
  const [entered, setEntered] = useState(false);
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
      setFrameHeight(rect.height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [heightMode, frameRef]);
  const portalHost = screenPortal?.node ?? null;
  const isSplit = frameWidth >= DAY_PANEL_MIN_FRAME_WIDTH;
  const appearance = useContext(AppearanceContext);
  const reduceMotion = appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion();
  const effectivePanelWidth = clampDayPanelWidth(panelWidth, frameWidth);
  const targetWidth = effectivePanelWidth + DAY_PANEL_DIVIDER_WIDTH;
  const exitedRef = useRef(onExited);
  const realignRef = useRef(onCalendarLayoutChange);
  useEffect(() => { exitedRef.current = onExited; }, [onExited]);
  useEffect(() => { realignRef.current = onCalendarLayoutChange; }, [onCalendarLayoutChange]);

  // Keep the mounted Day View and its editing state alive through exit.
  // Reverse an in-flight close without tearing down the same inspector.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(isPresented));
    if (isPresented) return () => window.cancelAnimationFrame(frame);
    const timeout = window.setTimeout(() => exitedRef.current(), reduceMotion ? 0 : 320);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [isPresented, reduceMotion]);

  // Embla snapshots pixel widths. Shrinking from the left can leave its
  // old transform halfway across a month even after automatic observation.
  // Realign to the selected logical slide after each settled resize.
  useEffect(() => {
    const viewport = frameRef.current?.querySelector<HTMLElement>(
      '[data-route-swipe-horizontal-owner="true"]'
    );
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    let pending: number | null = null;
    let previousWidth = viewport.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = viewport.getBoundingClientRect().width;
      if (Math.abs(width - previousWidth) < 1) return;
      previousWidth = width;
      if (pending !== null) window.clearTimeout(pending);
      pending = window.setTimeout(() => realignRef.current?.(), 85);
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (pending !== null) window.clearTimeout(pending);
    };
  }, [frameRef]);

  const finishResize = () => {
    realignRef.current?.();
  };
  const panelIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const historyEntered = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => () => {
    if (panelIdRef.current) activePanelIds.delete(panelIdRef.current);
  }, []);

  const panel = (
    <div
      data-testid="day-panel-motion-host"
      data-day-panel-side={side}
      data-panel-split={isSplit ? 'true' : undefined}
      aria-hidden={!isPresented}
      inert={!isPresented}
      className={isSplit
        ? 'swiper-no-swiping relative z-10 min-h-0 shrink-0 overflow-hidden'
        : `swiper-no-swiping absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} z-20 max-w-full overflow-hidden bg-surface`}
      style={{
        width: entered ? (isSplit ? targetWidth : 'min(100%, 440px)') : 0,
        height: frameHeight || '100%',
        pointerEvents: isPresented ? 'auto' : 'none',
        transition: reduceMotion ? 'none' : 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === 'width')
          realignRef.current?.();
      }}
    >
      <div className={`flex h-full min-h-0 ${side === 'left' ? 'flex-row-reverse' : ''}`}
        style={{ width: isSplit ? targetWidth : 'min(100%, 440px)' }}>
        {isSplit && (
          <DayPanelResizeHandle
            side={side} width={effectivePanelWidth} frameWidth={frameWidth} frameRef={frameRef}
            screenHeight={Boolean(portalHost) && heightMode === 'screen'}
            onResize={setPanelWidth}
            onCommit={width => { saveDayPanelWidth(width); realignRef.current?.(); }}
            onResizeEnd={finishResize}
          />
        )}
        <div className="h-full min-h-0 shrink-0 p-2"
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
        ) : (
          <LazyDayViewSheet
            isOpen
            onClose={onClose}
            selectedDate={selectedDate}
            onDateChange={onDateChange}
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
