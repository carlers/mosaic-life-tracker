import type { CSSProperties } from 'react';
import { useSettings } from '../hooks/useSettings';
import { CALENDAR_WALLPAPER_DIM_SETTING_KEY, CALENDAR_WALLPAPER_SETTING_KEY, resolveCalendarWallpaper, resolveCalendarWallpaperDim } from './calendarWallpaper';
import { CALENDAR_WALLPAPER_PAGES_SETTING_KEY, resolvePageWallpaperId, resolveWallpaperPageChoices } from './wallpaperPageSettings';
import { useWallpaperSource } from './useWallpaperSource';

/** Owner-only, opt-in wallpaper for the Day View surface, not friend views or backlogs. */
export function useDayViewWallpaperStyle(enabled = true): CSSProperties | undefined {
  const { getSetting } = useSettings();
  const choice = resolveWallpaperPageChoices(getSetting(CALENDAR_WALLPAPER_PAGES_SETTING_KEY)).dayView;
  const homeId = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  const id = enabled ? resolvePageWallpaperId(choice, homeId) : 'none';
  const src = useWallpaperSource(id);
  if (!src) return undefined;
  const dim = resolveCalendarWallpaperDim(getSetting(CALENDAR_WALLPAPER_DIM_SETTING_KEY, undefined));
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  return {
    backgroundColor: '#080f1b',
    backgroundImage: `linear-gradient(${shade}, ${shade}), url("${src}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  };
}
