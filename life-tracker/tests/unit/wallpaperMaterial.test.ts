import { describe, expect, it } from 'vitest';
import { resolveWallpaperMaterial, resolveGlassTransparency } from '../../src/lib/wallpaperPageSettings';

describe('Wallpaper interface material', () => {
  it('defaults safely to soft and accepts only solid as the explicit opt-out', () => {
    expect(resolveWallpaperMaterial(undefined)).toBe('soft');
    expect(resolveWallpaperMaterial('soft')).toBe('soft');
    expect(resolveWallpaperMaterial('solid')).toBe('solid');
    expect(resolveWallpaperMaterial({ material: 'solid' })).toBe('soft');
  });  it('bounds and snaps synced glass transparency, rejecting malformed values', () => {
    expect(resolveGlassTransparency(undefined)).toBe(50);
    expect(resolveGlassTransparency(0)).toBe(0);
    expect(resolveGlassTransparency(100)).toBe(100);
    expect(resolveGlassTransparency(74)).toBe(70);
    expect(resolveGlassTransparency(76)).toBe(80);
    expect(resolveGlassTransparency(-40)).toBe(0);
    expect(resolveGlassTransparency(200)).toBe(100);
    expect(resolveGlassTransparency(Number.NaN)).toBe(50);
    expect(resolveGlassTransparency('100')).toBe(50);
    expect(resolveGlassTransparency({ level: 40 })).toBe(50);
  });
});
