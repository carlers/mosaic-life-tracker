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
  isToggle?: boolean;
  checked?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  onClick,
  isDestructive = false,
  showChevron = true,
  rightElement,
  isToggle = false,
  checked = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      role={isToggle ? 'switch' : undefined}
      aria-checked={isToggle ? checked : undefined}
      className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60 ${
        isDestructive ? 'text-red-500' : 'text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDestructive ? 'bg-red-500/10' : 'bg-[#2A2A2A]'
          }`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <span className="text-base font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-400">{value}</span>}
        {rightElement}
        {isToggle && (
          <span
            data-testid="settings-switch-track"
            aria-hidden="true"
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              checked ? 'bg-emerald-500' : 'bg-[#444444]'
            }`}
          >
            <span
              data-testid="settings-switch-thumb"
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                checked ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        )}
        {showChevron && !isToggle && (
          <ChevronRight size={18} className="text-gray-400" aria-hidden="true" />
        )}
      </div>
    </button>
  );
};
