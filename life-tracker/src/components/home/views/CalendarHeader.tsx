import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
const LazyCalendarCategoryFilterTrigger = React.lazy(() => import('./CalendarCategoryFilterTrigger'));
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
  onTitleClick: () => void;
  enableTitleSwipe?: boolean;
  includeCategory?: boolean;
  calendarFilter?: React.ComponentProps<typeof LazyCalendarCategoryFilterTrigger>;
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
  includeCategory = true,
  calendarFilter,
}) => {
  const weekViewEnabled = useFeatureEnabled('mosaic_disable_calendar_week_view');
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
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!enableTitleSwipe || !start || !touch) return;
    const dx = touch.clientX - start.x;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(touch.clientY - start.y) * 1.3) return;
    suppressClick.current = true;
    (dx < 0 ? onNext : onPrev)();
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-[#333333]">
      <ViewSwitcher activeView={activeView} onViewChange={onViewChange} includeCategory={includeCategory} />
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
        <button type="button" onClick={onTitleClick}
          onPointerDown={event => event.stopPropagation()}
          className="max-w-full truncate rounded px-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Go to today">
          {title}
        </button>
      </h2>
      {activeView !== 'category' && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {activeView === 'calendar' && weekViewEnabled && (
            <ViewToggle activeMode={viewMode} onToggle={onToggleMode} />
          )}
          {calendarFilter && (
            <React.Suspense fallback={<span className="block h-7 w-8 shrink-0" aria-hidden="true" />}>
              <LazyCalendarCategoryFilterTrigger {...calendarFilter} />
            </React.Suspense>
          )}
          <CalendarNavButton Icon={ChevronLeft} action={onPrev} label="Previous month" />
          <CalendarNavButton Icon={ChevronRight} action={onNext} label="Next month" />
        </div>
      )}
    </div>
  );
};
