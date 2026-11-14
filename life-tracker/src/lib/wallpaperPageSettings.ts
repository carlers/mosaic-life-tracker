import {
  resolveCalendarWallpaper,
  type CalendarWallpaperId,
  type WallpaperUploadSlot,
} from './calendarWallpaper';

export const CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY = 'calendarWallpaperOtherPages';
export const CALENDAR_WALLPAPER_PAGES_SETTING_KEY = 'calendarWallpaperPages';
export const CALENDAR_WALLPAPER_UPLOADS_SETTING_KEY = 'calendarWallpaperUploads';

export const WALLPAPER_PAGE_KEYS = [
  'explore', 'alerts', 'chat', 'me', 'settings', 'settingsSubpages', 'other',
] as const;
export type WallpaperPageKey = typeof WALLPAPER_PAGE_KEYS[number];
export type PageWallpaperChoice = 'off' | 'home' | Exclude<CalendarWallpaperId, 'none'>;
export type PageWallpaperChoices = Record<WallpaperPageKey, PageWallpaperChoice>;

export function resolveWallpaperOtherPages(value: unknown): boolean { return value === true; }
export { wallpaperUploadSlot } from './wallpaperFileIds';
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
