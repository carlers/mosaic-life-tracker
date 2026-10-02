import React from 'react';
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
}) => {
  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-[#333333]">
      <ViewSwitcher activeView={activeView} onViewChange={onViewChange} />
      <h2
        className="min-w-0 flex-1 text-base font-bold text-white transition-all duration-200"
        aria-live="polite"
      >
        {(activeView === 'calendar' || activeView === 'todo') && onTitleClick ? (
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
            {activeView === 'diary' ? 'Diary' : title}
          </span>
        )}
      </h2>
      {activeView !== 'diary' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeView === 'calendar' && (
            <ViewToggle activeMode={viewMode} onToggle={onToggleMode} />
          )}
          <button
            type="button"
            onClick={onPrev}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Next month"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
