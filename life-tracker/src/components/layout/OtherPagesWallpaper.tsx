import React from 'react';
import { useSettings } from '../../hooks/useSettings';
import {
  CALENDAR_WALLPAPER_SETTING_KEY,
  CALENDAR_WALLPAPER_DIM_SETTING_KEY,
  CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY,
  resolveCalendarWallpaper,
  resolveCalendarWallpaperDim,
  resolveWallpaperOtherPages,
} from '../../lib/calendarWallpaper';
import { wallpaperSourceForId } from '../../lib/calendarWallpaperPresets';
import './OtherPagesWallpaper.css';

/**
 * Opt-in paint for protected routes other than Home and friend calendars.
 * MainLayout owns the viewport; the backdrop never scrolls with the route or
 * intercepts taps, drag gestures, sheet controls, messages, or navigation.
 */
const OtherPagesWallpaper: React.FC = () => {
  const { getSetting } = useSettings();
  const enabled = resolveWallpaperOtherPages(
    getSetting(CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY, false));
  const id = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  if (!enabled || id === 'none') return null;
  const src = wallpaperSourceForId(id);
  if (!src) return null;
  const dim = resolveCalendarWallpaperDim(getSetting(CALENDAR_WALLPAPER_DIM_SETTING_KEY, undefined));
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  return (
    <div data-other-pages-wallpaper-paint="true" aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundColor: '#080f1b',
        backgroundImage: `linear-gradient(${shade}, ${shade}), url("${src}")`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

export default OtherPagesWallpaper;
