import { describe, expect, it, vi } from 'vitest';
import { getAllAccentColors, getContrastRatio } from '../../src/constants/colors';
import {
  UI_COLOR_ROLES, applyUiColors, cacheUiColors, defaultUiColors,
  getHolidayLabelTextColors, readCachedUiColors, resolveUiColorChoice, uiColorSettingKey,
} from '../../src/lib/uiColors';

describe('single accent color placement', () => {
  it('exposes independent roles with legacy default appearance', () => {
    const defaults = defaultUiColors();
    expect(new Set(UI_COLOR_ROLES).size).toBe(UI_COLOR_ROLES.length);
    expect(defaults.controls).toBe(true);
    expect(defaults.icons).toBe(true);
    expect(defaults.text).toBe(true);
    expect(defaults.holidays).toBe(false);
    expect(defaults.dateHeaders).toBe(false);
    expect(defaults.dayHeaders).toBe(false);
    expect(defaults.settingsText).toBe(false);
    expect(defaults.settingsIcons).toBe(false);
    expect(defaults.generalText).toBe(false);
    expect(defaults.friendCarousel).toBe(false);
    expect(defaults.bottomSheetText).toBe(false);
    expect(uiColorSettingKey('friendCarousel')).toBe('uiColor:friendCarousel');
    expect(defaults.navigationBar).toBe(false);
    expect(uiColorSettingKey('holidays')).toBe('uiColor:holidays');
  });
  it('reads prior per-role palette settings only as scope toggles', () => {
    expect(resolveUiColorChoice('app', 'holidays')).toBe(true);
    expect(resolveUiColorChoice('#3B82F6', 'holidays')).toBe(true);
    expect(resolveUiColorChoice('default', 'holidays')).toBe(false);
    expect(resolveUiColorChoice('default', 'controls')).toBe(true);
    expect(resolveUiColorChoice(false, 'controls')).toBe(false);
    expect(resolveUiColorChoice('#123456', 'dateHeaders')).toBe(false);
    expect(resolveUiColorChoice({ color: '#3B82F6' }, 'holidays')).toBe(false);
  });

  it('isolates cached placements by owner and sanitizes old values', () => {
    const storage = new Map<string, string>();
    const cache = { setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null };
    const placements = { ...defaultUiColors(), holidays: true, dateHeaders: true, controls: false };
    cacheUiColors('owner-a', placements, cache);
    expect(readCachedUiColors('owner-a', cache)).toEqual(placements);
    expect(readCachedUiColors('owner-b', cache)).toEqual(defaultUiColors());
    storage.set('mosaic_ui_colors:owner-a', '{"holidays":"#3B82F6","text":"default","controls":"app"}');
    expect(readCachedUiColors('owner-a', cache)).toEqual({ ...defaultUiColors(), holidays: true });
    expect(readCachedUiColors('', cache)).toEqual(defaultUiColors());
    expect(readCachedUiColors('owner-a', { getItem: () => '{' })).toEqual(defaultUiColors());
  });

  it('shares the same accent across enabled roles, clears disabled roles and preserves global accent', () => {
    const props = new Map<string, string>();
    const attrs = new Map<string, string>();
    const root = {
      style: {
        setProperty: (k: string, v: string) => props.set(k, v),
        removeProperty: (k: string) => { props.delete(k); },
        getPropertyValue: (k: string) => props.get(k) ?? '',
      },
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => { attrs.delete(k); },
      getAttribute: (k: string) => attrs.get(k) ?? null,
      hasAttribute: (k: string) => attrs.has(k),
    } as unknown as HTMLElement;
    root.style.setProperty('--mosaic-accent', '#10B981');
    const choices = { ...defaultUiColors(), holidays: true, dateHeaders: true, navigationBar: true, settingsIcons: true, generalText: true, friendCarousel: true, bottomSheetText: true, controls: false };
    applyUiColors(choices, '#8B5CF6', root);
    expect(root.style.getPropertyValue('--mosaic-ui-holidays')).toBe('#8B5CF6');
    expect(root.style.getPropertyValue('--mosaic-ui-dateHeaders')).toBe('#8B5CF6');
    expect(root.style.getPropertyValue('--mosaic-ui-navigationBar')).toBe('#8B5CF6');
    expect(root.style.getPropertyValue('--mosaic-ui-settingsIcons')).toBe('#8B5CF6');
    expect(root.style.getPropertyValue('--mosaic-ui-friendCarousel')).toBe('#8B5CF6');
    expect(root.style.getPropertyValue('--mosaic-ui-bottomSheetText')).toBe('#8B5CF6');
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-friendCarousel-foreground'), '#8B5CF6')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-carousel-inactive-dark'), '#1E1E1E')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-carousel-inactive-light'), '#F7F7F8')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-sheet-label-dark'), '#2A2A2A')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-sheet-label-light'), '#F0F1F3')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-generalText-text-dark'), '#111111')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-generalText-text-light'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-nav-label-dark'), '#1E1E1E')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(root.style.getPropertyValue('--mosaic-ui-nav-label-light'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(root.style.getPropertyValue('--mosaic-ui-nav-active-dark')).toBe('');

    expect(root.getAttribute('data-ui-controls')).toBe('false');
    expect(root.style.getPropertyValue('--mosaic-ui-controls')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-accent')).toBe('#10B981');
    applyUiColors({ ...defaultUiColors(), holidays: false }, '#EC4899', root);
    expect(root.hasAttribute('data-ui-holidays')).toBe(false);
    expect(root.style.getPropertyValue('--mosaic-ui-dateHeaders')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-nav-label-dark')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-settingsIcons')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-generalText')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-friendCarousel')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-bottomSheetText')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-carousel-inactive-dark')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-sheet-label-dark')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-icons')).toBe('#EC4899');
    expect(root.style.getPropertyValue('--mosaic-accent')).toBe('#10B981');
  });

  it('supports cached friend carousel and bottom sheet placements without leaking across accounts', () => {
    const values = { ...defaultUiColors(), friendCarousel: true, bottomSheetText: true };
    const stored = new Map<string, string>();
    const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } };
    cacheUiColors('owner-a', values, storage);
    expect(readCachedUiColors('owner-a', storage)).toEqual(values);
    expect(readCachedUiColors('owner-b', storage)).toEqual(defaultUiColors());
  });

  it('preserves AA holiday-label contrast for all preset accents', () => {
    const tint = (base: string, color: string) => '#' + [1, 3, 5].map(i =>
      Math.round(Number.parseInt(base.slice(i, i + 2), 16) * .85
        + Number.parseInt(color.slice(i, i + 2), 16) * .15).toString(16).padStart(2, '0')
    ).join('');
    for (const color of getAllAccentColors()) {
      const tokens = getHolidayLabelTextColors(color);
      expect(getContrastRatio(tokens.dark, tint('#1E1E1E', color))).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(tokens.light, tint('#F7F7F8', color))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tolerates localStorage failure', () => {
    const setItem = vi.fn(() => { throw new Error('blocked'); });
    cacheUiColors('owner-a', defaultUiColors(), { setItem });
    expect(setItem).toHaveBeenCalledOnce();
  });
});
