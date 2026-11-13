import React, { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../../../hooks/useSettings';
import {
  CALENDAR_WALLPAPER_SETTING_KEY,
  CALENDAR_WALLPAPER_DIM_SETTING_KEY,
  CALENDAR_WALLPAPER_SCOPE_SETTING_KEY,
  resolveCalendarWallpaper,
  resolveCalendarWallpaperDim,
  resolveCalendarWallpaperScope,
} from '../../../lib/calendarWallpaper';
import { wallpaperSourceForId } from '../../../lib/calendarWallpaperPresets';
import './CalendarWallpaperBackdrop.css';

// One stationary paint, underneath all Calendar slides. Never captures taps,
// drags, text selection, or scrolling; no wallpaper work for the default mode.
export const CalendarWallpaperBackdrop: React.FC = () => {
  const { getSetting } = useSettings();
  // Resolve on this optional chunk; the default Home bundle needs no preset
  // catalog, dimming parser, or owner wallpaper render dependency.
  const id = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  const src = wallpaperSourceForId(id);
  if (!src) return null;
  const dim = resolveCalendarWallpaperDim(getSetting(CALENDAR_WALLPAPER_DIM_SETTING_KEY, undefined));
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  const home = src && resolveCalendarWallpaperScope(getSetting(CALENDAR_WALLPAPER_SCOPE_SETTING_KEY, 'grid')) === 'home'
    && typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>('.mosaic-home-workspace')
    : null;
  useLayoutEffect(() => {
    if (!home) return;
    home.dataset.homeWallpaper = 'true';
    return () => { delete home.dataset.homeWallpaper; };
  }, [home]);
  if (!src) return null;
  const paint = (
    <div
      aria-hidden="true"
      data-calendar-wallpaper-image="true"
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
  return home ? createPortal(paint, home) : paint;
};

export default CalendarWallpaperBackdrop;
