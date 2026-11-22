import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';

const LazyCalendarCategoryFilterPopup = React.lazy(() =>
  import('./CalendarCategoryFilterPopup').then(module => ({ default: module.CalendarCategoryFilterPopup }))
);
import { ViewToggle } from './ViewToggle';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import { ViewSwitcher, type ViewType } from '../ViewSwitcher';
import type { CalendarViewMode } from './useCalendarState';

// Keep month controls identical: a single shared control owns keyboard focus,
// swipe suppression and theme styling for both directions.
const CalendarNavButton: React.FC<{
  Icon: typeof ChevronLeft;
  action: () => void;
  label: string;
}> = ({ Icon, action, label }) => (
  <button
    type="button"
    onClick={action}
    onPointerDown={event => event.stopPropagation()}
    className="mosaic-action-icon p-1.5 rounded-lg bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
    aria-label={label}
  >
    <Icon size={16} aria-hidden="true" />
  </button>
);

interface CalendarHeaderProps {
  title: string;
  viewMode: CalendarViewMode;
  onToggleMode: () => void;
  onPrev: () => void;
  onNext: () => void;
  activeView: ViewType;
  onViewChange: (v: ViewType) => void;
  onTitleClick?: () => void;
  enableTitleSwipe?: boolean;
  categoryFilterCategories?: CategoryDocument[];
  categoryFilterIds?: readonly string[];
  onCategoryFilterToggle?: (id: string) => void;
  onCategoryFilterClear?: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  title,
  viewMode,
  onToggleMode,
  onPrev,
  onNext,
  activeView,
  onViewChange,
  onTitleClick,
  enableTitleSwipe = false,
  categoryFilterCategories,
  categoryFilterIds = [],
  onCategoryFilterToggle,
  onCategoryFilterClear,
}) => {
  const weekViewEnabled = useFeatureEnabled('mosaic_disable_calendar_week_view');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (activeView !== 'calendar') setFilterOpen(false); }, [activeView]);
  const closeFilter = React.useCallback(() => setFilterOpen(false), []);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const handleTitleTouchStart = (event: React.TouchEvent) => {
    if (!enableTitleSwipe) return;
    // A completed pan may not emit a click; do not suppress the next tap.
    suppressClick.current = false;
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTitleTouchEnd = (event: React.TouchEvent) => {
    if (!enableTitleSwipe || !touchStart.current) return;
    const touch = event.changedTouches[0];
    const start = touchStart.current;
    touchStart.current = null;
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
    suppressClick.current = true;
    if (dx < 0) onNext();
    else onPrev();
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-[#333333]">
      <ViewSwitcher activeView={activeView} onViewChange={onViewChange} />
      <h2
        className="mosaic-date-header min-w-0 flex-1 text-base font-bold text-white transition-all duration-200"
        aria-live="polite"
        onTouchStart={handleTitleTouchStart}
        onTouchEnd={handleTitleTouchEnd}
        onTouchCancel={() => { touchStart.current = null; }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            onPointerDown={(event) => event.stopPropagation()}
            className="max-w-full truncate rounded px-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Go to today"
          >
            {title}
          </button>
        ) : (
          <span className="block truncate">
            {title}
          </span>
        )}
      </h2>
      {(
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeView === 'calendar' && weekViewEnabled && (
            <ViewToggle activeMode={viewMode} onToggle={onToggleMode} />
          )}
          {activeView === 'calendar' && categoryFilterCategories && onCategoryFilterToggle && onCategoryFilterClear && (
            <div className="relative shrink-0" data-route-swipe-ignore="true">
              <button type="button" ref={filterButtonRef}
                onPointerDown={event => event.stopPropagation()}
                onClick={() => setFilterOpen(open => !open)}
                aria-label={categoryFilterIds.length > 0
                  ? 'Filter calendar categories, ' + categoryFilterIds.length + ' selected'
                  : 'Filter calendar categories'}
                aria-haspopup="dialog" aria-expanded={filterOpen}
                className="mosaic-action-icon relative flex h-7 w-8 items-center justify-center rounded-lg border border-border bg-surface text-textSecondary hover:text-textPrimary focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                <ListFilter size={16} aria-hidden="true" />
                {categoryFilterIds.length > 0 && (
                  <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] font-semibold text-black">
                    {categoryFilterIds.length > 9 ? '9+' : categoryFilterIds.length}
                  </span>
                )}
              </button>
              {filterOpen && (
                <React.Suspense fallback={<div role="status" className="absolute right-0 top-full z-[70] rounded-lg bg-surface p-3 text-xs text-textSecondary">Loading filters…</div>}>
                  <LazyCalendarCategoryFilterPopup
                    categories={categoryFilterCategories}
                    selectedIds={categoryFilterIds}
                    onToggle={onCategoryFilterToggle}
                    onClear={onCategoryFilterClear}
                    onClose={closeFilter}
                    triggerRef={filterButtonRef}
                  />
                </React.Suspense>
              )}
            </div>
          )}
          <CalendarNavButton Icon={ChevronLeft} action={onPrev} label="Previous month" />
          <CalendarNavButton Icon={ChevronRight} action={onNext} label="Next month" />
        </div>
      )}
    </div>
  );
};
