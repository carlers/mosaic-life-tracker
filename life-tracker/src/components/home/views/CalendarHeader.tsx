import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ViewToggle } from './ViewToggle';
import { ViewSwitcher, type ViewType } from '../ViewSwitcher';
import type { CalendarViewMode } from './useCalendarState';

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
}) => {
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
          {activeView === 'calendar' && (
            <ViewToggle activeMode={viewMode} onToggle={onToggleMode} />
          )}
          <button
            type="button"
            onClick={onPrev}
            onPointerDown={(e) => e.stopPropagation()}
            className="mosaic-action-icon p-1.5 rounded-lg bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            onPointerDown={(e) => e.stopPropagation()}
            className="mosaic-action-icon p-1.5 rounded-lg bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Next month"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
