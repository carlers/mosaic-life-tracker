import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  onClick,
  isDestructive = false,
  showChevron = true,
  rightElement,
}) => {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#2A2A2A] transition-colors ${
        isDestructive ? 'text-red-500' : 'text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDestructive ? 'bg-red-500/10' : 'bg-[#2A2A2A]'}`}>
          {icon}
        </div>
        <span className="text-base font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-500">{value}</span>}
        {rightElement}
        {showChevron && <ChevronRight size={18} className="text-gray-500" />}
      </div>
    </button>
  );
};