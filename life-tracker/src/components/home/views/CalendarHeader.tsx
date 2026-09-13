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
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  title,
  viewMode,
  onToggleMode,
  onPrev,
  onNext,
  activeView,
  onViewChange,
}) => {
  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-[#333333]">
      <ViewSwitcher activeView={activeView} onViewChange={onViewChange} />
      <h2 className="text-base font-bold text-white flex-1 truncate transition-all duration-200">
        {title}
      </h2>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ViewToggle activeMode={viewMode} onToggle={onToggleMode} />
        <button
          type="button"
          onClick={onPrev}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onNext}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          aria-label="Next"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};