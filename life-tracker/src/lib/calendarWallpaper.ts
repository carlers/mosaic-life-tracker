export const CALENDAR_WALLPAPER_SETTING_KEY = 'calendarWallpaper';
export const CALENDAR_WALLPAPER_DIM_SETTING_KEY = 'calendarWallpaperDim';
export const CALENDAR_WALLPAPER_SCOPE_SETTING_KEY = 'calendarWallpaperScope';
export const CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY = 'calendarWallpaperOtherPages';
export const CALENDAR_WALLPAPER_PAGES_SETTING_KEY = 'calendarWallpaperPages';
export const CALENDAR_WALLPAPER_UPLOADS_SETTING_KEY = 'calendarWallpaperUploads';

export const WALLPAPER_PAGE_KEYS = [
  'explore', 'alerts', 'chat', 'me', 'settings', 'settingsSubpages', 'other',
] as const;
export type WallpaperPageKey = typeof WALLPAPER_PAGE_KEYS[number];
export type WallpaperUploadSlot = 0 | 1 | 2 | 3 | 4;
export type UploadedWallpaperId = `upload:${WallpaperUploadSlot}`;
export type CalendarWallpaperId = 'none' | 'aurora' | 'dusk' | 'forest' | 'desert' | UploadedWallpaperId;
export type PageWallpaperChoice = 'off' | 'home' | Exclude<CalendarWallpaperId, 'none'>;
export type PageWallpaperChoices = Record<WallpaperPageKey, PageWallpaperChoice>;

export function wallpaperUploadSlot(id: unknown): WallpaperUploadSlot | null {
  return typeof id === 'string' && /^upload:[0-4]$/.test(id)
    ? Number(id.slice(-1)) as WallpaperUploadSlot : null;
}
export function resolveCalendarWallpaper(value: unknown): CalendarWallpaperId {
  return value === 'aurora' || value === 'dusk' || value === 'forest' || value === 'desert'
    || wallpaperUploadSlot(value) !== null ? value as CalendarWallpaperId : 'none';
}
export function resolveWallpaperOtherPages(value: unknown): boolean { return value === true; }
export type CalendarWallpaperScope = 'grid' | 'home';
export function resolveCalendarWallpaperScope(value: unknown): CalendarWallpaperScope {
  return value === 'home' ? 'home' : 'grid';
}
export function resolveCalendarWallpaperDim(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 55;
  return Math.min(100, Math.max(0, Math.round(value)));
}
export function resolveWallpaperUploadSlots(raw: unknown): WallpaperUploadSlot[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((slot): slot is WallpaperUploadSlot =>
    Number.isInteger(slot) && slot >= 0 && slot < 5))].sort((a, b) => a - b);
}
export function wallpaperPageForPath(pathname: string): WallpaperPageKey | null {
  if (pathname === '/home' || pathname.startsWith('/friends/')) return null;
  if (pathname === '/explore') return 'explore';
  if (pathname === '/notifications') return 'alerts';
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return 'chat';
  if (pathname === '/account' || pathname === '/profile') return 'me';
  if (pathname === '/settings') return 'settings';
  if (pathname.startsWith('/settings/')) return 'settingsSubpages';
  return 'other';
}
export function resolveWallpaperPageChoices(raw: unknown, legacyEnabled: unknown = false): PageWallpaperChoices {
  const result = {} as PageWallpaperChoices;
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  for (const key of WALLPAPER_PAGE_KEYS) {
    const value = Object.prototype.hasOwnProperty.call(record, key)
      ? record[key] : (legacyEnabled === true ? 'home' : 'off');
    const selection = resolveCalendarWallpaper(value);
    result[key] = value === 'off' || value === 'none' ? 'off'
      : value === 'home' ? 'home'
      : selection !== 'none' ? selection : 'off';
  }
  return result;
}
export function resolvePageWallpaperId(choice: PageWallpaperChoice, homeId: CalendarWallpaperId): CalendarWallpaperId {
  return choice === 'off' ? 'none' : choice === 'home' ? homeId : resolveCalendarWallpaper(choice);
}
