import type { CalendarWallpaperId } from './calendarWallpaper';

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

export function wallpaperSourceForId(value: CalendarWallpaperId): string | null {
  return CALENDAR_WALLPAPER_PRESETS.find(preset => preset.id === value)?.src ?? null;
}
