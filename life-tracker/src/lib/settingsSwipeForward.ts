/** Validated account-synced left-swipe defaults for Settings navigation. */
export const SETTINGS_SWIPE_FORWARD_KEY = 'settingsSwipeForward';

export const SETTINGS_FORWARD_OPTIONS = [
  { value: '/settings/preferences', label: 'Preferences' },
  { value: '/settings/account', label: 'Account' },
  { value: '/settings/data', label: 'Data & Sync' },
  { value: '/settings/about', label: 'About Mosaic' },
  { value: '/settings/releases', label: 'Release history' },
] as const;

export const PREFERENCES_FORWARD_OPTIONS = [
  { value: '/settings/preferences/appearance', label: 'Appearance & Layout' },
  { value: '/settings/preferences/tasks', label: 'Tasks & Categories' },
  { value: '/settings/preferences/day-view', label: 'Day View' },
  { value: '/settings/preferences/calendar', label: 'Calendar' },
  { value: '/settings/preferences/diary', label: 'Diary' },
  { value: '/settings/preferences/social', label: 'Privacy & Social' },
  { value: '/settings/preferences/navigation', label: 'Navigation & Input' },
] as const;

export interface SettingsSwipeForward {
  settings: (typeof SETTINGS_FORWARD_OPTIONS)[number]['value'];
  preferences: (typeof PREFERENCES_FORWARD_OPTIONS)[number]['value'];
}

export const DEFAULT_SETTINGS_SWIPE_FORWARD: Readonly<SettingsSwipeForward> = {
  settings: '/settings/preferences',
  preferences: '/settings/preferences/appearance',
};

export function resolveSettingsSwipeForward(value: unknown): SettingsSwipeForward {
  const saved = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    settings: SETTINGS_FORWARD_OPTIONS.find(option => option.value === saved.settings)?.value
      ?? DEFAULT_SETTINGS_SWIPE_FORWARD.settings,
    preferences: PREFERENCES_FORWARD_OPTIONS.find(option => option.value === saved.preferences)?.value
      ?? DEFAULT_SETTINGS_SWIPE_FORWARD.preferences,
  };
}

export function settingsSwipeDefaultDestination(
  pathname: string,
  settings: SettingsSwipeForward,
): string | null {
  if (pathname === '/settings') return settings.settings;
  if (pathname === '/settings/preferences') return settings.preferences;
  return null;
}
