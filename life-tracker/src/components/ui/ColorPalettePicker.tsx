import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PREDEFINED_COLORS } from '../../constants/colors';

interface ColorPalettePickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({ selectedColor, onSelect }) => {
  // Default to the first palette ('default')
  const [activePaletteId, setActivePaletteId] = useState<string>(PREDEFINED_COLORS[0].id);

  const activePalette = PREDEFINED_COLORS.find(p => p.id === activePaletteId) || PREDEFINED_COLORS[0];

  return (
    <div className="flex flex-col">
      {/* Tabs */}
      <div className="flex bg-[#111111] rounded-lg p-1 mb-4 border border-[#333333]">
        {PREDEFINED_COLORS.map((palette) => {
          const isActive = activePaletteId === palette.id;
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => setActivePaletteId(palette.id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'
              }`}
            >
              {palette.name}
            </button>
          );
        })}
      </div>

      {/* Color Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 p-2">
        {activePalette.colors.map((color) => {
          const isSelected = selectedColor === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform focus:outline-none hover:scale-110"
              style={{ backgroundColor: color }} // STRICT RULE: Inline style for dynamic color
              aria-label={`Select color ${color}`}
            >
              {isSelected && (
                <>
                  {/* Outer white ring for selection */}
                  <div className="absolute inset-0 rounded-full border-2 border-white" />
                  {/* Checkmark */}
                  <Check size={16} className="text-white drop-shadow-md" strokeWidth={3} />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};