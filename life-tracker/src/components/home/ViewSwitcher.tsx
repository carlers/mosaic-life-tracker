import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ListChecks, BookOpen } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const views: { id: ViewType; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'todo', label: 'Todo', icon: ListChecks },
  { id: 'diary', label: 'Diary', icon: BookOpen },
];

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ activeView, onViewChange }) => {
  return (
    <div className="flex bg-[#1E1E1E] rounded-lg p-1 border border-[#333333]">
      {views.map((view) => {
        const isActive = activeView === view.id;
        const Icon = view.icon;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium focus:outline-none"
          >
            {/* Sliding Active Background */}
            {isActive && (
              <motion.div
                layoutId="viewSwitcherActive"
                className="absolute inset-0 bg-[#333333] rounded-md"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-gray-500'}`}>
              <Icon size={14} />
            </span>
            <span className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-gray-500'}`}>
              {view.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};