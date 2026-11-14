import React from 'react';
import { useSettings } from '../../hooks/useSettings';
import {
  CALENDAR_WALLPAPER_SETTING_KEY,
  CALENDAR_WALLPAPER_DIM_SETTING_KEY,
  resolveCalendarWallpaper,
  resolveCalendarWallpaperDim,
} from '../../lib/calendarWallpaper';
import {
  CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY,
  CALENDAR_WALLPAPER_PAGES_SETTING_KEY,
  resolveWallpaperPageChoices,
  resolvePageWallpaperId,
  wallpaperPageForPath,
  resolveWallpaperOtherPages,
} from '../../lib/wallpaperPageSettings';
import { useWallpaperSource } from '../../lib/useWallpaperSource';
import './OtherPagesWallpaper.css';

/**
 * Opt-in paint for protected routes other than Home and friend calendars.
 * MainLayout owns the viewport; the backdrop never scrolls with the route or
 * intercepts taps, drag gestures, sheet controls, messages, or navigation.
 */
const OtherPagesWallpaper: React.FC<{ pathname: string }> = ({ pathname }) => {
  const { getSetting } = useSettings();
  const page = wallpaperPageForPath(pathname);
  const homeId = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  const choices = resolveWallpaperPageChoices(
    getSetting(CALENDAR_WALLPAPER_PAGES_SETTING_KEY),
    resolveWallpaperOtherPages(getSetting(CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY, false)),
  );
  const id = page ? resolvePageWallpaperId(choices[page], homeId) : 'none';
  const src = useWallpaperSource(id);
  if (!page || !src) return null;
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
