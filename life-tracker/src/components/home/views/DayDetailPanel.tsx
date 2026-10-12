import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { isSheetVisible } from '../../../lib/sheetVisibility';

const PANEL_HISTORY_KEY = '__mosaicDayDetailPanel';
const issuedPanelIds = new Set<string>();
const activePanelIds = new Set<string>();
let guardInstalled = false;

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
  onClose: () => void;
  children: React.ReactNode;
  onFocusCalendar?: () => void;
}

export const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  onClose, children, onFocusCalendar,
}) => {
  const id = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const entered = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
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
  }, [id]);

  useEffect(() => {
    return () => { activePanelIds.delete(id); };
  }, [id]);

  return (
    <aside
      aria-label="Day details"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--mosaic-border)] bg-surface"
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
        {children}
      </div>
    </aside>
  );
};
