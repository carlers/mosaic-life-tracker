/**
 * Predefined Color Palettes for Categories
 * 
 * ARCHITECTURAL RULE: No free-form hex inputs.
 * All category colors must come from these predefined palettes.
 * 
 * Phase 2 Ready: Easy to add new palettes (e.g., "Seasonal", "Custom")
 */

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

export const PREDEFINED_COLORS: ColorPalette[] = [
  {
    id: 'default',
    name: 'Default',
    colors: [
      '#FF6B6B', // Coral Red
      '#4ECDC4', // Turquoise
      '#45B7D1', // Sky Blue
      '#96CEB4', // Sage Green
      '#FFEAA7', // Soft Yellow
      '#DDA0DD', // Plum
      '#98D8C8', // Mint
      '#F7DC6F', // Golden
      '#BB8FCE', // Lavender
      '#85C1E9', // Light Blue
    ],
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    colors: [
      '#FF006E', // Hot Pink
      '#FB5607', // Orange
      '#FFBE0B', // Amber
      '#8338EC', // Purple
      '#3A86FF', // Bright Blue
      '#06FFB4', // Neon Green
      '#FF4081', // Rose
      '#00E5FF', // Cyan
      '#76FF03', // Lime
      '#FF9100', // Deep Orange
    ],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    colors: [
      '#FFB3BA', // Pastel Pink
      '#BAFFC9', // Pastel Green
      '#BAE1FF', // Pastel Blue
      '#FFFFBA', // Pastel Yellow
      '#FFDFBA', // Pastel Orange
      '#E0BBE4', // Pastel Purple
      '#957DAD', // Muted Purple
      '#D291BC', // Soft Magenta
      '#FEC8D8', // Blush
      '#AEC6CF', // Powder Blue
    ],
  },
];

/**
 * Helper to get all colors as a flat array
 * Useful for validation
 */
export const getAllAvailableColors = (): string[] => {
  return PREDEFINED_COLORS.flatMap(palette => palette.colors);
};

/**
 * Validate if a color hex is in the predefined list
 * Prevents users from injecting arbitrary colors
 */
export const isValidPredefinedColor = (hex: string): boolean => {
  return getAllAvailableColors().includes(hex);
};