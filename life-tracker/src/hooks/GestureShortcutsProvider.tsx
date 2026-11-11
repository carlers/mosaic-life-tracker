import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFeatureEnabled } from './useFeatureEnabled';
import { useSettings } from './useSettings';
import { makeRouteParentState } from '../lib/primarySwipeNavigation';
import {
  GESTURE_SHORTCUT_SETTINGS_KEY,
  isGestureShortcutAvailable,
  resolveGestureShortcutSettings,
  type GestureShortcutAction,
  type GestureShortcutTrigger,
} from '../lib/gestureShortcuts';

interface GestureShortcutsContextValue {
  actionFor: (trigger: GestureShortcutTrigger) => GestureShortcutAction | null;
  dispatch: (action: GestureShortcutAction) => void;
}

const GestureShortcutsContext = createContext<GestureShortcutsContextValue>({
  actionFor: () => null,
  dispatch: () => {},
});

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

export const GestureShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getSetting } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const featureEnabled = useFeatureEnabled('mosaic_disable_gesture_shortcuts');
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const searchEnabled = useFeatureEnabled('mosaic_disable_task_search');
  const settings = useMemo(
    () => resolveGestureShortcutSettings(getSetting(GESTURE_SHORTCUT_SETTINGS_KEY)),
    [getSetting],
  );
  const enabled = featureEnabled && settings.enabled;
  const availability = useMemo(() => ({ socialEnabled, searchEnabled }), [socialEnabled, searchEnabled]);

  const actionFor = useCallback((trigger: GestureShortcutTrigger) => {
    if (!enabled) return null;
    const action = settings.assignments[trigger];
    return isGestureShortcutAvailable(action, availability) ? action : null;
  }, [availability, enabled, settings]);

  const dispatch = useCallback((action: GestureShortcutAction) => {
    if (!enabled || !isGestureShortcutAvailable(action, availability)) return;
    if (HOME_ACTIONS.has(action)) {
      navigate('/home', { state: { mosaicGestureRequest: action } });
      return;
    }
    const path = ROUTES[action];
    if (!path) return;
    if (path === location.pathname + location.search) return;
    const parent = location.pathname === '/account' ? '/account' : '/home';
    const state = path === '/backlog' || path.startsWith('/backlog?') || path === '/bucket-list'
      ? makeRouteParentState(parent)
      : undefined;
    navigate(path, state ? { state } : undefined);
  }, [availability, enabled, location.pathname, location.search, navigate]);

  const value = useMemo(() => ({ actionFor, dispatch }), [actionFor, dispatch]);
  return <GestureShortcutsContext.Provider value={value}>{children}</GestureShortcutsContext.Provider>;
};

export function useGestureShortcuts(): GestureShortcutsContextValue {
  return useContext(GestureShortcutsContext);
}
