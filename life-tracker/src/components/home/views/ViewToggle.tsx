import React from 'react';

interface ViewToggleProps {
  activeMode: 'month' | 'week';
  onToggle: () => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ activeMode, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="relative flex items-center justify-center w-8 h-7 bg-[#1E1E1E] border border-[#333333] rounded-lg text-xs font-bold focus:outline-none hover:bg-[#2A2A2A] transition-colors"
    >
      <span className="text-white">{activeMode === 'month' ? 'M' : 'W'}</span>
    </button>
  );
};