import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import {
  CALENDAR_WALLPAPER_SETTING_KEY,
  CALENDAR_WALLPAPER_DIM_SETTING_KEY,
  CALENDAR_WALLPAPER_SCOPE_SETTING_KEY,
  resolveCalendarWallpaper,
  resolveCalendarWallpaperScope,
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
import '../home/views/CalendarWallpaperBackdrop.css';
import './WallpaperMaterial.css';
import { CALENDAR_WALLPAPER_MATERIAL_SETTING_KEY, resolveWallpaperMaterial,
  CALENDAR_GLASS_TRANSPARENCY_SETTING_KEY, resolveGlassTransparency } from '../../lib/wallpaperPageSettings';

/**
 * One persistent, account-scoped wallpaper paint for Home (full coverage)
 * and opt-in secondary pages. Its Home image stays leased by useTaskImage
 * while visiting other routes, preventing black frames from object-URL
 * eviction, remounts, or the old asynchronous Home portal handoff.
 * Grid-only Calendar and friend pages retain their separate paint/opt-outs.
 */
const OtherPagesWallpaper: React.FC = () => {
  const { pathname } = useLocation();
  const { getSetting } = useSettings();
  const page = wallpaperPageForPath(pathname);
  const homeId = resolveCalendarWallpaper(getSetting(CALENDAR_WALLPAPER_SETTING_KEY, 'none'));
  const choices = resolveWallpaperPageChoices(
    getSetting(CALENDAR_WALLPAPER_PAGES_SETTING_KEY),
    resolveWallpaperOtherPages(getSetting(CALENDAR_WALLPAPER_OTHER_PAGES_SETTING_KEY, false)),
  );
  const homeCoverage = resolveCalendarWallpaperScope(
    getSetting(CALENDAR_WALLPAPER_SCOPE_SETTING_KEY, 'grid')
  ) === 'home';
  const fullHome = pathname === '/home' && homeCoverage;
  const pageId = page ? resolvePageWallpaperId(choices[page], homeId) : 'none';
  // Keep the Home image URL leased for both full-Home and grid-only modes.
  // The Calendar grid remounts after route navigation; releasing this lease
  // used to revoke uploaded photos after 1.5s and show a black fallback
  // while the async IndexedDB image was acquired again.
  const homeSrc = useWallpaperSource(homeId);
  const distinctPageSrc = useWallpaperSource(pageId === homeId ? 'none' : pageId);
  // The optional Calendar backdrop is a separate lazy chunk. Warm its
  // implementation and browser decode while away from Home; returning to
  // the grid then reuses both the prepared chunk and leased photo URL.
  const shouldWarmGrid = !homeCoverage && pathname !== '/home' && Boolean(homeSrc);
  React.useEffect(() => {
    if (!shouldWarmGrid) return;
    const timer = window.setTimeout(() => {
      void import('../home/views/CalendarWallpaperBackdrop').catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [shouldWarmGrid]);
  React.useEffect(() => {
    if (!homeSrc || homeCoverage) return;
    const image = new Image();
    image.src = homeSrc;
    void image.decode?.().catch(() => {});
    return () => { image.src = ''; };
  }, [homeSrc, homeCoverage]);

  const src = fullHome ? homeSrc :
    page ? (pageId === homeId ? homeSrc : distinctPageSrc) : null;
  if (!src) return null;
  const dim = resolveCalendarWallpaperDim(getSetting(CALENDAR_WALLPAPER_DIM_SETTING_KEY, undefined));
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  return (
    <div data-home-wallpaper-paint={fullHome ? 'true' : undefined} data-other-pages-wallpaper-paint={!fullHome ? 'true' : undefined} data-wallpaper-material={resolveWallpaperMaterial(getSetting(CALENDAR_WALLPAPER_MATERIAL_SETTING_KEY))} data-glass-transparency={resolveGlassTransparency(getSetting(CALENDAR_GLASS_TRANSPARENCY_SETTING_KEY))} aria-hidden="true"
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
