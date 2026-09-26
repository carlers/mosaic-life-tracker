import React from 'react';
import { Check } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  APPEARANCE_MODES,
  type AppearanceMode,
} from '../../lib/appearance';

const OPTIONS: Record<AppearanceMode, { label: string; description: string }> = {
  system: { label: 'System', description: 'Follow your device appearance.' },
  dark: { label: 'Dark', description: 'Use Mosaic’s charcoal dark palette.' },
  light: { label: 'Light', description: 'Use light surfaces with dark text.' },
  black: {
    label: 'Black',
    description: 'Use true-black primary surfaces for OLED displays.',
  },
};

interface AppearanceSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: AppearanceMode;
  onChange: (mode: AppearanceMode) => void | Promise<void>;
}

export const AppearanceSettingsSheet: React.FC<
  AppearanceSettingsSheetProps
> = ({ isOpen, onClose, mode, onChange }) => (
  <BottomSheet
    isOpen={isOpen}
    onClose={onClose}
    title="Appearance"
    ariaLabel="Appearance"
    height="auto"
  >
    <div role="radiogroup" aria-label="Appearance mode" className="px-1 pb-8">
      {APPEARANCE_MODES.map((option) => {
        const selected = option === mode;
        const copy = OPTIONS[option];
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => void onChange(option)}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#2A2A2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">
                {copy.label}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-400">
                {copy.description}
              </span>
            </span>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? 'border-emerald-500 bg-emerald-500 text-black'
                  : 'border-[#444444] text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check size={14} strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  </BottomSheet>
);
