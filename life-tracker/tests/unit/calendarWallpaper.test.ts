import { describe, expect, it } from 'vitest';
import {
  resolveCalendarWallpaper,
  resolveCalendarWallpaperDim,
} from '../../src/lib/calendarWallpaper';
import { CALENDAR_WALLPAPER_PRESETS, wallpaperSourceForId } from '../../src/lib/calendarWallpaperPresets';

describe('Calendar wallpaper owner preferences', () => {
  it('preserves default appearance for absent, unknown, or malformed values', () => {
    expect(resolveCalendarWallpaper(undefined)).toBe('none');
    expect(resolveCalendarWallpaper('uploaded:evil')).toBe('none');
    expect(resolveCalendarWallpaper({ id: 'aurora' })).toBe('none');
    expect(wallpaperSourceForId('none')).toBeNull();
  });

  it('accepts only the shipped, offline-precacheable presets', () => {
    expect(CALENDAR_WALLPAPER_PRESETS).toHaveLength(4);
    for (const preset of CALENDAR_WALLPAPER_PRESETS) {
      expect(resolveCalendarWallpaper(preset.id)).toBe(preset.id);
      expect(wallpaperSourceForId(preset.id)).toBe(preset.src);
      expect(preset.src).toMatch(/^\/wallpapers\/[a-z]+\.svg$/);
    }
  });

  it('bounds overlay percentages and rejects malformed values', () => {
    expect(resolveCalendarWallpaperDim(undefined)).toBe(55);
    expect(resolveCalendarWallpaperDim('0')).toBe(55);
    expect(resolveCalendarWallpaperDim(Number.NaN)).toBe(55);
    expect(resolveCalendarWallpaperDim(-12)).toBe(35);
    expect(resolveCalendarWallpaperDim(99)).toBe(80);
    expect(resolveCalendarWallpaperDim(63)).toBe(65);
  });
});
