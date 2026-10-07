import { describe, expect, it, vi } from 'vitest';
import {
  ACCENT_COLOR_PALETTES,
  DEFAULT_ACCENT_COLOR,
  getAllAccentColors,
  getContrastRatio,
} from '../../src/constants/colors';
import {
  applyAccentColor,
  cacheAccentColor,
  getAccentColorStorageKey,
  getAccentColorTokens,
  readCachedAccentColor,
} from '../../src/lib/accentColor';

describe('accent color', () => {
  it('keeps every curated accent readable as text in dark and light themes', () => {
    expect(ACCENT_COLOR_PALETTES.length).toBeGreaterThan(1);

    for (const color of getAllAccentColors()) {
      const tokens = getAccentColorTokens(color);
      expect(getContrastRatio(tokens.foreground, tokens.base)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(tokens.textDark, '#111111')).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(tokens.textLight, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stores accent caches per account and rejects invalid cached colors', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } as Storage;

    cacheAccentColor('#3B82F6', 'user_a', fakeStorage);
    cacheAccentColor('#EC4899', 'user_b', fakeStorage);

    expect(readCachedAccentColor('user_a', fakeStorage)).toBe('#3B82F6');
    expect(readCachedAccentColor('user_b', fakeStorage)).toBe('#EC4899');

    fakeStorage.setItem(getAccentColorStorageKey('user_a'), '#123456');
    expect(readCachedAccentColor('user_a', fakeStorage)).toBe(DEFAULT_ACCENT_COLOR);
  });

  it('applies the normalized accent tokens to the provided root', () => {
    const setProperty = vi.fn();
    const root = {
      dataset: {} as DOMStringMap,
      style: { setProperty },
    } as unknown as HTMLElement;

    expect(applyAccentColor('#3b82f6', root)).toBe('#3B82F6');
    expect(root.dataset.accentColor).toBe('#3B82F6');
    expect(setProperty).toHaveBeenCalledWith('--mosaic-accent', '#3B82F6');
    expect(setProperty).toHaveBeenCalledWith(
      '--mosaic-accent-foreground',
      expect.stringMatching(/^#(?:000000|FFFFFF)$/)
    );
  });
});
