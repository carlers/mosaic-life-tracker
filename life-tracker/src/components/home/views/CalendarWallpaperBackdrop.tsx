import React from 'react';
import type { CalendarWallpaperId } from '../../../lib/calendarWallpaper';
import { wallpaperSourceForId } from '../../../lib/calendarWallpaperPresets';
import './CalendarWallpaperBackdrop.css';

interface CalendarWallpaperBackdropProps {
  id: CalendarWallpaperId;
  dim: number;
}

// One stationary paint, underneath all Calendar slides. Never captures taps,
// drags, text selection, or scrolling; no wallpaper work for the default mode.
export const CalendarWallpaperBackdrop: React.FC<CalendarWallpaperBackdropProps> = ({ id, dim }) => {
  const src = wallpaperSourceForId(id);
  if (!src) return null;
  const shade = `rgba(4, 8, 18, ${dim / 100})`;
  return (
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
};
