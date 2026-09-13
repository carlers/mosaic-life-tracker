import React from 'react';
import { Calendar, BookOpen } from 'lucide-react';

export type ViewType = 'calendar' | 'diary';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const views: {
  id: ViewType;
  label: string;
  icon: React.FC<{ size?: number }>;
}[] = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'diary', label: 'Diary', icon: BookOpen },
];

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  activeView,
  onViewChange,
}) => {
  return (
    <div className="relative flex bg-[#1E1E1E] rounded-lg p-0.5 border border-[#333333] flex-shrink-0">
      {views.map((view) => {
        const isActive = activeView === view.id;
        const Icon = view.icon;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onViewChange(view.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative flex items-center justify-center w-7 h-7 rounded-md focus:outline-none group"
            aria-label={view.label}
          >
            {isActive && (
              <div className="absolute inset-0 bg-white rounded-md" />
            )}
            <span
              className={`relative z-10 transition-colors ${
                isActive ? 'text-black' : 'text-gray-500 group-hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
            </span>
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2A2A2A] border border-[#444444] rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity hidden md:block z-50">
              {view.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};