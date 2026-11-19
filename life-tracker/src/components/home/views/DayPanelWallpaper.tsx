import React from 'react';
import { useDayViewWallpaperStyle } from '../../../lib/useDayViewWallpaperStyle';

/** Lazy owner-only paint, outside the critical Home calendar closure. */
const DayPanelWallpaper: React.FC = () => {
  const style = useDayViewWallpaperStyle();
  return style ? <div aria-hidden="true" data-dayview-wallpaper="true"
    className="pointer-events-none absolute inset-0 -z-10"
    style={style} /> : null;
};
export default DayPanelWallpaper;
