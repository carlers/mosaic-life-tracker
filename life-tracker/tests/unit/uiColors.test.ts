import { describe, expect, it, vi } from 'vitest';
import {
  UI_COLOR_ROLES, applyUiColors, cacheUiColors, defaultUiColors,
  readCachedUiColors, resolveUiColorChoice, uiColorSettingKey,
} from '../../src/lib/uiColors';

describe('independent UI color roles', () => {
  it('rejects unknown roles and hex values while accepting curated colors and sentinels', () => {
    expect(resolveUiColorChoice('app')).toBe('app');
    expect(resolveUiColorChoice('default')).toBe('default');
    expect(resolveUiColorChoice('#3b82f6')).toBe('#3B82F6');
    expect(resolveUiColorChoice('#123456')).toBe('default');
    expect(resolveUiColorChoice({ color: '#3B82F6' })).toBe('default');
    expect(new Set(UI_COLOR_ROLES).size).toBe(UI_COLOR_ROLES.length);
    expect(uiColorSettingKey('holidays')).toBe('uiColor:holidays');
  });

  it('caches choices per account, validates malformed cache and preserves reset', () => {
    const storage = new Map<string, string>();
    const cache = { setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null };
    const choices = { ...defaultUiColors(), holidays: '#3B82F6', calendarGrid: 'app' };
    cacheUiColors('one', choices, cache);
    expect(readCachedUiColors('one', cache)).toEqual(choices);
    expect(readCachedUiColors('two', cache)).toEqual(defaultUiColors());
    storage.set('mosaic_ui_colors:one', '{"holidays":"#000000","unknown":"app"}');
    expect(readCachedUiColors('one', cache)).toEqual(defaultUiColors());
    cacheUiColors('one', defaultUiColors(), cache);
    expect(readCachedUiColors('one', cache).holidays).toBe('default');
  });

  it('sets and clears role-scoped tokens without touching the app accent', () => {
    const props = new Map<string, string>();
    const attrs = new Map<string, string>();
    const root = {
      style: {
        setProperty: (key: string, value: string) => props.set(key, value),
        removeProperty: (key: string) => { props.delete(key); },
        getPropertyValue: (key: string) => props.get(key) ?? '',
      },
      setAttribute: (key: string, value: string) => attrs.set(key, value),
      removeAttribute: (key: string) => { attrs.delete(key); },
      getAttribute: (key: string) => attrs.get(key) ?? null,
      hasAttribute: (key: string) => attrs.has(key),
    } as unknown as HTMLElement;
    root.style.setProperty('--mosaic-accent', '#10B981');
    const choices = { ...defaultUiColors(), holidays: '#3B82F6', navigationBar: 'app', navigationActive: '#EC4899' };
    applyUiColors(choices, '#8B5CF6', root);
    expect(root.getAttribute('data-ui-holidays')).toBe('true');
    expect(root.style.getPropertyValue('--mosaic-ui-holidays')).toBe('#3B82F6');
    expect(root.style.getPropertyValue('--mosaic-ui-navigationBar')).toBe('#8B5CF6');
    expect(root.style.getPropertyValue('--mosaic-ui-nav-active-dark')).toMatch(/^#/);
    expect(root.style.getPropertyValue('--mosaic-accent')).toBe('#10B981');
    applyUiColors(defaultUiColors(), '#10B981', root);
    expect(root.hasAttribute('data-ui-holidays')).toBe(false);
    expect(root.style.getPropertyValue('--mosaic-ui-holidays')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-ui-nav-active-dark')).toBe('');
    expect(root.style.getPropertyValue('--mosaic-accent')).toBe('#10B981');
  });

  it('ignores unavailable persistence', () => {
    const setItem = vi.fn(() => { throw new Error('blocked'); });
    cacheUiColors('one', defaultUiColors(), { setItem });
    expect(setItem).toHaveBeenCalledOnce();
    expect(readCachedUiColors('one', { getItem: () => '{' })).toEqual(defaultUiColors());
  });
});
