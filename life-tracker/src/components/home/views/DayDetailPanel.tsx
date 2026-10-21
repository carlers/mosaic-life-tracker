import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { isSheetVisible } from '../../../lib/sheetVisibility';
import { DayPanelResizeHandle } from './DayPanelResizeHandle';
import { clampDayPanelWidth, readDayPanelWidth, saveDayPanelWidth, type DayPanelSide } from '../../../lib/dayPanelLayout';
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
  isSplit: boolean;
  frameWidth: number;
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
  side, isSplit, frameWidth, frameRef,
  onClose, onFocusCalendar, isFriend, selectedDate, onDateChange, tasks,
  categories, friendName, currentUserId, onReplyToTask, onReactToTask, holidayConfig,
}) => {
  const [panelWidth, setPanelWidth] = useState(readDayPanelWidth);
  const effectivePanelWidth = clampDayPanelWidth(panelWidth, frameWidth);
  const panelIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const entered = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!panelIdRef.current) panelIdRef.current = `mosaic-day-panel-${++panelHistorySequence}`;
    const id = panelIdRef.current;
    installStalePanelGuard();
    activePanelIds.add(id);
    if (!entered.current) {
      entered.current = true;
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

  return (
    <>
      {isSplit && (
        <DayPanelResizeHandle side={side} width={effectivePanelWidth}
          frameWidth={frameWidth} frameRef={frameRef}
          onResize={setPanelWidth} onCommit={saveDayPanelWidth} />
      )}
      <div key="day-panel-host"
        className={isSplit
          ? 'h-full min-h-0 shrink-0 p-2'
          : `absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} z-20 w-[min(100%,440px)] bg-surface p-2`}
        style={isSplit ? { width: effectivePanelWidth } : undefined}
      >
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
    </>
  );
};
