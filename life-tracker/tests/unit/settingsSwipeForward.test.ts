import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS_SWIPE_FORWARD,
  SETTINGS_FORWARD_OPTIONS,
  PREFERENCES_FORWARD_OPTIONS,
  resolveSettingsSwipeForward,
  settingsSwipeDefaultDestination,
} from '../../src/lib/settingsSwipeForward';

describe('Settings swipe-forward defaults', () => {
  it('starts with Preferences and Appearance & Layout independently of history', () => {
    const defaults = resolveSettingsSwipeForward(null);
    expect(defaults).toEqual(DEFAULT_SETTINGS_SWIPE_FORWARD);
    expect(settingsSwipeDefaultDestination('/settings', defaults)).toBe('/settings/preferences');
    expect(settingsSwipeDefaultDestination('/settings/preferences', defaults))
      .toBe('/settings/preferences/appearance');
    expect(settingsSwipeDefaultDestination('/settings/preferences/tasks', defaults)).toBeNull();
    expect(settingsSwipeDefaultDestination('/settings/about', defaults)).toBeNull();
    expect(settingsSwipeDefaultDestination('/account', defaults)).toBeNull();
  });

  it('preserves independently configured known destinations', () => {
    const configured = resolveSettingsSwipeForward({
      settings: '/settings/data', preferences: '/settings/preferences/calendar',
    });
    expect(settingsSwipeDefaultDestination('/settings', configured)).toBe('/settings/data');
    expect(settingsSwipeDefaultDestination('/settings/preferences', configured))
      .toBe('/settings/preferences/calendar');
    expect(SETTINGS_FORWARD_OPTIONS.map(o => o.value)).toContain(configured.settings);
    expect(PREFERENCES_FORWARD_OPTIONS.map(o => o.value)).toContain(configured.preferences);
  });

  it('rejects untrusted routes and malformed settings without leaking into navigation', () => {
    for (const invalid of [null, undefined, [], 123, 'hello', { settings: '/evil', preferences: '/home' }]) {
      expect(resolveSettingsSwipeForward(invalid)).toEqual(DEFAULT_SETTINGS_SWIPE_FORWARD);
    }
    expect(resolveSettingsSwipeForward({
      settings: '/settings/about', preferences: '/other',
    })).toEqual({
      settings: '/settings/about', preferences: DEFAULT_SETTINGS_SWIPE_FORWARD.preferences,
    });
    expect(resolveSettingsSwipeForward({
      settings: '/settings/notifications', preferences: '/settings/preferences/navigation',
    })).toEqual({
      settings: DEFAULT_SETTINGS_SWIPE_FORWARD.settings,
      preferences: '/settings/preferences/navigation',
    });
  });
});
