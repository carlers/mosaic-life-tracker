export const CALENDAR_WALLPAPER_SETTING_KEY = 'calendarWallpaper';
export const CALENDAR_WALLPAPER_DIM_SETTING_KEY = 'calendarWallpaperDim';
export const CALENDAR_WALLPAPER_SCOPE_SETTING_KEY = 'calendarWallpaperScope';
export const CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY = 'calendarWallpaperOtherPages';

export function resolveWallpaperOtherPages(value: unknown): boolean {
  return value === true;
}

export type CalendarWallpaperScope = 'grid' | 'home';

export function resolveCalendarWallpaperScope(value: unknown): CalendarWallpaperScope {
  return value === 'home' ? 'home' : 'grid';
}

export type CalendarWallpaperId = 'none' | 'aurora' | 'dusk' | 'forest' | 'desert';

export function resolveCalendarWallpaper(value: unknown): CalendarWallpaperId {
  return value === 'aurora' || value === 'dusk' || value === 'forest' || value === 'desert'
    ? value : 'none';
}

// 0% shows the original art, 100% gives maximum dimming. Existing saved
// percentages retain their exact meaning; malformed values use the default.
export function resolveCalendarWallpaperDim(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 55;
  return Math.min(100, Math.max(0, Math.round(value)));
}
