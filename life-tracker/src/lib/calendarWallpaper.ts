export const CALENDAR_WALLPAPER_SETTING_KEY = 'calendarWallpaper';
export const CALENDAR_WALLPAPER_DIM_SETTING_KEY = 'calendarWallpaperDim';

export type CalendarWallpaperId = 'none' | 'aurora' | 'dusk' | 'forest' | 'desert';

export const CALENDAR_WALLPAPER_PRESETS: readonly {
  id: Exclude<CalendarWallpaperId, 'none'>;
  label: string;
  src: string;
}[] = [
  { id: 'aurora', label: 'Aurora', src: '/wallpapers/aurora.svg' },
  { id: 'dusk', label: 'Twilight', src: '/wallpapers/dusk.svg' },
  { id: 'forest', label: 'Evergreen', src: '/wallpapers/forest.svg' },
  { id: 'desert', label: 'Desert', src: '/wallpapers/desert.svg' },
];

export function resolveCalendarWallpaper(value: unknown): CalendarWallpaperId {
  return value === 'aurora' || value === 'dusk' || value === 'forest' || value === 'desert'
    ? value : 'none';
}

// A minimum overlay maintains readable date and weekday labels over every
// stock preset. Invalid settings retain the accessible default.
export function resolveCalendarWallpaperDim(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 55;
  return Math.min(80, Math.max(35, Math.round(value / 5) * 5));
}

export function wallpaperSourceForId(value: CalendarWallpaperId): string | null {
  return CALENDAR_WALLPAPER_PRESETS.find(preset => preset.id === value)?.src ?? null;
}
