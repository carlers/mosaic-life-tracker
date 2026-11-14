import { describe, expect, it } from 'vitest';
import {
  resolveCalendarWallpaper,
  resolveCalendarWallpaperDim,
  resolveCalendarWallpaperScope,
} from '../../src/lib/calendarWallpaper';
import {
  resolveWallpaperOtherPages,
  wallpaperUploadSlot, resolveWallpaperUploadSlots,
  wallpaperPageForPath, resolveWallpaperPageChoices, resolvePageWallpaperId,
} from '../../src/lib/wallpaperPageSettings';
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
  it('does not wallpaper other pages without an explicit boolean opt-in', () => {
    expect(resolveWallpaperOtherPages(undefined)).toBe(false);
    expect(resolveWallpaperOtherPages(false)).toBe(false);
    expect(resolveWallpaperOtherPages('true')).toBe(false);
    expect(resolveWallpaperOtherPages({ enabled: true })).toBe(false);
    expect(resolveWallpaperOtherPages(true)).toBe(true);
  });
  it('accepts only five generated upload slots, never arbitrary file IDs or URLs', () => {
    for (const slot of [0,1,2,3,4] as const) {
      const id = `upload:${slot}`;
      expect(wallpaperUploadSlot(id)).toBe(slot);
      expect(resolveCalendarWallpaper(id)).toBe(id);
    }
    for (const invalid of ['upload:5','upload:-1','upload:00','upload:x','https://example.com/image.webp']) {
      expect(wallpaperUploadSlot(invalid)).toBeNull();
      expect(resolveCalendarWallpaper(invalid)).toBe('none');
    }
    expect(resolveWallpaperUploadSlots([4,2,2,0,-1,5,'1',3.4])).toEqual([0,2,4]);
  });
  it('routes protected pages separately and excludes Home and friend calendars', () => {
    expect(wallpaperPageForPath('/home')).toBeNull();
    expect(wallpaperPageForPath('/friends/123')).toBeNull();
    expect(wallpaperPageForPath('/explore')).toBe('explore');
    expect(wallpaperPageForPath('/notifications')).toBe('alerts');
    expect(wallpaperPageForPath('/messages/abc')).toBe('chat');
    expect(wallpaperPageForPath('/account')).toBe('me');
    expect(wallpaperPageForPath('/profile')).toBe('me');
    expect(wallpaperPageForPath('/settings')).toBe('settings');
    expect(wallpaperPageForPath('/settings/preferences/calendar')).toBe('settingsSubpages');
    expect(wallpaperPageForPath('/backlog')).toBe('other');
  });
  it('keeps each page disabled by default and migrates the previous global checkbox', () => {
    const off = resolveWallpaperPageChoices(undefined);
    expect(Object.values(off)).toEqual(Array(7).fill('off'));
    expect(Object.values(resolveWallpaperPageChoices(undefined, true))).toEqual(Array(7).fill('home'));
    const choices = resolveWallpaperPageChoices({
      explore: 'aurora', alerts: 'upload:4', settingsSubpages: 'home',
      me: 'https://evil', chat: 'off',
    });
    expect(choices.explore).toBe('aurora');
    expect(choices.alerts).toBe('upload:4');
    expect(choices.settingsSubpages).toBe('home');
    expect(choices.me).toBe('off');
    expect(choices.settings).toBe('off');
    expect(resolvePageWallpaperId(choices.explore, 'forest')).toBe('aurora');
    expect(resolvePageWallpaperId(choices.settingsSubpages, 'forest')).toBe('forest');
    expect(resolvePageWallpaperId(choices.chat, 'forest')).toBe('none');
  });
});
