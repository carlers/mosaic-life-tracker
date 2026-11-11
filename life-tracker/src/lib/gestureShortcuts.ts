/** Account-synced, opt-in shortcuts. Unknown versions/actions fail closed. */
export const GESTURE_SHORTCUT_SETTINGS_KEY = 'gestureShortcuts';

export const GESTURE_SHORTCUT_TRIGGERS = [
  'nav:home', 'nav:explore', 'nav:notifications', 'nav:messages', 'nav:account',
  'calendar:top', 'calendar:bottom', 'day:bottom',
] as const;

export type GestureShortcutTrigger = (typeof GESTURE_SHORTCUT_TRIGGERS)[number];

export const GESTURE_SHORTCUT_ACTIONS = [
  'none', 'menu', 'settings', 'preferences', 'search', 'categories',
  'bucket-list', 'backlogs', 'uncompleted', 'home', 'explore', 'alerts',
  'chat', 'me', 'calendar', 'todo', 'diary',
] as const;

export type GestureShortcutAction = (typeof GESTURE_SHORTCUT_ACTIONS)[number];

export interface GestureShortcutSettings {
  version: 1;
  enabled: boolean;
  assignments: Record<GestureShortcutTrigger, GestureShortcutAction>;
}

export const DEFAULT_GESTURE_SHORTCUT_SETTINGS: Readonly<GestureShortcutSettings> = {
  version: 1,
  enabled: false,
  assignments: {
    'nav:home': 'menu',
    'nav:explore': 'none',
    'nav:notifications': 'none',
    'nav:messages': 'none',
    'nav:account': 'settings',
    'calendar:top': 'none',
    'calendar:bottom': 'none',
    'day:bottom': 'none',
  },
};

export const GESTURE_SHORTCUT_OPTIONS: ReadonlyArray<{ value: GestureShortcutAction; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'menu', label: 'Hamburger menu' },
  { value: 'settings', label: 'Settings' },
  { value: 'preferences', label: 'Preferences' },
  { value: 'search', label: 'Search tasks' },
  { value: 'categories', label: 'Category manager' },
  { value: 'bucket-list', label: 'Bucket List' },
  { value: 'backlogs', label: 'Backlogs' },
  { value: 'uncompleted', label: 'Uncompleted Tasks' },
  { value: 'home', label: 'Home' },
  { value: 'explore', label: 'Explore' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'chat', label: 'Chat' },
  { value: 'me', label: 'Me' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'todo', label: 'Todo List' },
  { value: 'diary', label: 'Diary' },
];

const actionSet: ReadonlySet<string> = new Set(GESTURE_SHORTCUT_ACTIONS);
const triggers: ReadonlyArray<GestureShortcutTrigger> = GESTURE_SHORTCUT_TRIGGERS;

export function isGestureShortcutAction(value: unknown): value is GestureShortcutAction {
  return typeof value === 'string' && actionSet.has(value);
}

export function resolveGestureShortcutSettings(value: unknown): GestureShortcutSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS, assignments: { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments } };
  }
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !input.assignments || typeof input.assignments !== 'object' ||
      Array.isArray(input.assignments)) {
    return { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS, assignments: { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments } };
  }
  const raw = input.assignments as Record<string, unknown>;
  const assignments = { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments };
  for (const trigger of triggers) {
    // Malformed individual choices never dispatch another action by accident.
    assignments[trigger] = isGestureShortcutAction(raw[trigger]) ? raw[trigger] : 'none';
  }
  return { version: 1, enabled: input.enabled === true, assignments };
}

export function isGestureShortcutAvailable(
  action: GestureShortcutAction,
  options: { socialEnabled: boolean; searchEnabled: boolean }
): boolean {
  if (action === 'none') return false;
  if (action === 'search') return options.searchEnabled;
  if (action === 'explore' || action === 'alerts' || action === 'chat') return options.socialEnabled;
  return true;
}
