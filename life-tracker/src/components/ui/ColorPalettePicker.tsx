import React, { useState } from 'react';
import { Check } from 'lucide-react';
import {
  PREDEFINED_COLORS,
  getReadableTextColor,
  type ColorPalette,
} from '../../constants/colors';

interface ColorPalettePickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
  palettes?: readonly ColorPalette[];
  ariaLabel?: string;
}

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({
  selectedColor,
  onSelect,
  palettes = PREDEFINED_COLORS,
  ariaLabel = 'Choose a color',
}) => {
  const availablePalettes = palettes.length > 0 ? palettes : PREDEFINED_COLORS;
  const normalizedSelected = selectedColor.toUpperCase();
  const selectedPalette = availablePalettes.find((palette) =>
    palette.colors.some((color) => color.toUpperCase() === normalizedSelected)
  );
  const [activePaletteId, setActivePaletteId] =
    useState(selectedPalette?.id ?? availablePalettes[0].id);
  const selectedIsInPalette = Boolean(selectedPalette);
  const activePalette =
    availablePalettes.find((palette) => palette.id === activePaletteId) ||
    selectedPalette ||
    availablePalettes[0];

  return (
    <div className="flex flex-col">
      {!selectedIsInPalette && (
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="h-5 w-5 shrink-0 rounded-full border border-[#444444]"
            style={{ backgroundColor: selectedColor }} aria-hidden="true" />
          <span>Current color: {selectedColor}</span>
        </div>
      )}
      <div
        role="tablist"
        aria-label="Color palette"
        className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-[#333333] bg-[#111111] p-1 no-scrollbar"
      >
        {availablePalettes.map((palette) => {
          const isActive = activePalette.id === palette.id;
          return (
            <button
              key={palette.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePaletteId(palette.id)}
              className={`min-w-max flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                isActive ? 'bg-[#2A2A2A] text-white' : 'text-gray-400'
              }`}
            >
              {palette.name}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="grid grid-cols-5 gap-3 p-2 sm:grid-cols-6"
      >
        {activePalette.colors.map((color) => {
          const isSelected =
            normalizedSelected === color.toUpperCase();
          const indicatorColor = getReadableTextColor(color);
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select color ${color}`}
              onClick={() => onSelect(color)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
              style={{ backgroundColor: color }}
            >
              {isSelected && (
                <>
                  <span
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: indicatorColor }}
                    aria-hidden="true"
                  />
                  <Check
                    size={16}
                    strokeWidth={3}
                    style={{ color: indicatorColor }}
                    className="drop-shadow-md"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
