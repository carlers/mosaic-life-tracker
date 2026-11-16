import type { NavigateFunction } from 'react-router-dom';
import { makeRouteParentState } from './primarySwipeNavigation';
import type { GestureShortcutAction } from './gestureShortcuts';

/** Route dispatch is not loaded into Home until a user opts in. */
const HOME_ACTIONS: ReadonlySet<GestureShortcutAction> =
  new Set(['menu', 'search', 'categories', 'calendar', 'todo', 'diary']);

const ROUTES: Partial<Record<GestureShortcutAction, string>> = {
  settings: '/settings',
  preferences: '/settings/preferences',
  'bucket-list': '/bucket-list',
  backlogs: '/backlog',
  uncompleted: '/backlog?view=uncompleted',
  home: '/home',
  explore: '/explore',
  alerts: '/notifications',
  chat: '/messages',
  me: '/account',
};

export function dispatchGestureShortcutAction(
  action: GestureShortcutAction,
  navigate: NavigateFunction,
  location: { pathname: string; search: string },
): void {
  if (HOME_ACTIONS.has(action)) {
    navigate('/home', { state: { mosaicGestureRequest: action } });
    return;
  }
  const path = ROUTES[action];
  if (!path || path === location.pathname + location.search) return;
  const parent = location.pathname === '/account' ? '/account' : '/home';
  const state = path === '/backlog' || path.startsWith('/backlog?') || path === '/bucket-list'
    ? makeRouteParentState(parent)
    : undefined;
  navigate(path, state ? { state } : undefined);
}
