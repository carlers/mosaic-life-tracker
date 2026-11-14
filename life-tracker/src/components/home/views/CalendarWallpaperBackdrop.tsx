import React from 'react';
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
import { useWallpaperSource } from '../../../lib/useWallpaperSource';
import { CALENDAR_WALLPAPER_MATERIAL_SETTING_KEY, resolveWallpaperMaterial } from '../../../lib/wallpaperPageSettings';
import '../../layout/WallpaperMaterial.css';
import './CalendarWallpaperBackdrop.css';

// One stationary paint, underneath all Calendar slides. Never captures taps,
// drags, text selection, or scrolling; no wallpaper work for the default mode.
export const CalendarWallpaperBackdrop: React.FC = () => {
  const { getSetting } = useSettings();
  // Resolve on this optional chunk; the default Home bundle needs no preset
  // catalog, dimming parser, or owner wallpaper render dependency.
  const id = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  const src = useWallpaperSource(id);
  const dim = resolveCalendarWallpaperDim(getSetting(CALENDAR_WALLPAPER_DIM_SETTING_KEY, undefined));
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  // Home can mount in the same React commit as this cached lazy module.
  // Resolve the portal host after commit, not by querying an unmounted ancestor
  // during render. No outside DOM mutation; a queued microtask satisfies the
  // Hooks guard against immediate state updates inside effects.
  const homeMode = Boolean(src && resolveCalendarWallpaperScope(
    getSetting(CALENDAR_WALLPAPER_SCOPE_SETTING_KEY, 'grid')) === 'home');
  const [homeHost, setHomeHost] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!homeMode || typeof document === 'undefined') return;
    let active = true;
    queueMicrotask(() => {
      if (active) setHomeHost(document.querySelector<HTMLElement>('.mosaic-home-workspace'));
    });
    return () => { active = false; };
  }, [homeMode]);
  const home = homeMode && homeHost?.isConnected ? homeHost : null;
  if (!src || (homeMode && !home)) return null;
  const paint = (
    <div
      aria-hidden="true"
      data-calendar-wallpaper-image="true"
      data-wallpaper-material={resolveWallpaperMaterial(getSetting(CALENDAR_WALLPAPER_MATERIAL_SETTING_KEY))}
      data-home-wallpaper-paint={home ? 'true' : undefined}
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
