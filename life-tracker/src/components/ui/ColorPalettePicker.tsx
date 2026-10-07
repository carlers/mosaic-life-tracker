import React, { useMemo, useState } from 'react';
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
  const selectedPaletteId = useMemo(() => {
    const normalizedSelected = selectedColor.toUpperCase();
    return (
      availablePalettes.find((palette) =>
        palette.colors.some(
          (color) => color.toUpperCase() === normalizedSelected
        )
      )?.id ?? availablePalettes[0].id
    );
  }, [availablePalettes, selectedColor]);
  const [activePaletteId, setActivePaletteId] =
    useState<string>(selectedPaletteId);

  const activePalette =
    availablePalettes.find((palette) => palette.id === activePaletteId) ||
    availablePalettes.find((palette) => palette.id === selectedPaletteId) ||
    availablePalettes[0];

  return (
    <div className="flex flex-col">
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
            selectedColor.toUpperCase() === color.toUpperCase();
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
