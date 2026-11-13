import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GESTURE_SHORTCUT_SETTINGS,
  GESTURE_SHORTCUT_TRIGGERS,
  isGestureShortcutAvailable,
  resolveGestureShortcutSettings,
} from '../../src/lib/gestureShortcuts';

describe('gesture shortcut preference contract', () => {
  it('requires explicit opt-in and preserves safe default assignments', () => {
    for (const value of [undefined, null, '', 17, [], { enabled: true }, { version: 2, enabled: true, assignments: {} }]) {
      const resolved = resolveGestureShortcutSettings(value);
      expect(resolved.enabled).toBe(false);
      expect(resolved.assignments).toEqual(DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments);
      expect(resolved.assignments).not.toBe(DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments);
    }
  });

  it('accepts only known actions and never upgrades a malformed assignment into navigation', () => {
    const resolved = resolveGestureShortcutSettings({
      version: 1,
      enabled: true,
      assignments: {
        'nav:account': 'settings',
        'nav:home': 'unexpected-action',
        'calendar:top': '/external',
        'calendar:bottom': 11,
        'day:bottom': 'search',
      },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.assignments['nav:account']).toBe('settings');
    expect(resolved.assignments['nav:home']).toBe('none');
    expect(resolved.assignments['calendar:top']).toBe('none');
    expect(resolved.assignments['calendar:bottom']).toBe('none');
    expect(resolved.assignments['day:bottom']).toBe('search');
    expect(Object.keys(resolved.assignments)).toEqual([...GESTURE_SHORTCUT_TRIGGERS]);
  });

  it('requires actual boolean true for enablement', () => {
    expect(resolveGestureShortcutSettings({
      version: 1, enabled: 'true',
      assignments: DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments,
    }).enabled).toBe(false);
  });

  it('fails closed for disabled social destinations and unavailable task search', () => {
    expect(isGestureShortcutAvailable('none', { socialEnabled: true, searchEnabled: true })).toBe(false);
    for (const action of ['explore', 'alerts', 'chat'] as const) {
      expect(isGestureShortcutAvailable(action, { socialEnabled: false, searchEnabled: true })).toBe(false);
    }
    expect(isGestureShortcutAvailable('search', { socialEnabled: true, searchEnabled: false })).toBe(false);
    expect(isGestureShortcutAvailable('categories', { socialEnabled: false, searchEnabled: false })).toBe(true);
  });
});
