export const CALENDAR_WALLPAPER_SETTING_KEY = 'calendarWallpaper';
export const CALENDAR_WALLPAPER_DIM_SETTING_KEY = 'calendarWallpaperDim';
export const CALENDAR_WALLPAPER_SCOPE_SETTING_KEY = 'calendarWallpaperScope';

export type WallpaperUploadSlot = 0 | 1 | 2 | 3 | 4;
export type UploadedWallpaperId = `upload:${WallpaperUploadSlot}`;
export type CalendarWallpaperId = 'none' | 'aurora' | 'dusk' | 'forest' | 'desert' | UploadedWallpaperId;
export function resolveCalendarWallpaper(value: unknown): CalendarWallpaperId {
  return value === 'aurora' || value === 'dusk' || value === 'forest' || value === 'desert'
    || (typeof value === 'string' && /^upload:[0-4]$/.test(value))
    ? value as CalendarWallpaperId : 'none';
}
export type CalendarWallpaperScope = 'grid' | 'home';
export function resolveCalendarWallpaperScope(value: unknown): CalendarWallpaperScope {
  return value === 'home' ? 'home' : 'grid';
}
export function resolveCalendarWallpaperDim(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 55;
  return Math.min(100, Math.max(0, Math.round(value)));
}
