import { describe, expect, it } from 'vitest';
import {
  resolveCalendarWallpaper,
  resolveCalendarWallpaperDim,
  resolveCalendarWallpaperScope,
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
    expect(resolveCalendarWallpaperDim(-12)).toBe(0);
    expect(resolveCalendarWallpaperDim(0)).toBe(0);
    expect(resolveCalendarWallpaperDim(99)).toBe(99);
    expect(resolveCalendarWallpaperDim(100)).toBe(100);
    expect(resolveCalendarWallpaperDim(120)).toBe(100);
    expect(resolveCalendarWallpaperDim(63.4)).toBe(63);
    expect(resolveCalendarWallpaperDim(63.7)).toBe(64);
  });
  it('defaults to the original grid coverage and rejects malformed scope values', () => {
    expect(resolveCalendarWallpaperScope(undefined)).toBe('grid');
    expect(resolveCalendarWallpaperScope('full-screen')).toBe('grid');
    expect(resolveCalendarWallpaperScope('grid')).toBe('grid');
    expect(resolveCalendarWallpaperScope('home')).toBe('home');
  });
});
