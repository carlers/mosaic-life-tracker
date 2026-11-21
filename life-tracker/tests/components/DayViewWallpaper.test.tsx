import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useDayViewWallpaperAppearance, useDayViewWallpaperStyle } from '../../src/lib/useDayViewWallpaperStyle';
const prefs = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  loaded: [] as string[],
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({ getSetting: (key: string) => prefs.values[key] }),
}));
vi.mock('../../src/lib/useWallpaperSource', () => ({
  useWallpaperSource: (id: string) => {
    prefs.loaded.push(id);
    return id === 'none' ? null : `/wallpapers/${id}`;
  },
}));
afterEach(() => { cleanup(); prefs.values = {}; prefs.loaded = []; });
describe('Day View wallpaper preference', () => {
  it('does not fetch or paint a wallpaper by default or in excluded panels', () => {
    expect(renderHook(() => useDayViewWallpaperStyle()).result.current).toBeUndefined();
    expect(prefs.loaded.at(-1)).toBe('none');
    prefs.values.calendarWallpaperPages = { dayView: 'upload:2' };
    expect(renderHook(() => useDayViewWallpaperStyle(false)).result.current).toBeUndefined();
    expect(prefs.loaded.at(-1)).toBe('none');
  });
  it('supports an independent photo and does not change Home wallpaper', () => {
    prefs.values.calendarWallpaper = 'forest';
    prefs.values.calendarWallpaperPages = { dayView: 'upload:2' };
    prefs.values.calendarWallpaperDim = 67;
    const { result } = renderHook(() => useDayViewWallpaperStyle());
    expect(prefs.loaded.at(-1)).toBe('upload:2');
    expect(result.current?.backgroundImage).toContain('/wallpapers/upload:2');
    expect(result.current?.backgroundImage).toContain('0.67');
  });
  it('reuses Home choice and falls back to off if Home has no image', () => {
    prefs.values.calendarWallpaperPages = { dayView: 'home' };
    expect(renderHook(() => useDayViewWallpaperStyle()).result.current).toBeUndefined();
    prefs.values.calendarWallpaper = 'dusk';
    const { result } = renderHook(() => useDayViewWallpaperStyle());
    expect(prefs.loaded.at(-1)).toBe('dusk');
    expect(result.current).toBeDefined();
  });

  it('enables glass only for an owner wallpaper-backed Day View using Soft Frosted', () => {
    prefs.values.calendarWallpaperMaterial = 'soft';
    prefs.values.calendarGlassTransparency = 80;
    expect(renderHook(() => useDayViewWallpaperAppearance()).result.current.glass).toBe(false);

    prefs.values.calendarWallpaperPages = { dayView: 'forest' };
    const soft = renderHook(() => useDayViewWallpaperAppearance()).result.current;
    expect(soft.glass).toBe(true);
    expect(soft.style?.backgroundImage).toContain('/wallpapers/forest');

    prefs.values.calendarWallpaperMaterial = 'solid';
    const solid = renderHook(() => useDayViewWallpaperAppearance()).result.current;
    expect(solid.glass).toBe(false);
    expect(solid.style?.backgroundImage).toContain('/wallpapers/forest');

    prefs.values.calendarWallpaperMaterial = 'soft';
    expect(renderHook(() => useDayViewWallpaperAppearance(false)).result.current.glass).toBe(false);
  });
});
