/**
 * Curated Color Palettes for Categories and app accents.
 *
 * ARCHITECTURAL RULE: No free-form hex inputs.
 * Category and accent colors must come from the predefined palettes below.
 */

export interface ColorPalette {
  id: string;
  name: string;
  colors: readonly string[];
}

export const DEFAULT_ACCENT_COLOR = '#10B981';

export const PREDEFINED_COLORS: readonly ColorPalette[] = [
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
  {
    id: 'cool',
    name: 'Cool',
    colors: [
      '#3B82F6', // Blue
      '#60A5FA', // Cornflower
      '#38BDF8', // Sky
      '#22D3EE', // Cyan
      '#2DD4BF', // Teal
      '#818CF8', // Indigo
      '#A78BFA', // Violet
      '#C084FC', // Purple
      '#F472B6', // Pink
      '#FB7185', // Rose
    ],
  },
  {
    id: 'earth',
    name: 'Earth',
    colors: [
      '#F87171', // Warm Red
      '#FB923C', // Tangerine
      '#FBBF24', // Amber
      '#FACC15', // Sunflower
      '#A3E635', // Lime
      '#84CC16', // Leaf
      '#4ADE80', // Green
      '#34D399', // Emerald
      '#A1887F', // Cocoa
      '#BCAAA4', // Taupe
    ],
  },
];

export const ACCENT_COLOR_PALETTES: readonly ColorPalette[] = [
  {
    id: 'core',
    name: 'Core',
    colors: [
      '#10B981', // Mosaic Emerald
      '#3B82F6', // Blue
      '#8B5CF6', // Violet
      '#EC4899', // Pink
      '#EF4444', // Red
      '#F97316', // Orange
      '#14B8A6', // Teal
      '#06B6D4', // Cyan
      '#6366F1', // Indigo
      '#D946EF', // Fuchsia
    ],
  },
  {
    id: 'bright',
    name: 'Bright',
    colors: [
      '#34D399', // Bright Emerald
      '#60A5FA', // Bright Blue
      '#818CF8', // Bright Indigo
      '#C084FC', // Bright Purple
      '#F472B6', // Bright Pink
      '#FB7185', // Bright Rose
      '#FB923C', // Bright Orange
      '#FBBF24', // Amber
      '#84CC16', // Lime
      '#22D3EE', // Bright Cyan
    ],
  },
];

const normalizeHex = (hex: string): string => hex.trim().toUpperCase();

/**
 * Helper to get all category colors as a flat array.
 */
export const getAllAvailableColors = (): string[] =>
  PREDEFINED_COLORS.flatMap((palette) => [...palette.colors]);

export const getAllAccentColors = (): string[] =>
  ACCENT_COLOR_PALETTES.flatMap((palette) => [...palette.colors]);

/**
 * Validate if a color hex is in the predefined category list.
 */
export const isValidPredefinedColor = (hex: string): boolean =>
  getAllAvailableColors().includes(normalizeHex(hex));

export const isValidAccentColor = (value: unknown): value is string =>
  typeof value === 'string' &&
  getAllAccentColors().includes(normalizeHex(value));

export const normalizeAccentColor = (value: unknown): string =>
  isValidAccentColor(value) ? normalizeHex(value) : DEFAULT_ACCENT_COLOR;

const relativeLuminance = (hex: string): number | null => {
  const normalized = normalizeHex(hex);
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
