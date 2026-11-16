import type { GestureShortcutAction } from './gestureShortcuts';

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
