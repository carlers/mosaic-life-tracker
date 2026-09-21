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
const relativeLuminance = (hex: string): number | null => {
  const normalized = hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return null;
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(normalized.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const getContrastRatio = (
  foreground: string,
  background: string
): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return 1;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

export const getReadableTextColor = (
  background: string
): '#000000' | '#FFFFFF' =>
  getContrastRatio('#000000', background) >=
  getContrastRatio('#FFFFFF', background)
    ? '#000000'
    : '#FFFFFF';

export const getCategoryLabelColor = (categoryColor: string): string =>
  categoryColor.toUpperCase() === '#8338EC' ? '#A78BFA' : categoryColor;
