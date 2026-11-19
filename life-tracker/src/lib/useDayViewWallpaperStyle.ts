import type { CSSProperties } from 'react';
import { useSettings } from '../hooks/useSettings';
import { CALENDAR_WALLPAPER_DIM_SETTING_KEY, CALENDAR_WALLPAPER_SETTING_KEY, resolveCalendarWallpaper, resolveCalendarWallpaperDim } from './calendarWallpaper';
import { CALENDAR_GLASS_TRANSPARENCY_SETTING_KEY, CALENDAR_WALLPAPER_MATERIAL_SETTING_KEY, CALENDAR_WALLPAPER_PAGES_SETTING_KEY, resolveGlassTransparency, resolvePageWallpaperId, resolveWallpaperMaterial, resolveWallpaperPageChoices } from './wallpaperPageSettings';
import { useWallpaperSource } from './useWallpaperSource';
import '../components/layout/WallpaperMaterial.css';

/** Owner-only, opt-in wallpaper for the Day View surface, not friend views or backlogs. */
export function useDayViewWallpaperAppearance(enabled = true): { style: CSSProperties | undefined; glass: boolean } {
  const { getSetting } = useSettings();
  const choice = resolveWallpaperPageChoices(getSetting(CALENDAR_WALLPAPER_PAGES_SETTING_KEY)).dayView;
  const homeId = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  const id = enabled ? resolvePageWallpaperId(choice, homeId) : 'none';
  const src = useWallpaperSource(id);
  if (!src) return { style: undefined, glass: false };
  const dim = resolveCalendarWallpaperDim(getSetting(CALENDAR_WALLPAPER_DIM_SETTING_KEY, undefined));
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  const glass = resolveWallpaperMaterial(getSetting(CALENDAR_WALLPAPER_MATERIAL_SETTING_KEY)) === 'soft';
  const transparency = glass ? resolveGlassTransparency(getSetting(CALENDAR_GLASS_TRANSPARENCY_SETTING_KEY)) : 0;
  return { style: {
    ...(glass ? {
      '--mosaic-glass-fade': (transparency * .004).toFixed(2),
      '--mosaic-glass-safe-fade': (transparency * .002).toFixed(2),
      '--mosaic-glass-bubble-fade': (transparency * .003).toFixed(2),
    } : {}),
    backgroundColor: '#080f1b',
    backgroundImage: `linear-gradient(${shade}, ${shade}), url("${src}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  }, glass };
}

/** Keep the surface-only hook available to wallpaper consumers. */
export function useDayViewWallpaperStyle(enabled = true): CSSProperties | undefined {
  return useDayViewWallpaperAppearance(enabled).style;
}
