import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearanceMode,
  readCachedAppearanceMode,
  resolveAppearanceMode,
  type AppearanceMode,
} from '../../src/lib/appearance';

describe('appearance mode', () => {
  // Regression: PROJECT_REFERENCE.md §2 — System/Dark/Light/Black resolve to the documented palettes.
  it('resolves explicit modes and follows the system preference only for System', () => {
    expect(resolveAppearanceMode('dark', false)).toBe('dark');
    expect(resolveAppearanceMode('dark', true)).toBe('dark');
    expect(resolveAppearanceMode('light', true)).toBe('light');
    expect(resolveAppearanceMode('black', false)).toBe('black');
    expect(resolveAppearanceMode('system', true)).toBe('dark');
    expect(resolveAppearanceMode('system', false)).toBe('light');
  });

  it('restores a valid cached mode and ignores invalid values', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } as Storage;

    fakeStorage.setItem(APPEARANCE_STORAGE_KEY, 'black');
    expect(readCachedAppearanceMode(fakeStorage)).toBe('black');

    fakeStorage.setItem(APPEARANCE_STORAGE_KEY, 'sepia');
    expect(readCachedAppearanceMode(fakeStorage)).toBe('system');
  });

  it.each([
    ['dark', true, 'dark'],
    ['light', true, 'light'],
    ['black', false, 'black'],
    ['system', false, 'light'],
  ] satisfies Array<[AppearanceMode, boolean, string]>)(
    'applies %s immediately to the document palette',
    (mode, prefersDark, expectedTheme) => {
      const root = document.documentElement;
      applyAppearanceMode(mode, { root, prefersDark });
      expect(root.dataset.appearanceMode).toBe(mode);
      expect(root.dataset.theme).toBe(expectedTheme);
      expect(root.style.colorScheme).toBe(
        expectedTheme === 'light' ? 'light' : 'dark'
      );
    }
  );
});
