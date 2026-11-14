import { describe, expect, it } from 'vitest';
import { resolveWallpaperMaterial } from '../../src/lib/wallpaperPageSettings';

describe('Wallpaper interface material', () => {
  it('defaults safely to soft and accepts only solid as the explicit opt-out', () => {
    expect(resolveWallpaperMaterial(undefined)).toBe('soft');
    expect(resolveWallpaperMaterial('soft')).toBe('soft');
    expect(resolveWallpaperMaterial('solid')).toBe('solid');
    expect(resolveWallpaperMaterial({ material: 'solid' })).toBe('soft');
  });
});
