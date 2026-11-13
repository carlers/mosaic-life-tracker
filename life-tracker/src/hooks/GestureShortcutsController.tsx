import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { GestureShortcutsContextValue } from './gestureShortcutsContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFeatureEnabled } from './useFeatureEnabled';
import { useSettings } from './useSettings';
import {
  GESTURE_SHORTCUT_SETTINGS_KEY,
  isGestureShortcutAvailable,
  resolveGestureShortcutSettings,
  type GestureShortcutAction,
  type GestureShortcutTrigger,
} from '../lib/gestureShortcuts';

export const GestureShortcutsController: React.FC<{ onValueChange: (value: GestureShortcutsContextValue) => void }> = ({ onValueChange }) => {
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
  const dispatchRuntime = useRef<typeof import('../lib/gestureShortcutDispatch').dispatchGestureShortcutAction | null>(null);
  const currentGate = useRef({ enabled, socialEnabled, searchEnabled });
  useLayoutEffect(() => {
    currentGate.current = { enabled, socialEnabled, searchEnabled };
  }, [enabled, socialEnabled, searchEnabled]);
  useEffect(() => {
    let live = true;
    if (enabled) {
      void import('../lib/gestureShortcutDispatch').then(module => {
        if (live) dispatchRuntime.current = module.dispatchGestureShortcutAction;
      }).catch(() => {});
      // Warm the optional gesture adapter after opt-in, before the first swipe.
      void import('../components/layout/ShortcutGestureBridge').catch(() => {});
    } else {
      dispatchRuntime.current = null;
    }
    return () => { live = false; dispatchRuntime.current = null; };
  }, [enabled]);
  const availability = useMemo(() => ({ socialEnabled, searchEnabled }), [socialEnabled, searchEnabled]);

  const actionFor = useCallback((trigger: GestureShortcutTrigger) => {
    if (!enabled) return null;
    const action = settings.assignments[trigger];
    return isGestureShortcutAvailable(action, availability) ? action : null;
  }, [availability, enabled, settings]);

  const dispatch = useCallback((action: GestureShortcutAction) => {
    if (!enabled || !isGestureShortcutAvailable(action, availability)) return;
    const currentLocation = { pathname: location.pathname, search: location.search };
    if (dispatchRuntime.current) {
      dispatchRuntime.current(action, navigate, currentLocation);
      return;
    }
    // First opt-in gesture may arrive before prefetch settles. Dispatch once
    // after the module loads, but never after the user disables shortcuts.
    void import('../lib/gestureShortcutDispatch').then(module => {
      const gate = currentGate.current;
      if (gate.enabled && isGestureShortcutAvailable(action, gate)) {
        module.dispatchGestureShortcutAction(action, navigate, currentLocation);
      }
    }).catch(() => {});
  }, [availability, enabled, location.pathname, location.search, navigate]);

  const value = useMemo(() => ({ actionFor, dispatch }), [actionFor, dispatch]);
  useEffect(() => { onValueChange(value); }, [onValueChange, value]);
  return null;
};

