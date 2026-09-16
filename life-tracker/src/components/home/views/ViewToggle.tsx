import React from 'react';

interface ViewToggleProps {
  activeMode: 'month' | 'week';
  onToggle: () => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ activeMode, onToggle }) => {
  const label =
    activeMode === 'month'
      ? 'Switch to week view'
      : 'Switch to month view';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className="relative flex items-center justify-center w-8 h-7 bg-[#1E1E1E] border border-[#333333] rounded-lg text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:bg-[#2A2A2A] transition-colors"
    >
      <span className="text-white" aria-hidden="true">
        {activeMode === 'month' ? 'M' : 'W'}
      </span>
    </button>
  );
};
