import React, { useEffect, type RefObject } from 'react';
import { useKeyboardShortcuts } from '../hooks/keyboardShortcutsContext';
import { registerHomeShortcuts } from './homeShortcutRegistration';
import { processHomeGestureIntent } from './homeGestureIntent';
import type { NavigateFunction } from 'react-router-dom';

type Props = {
  taskSearchEnabled: boolean;
  isSearchOpen: boolean;
  isSettingsOpen: boolean;
  searchDaySheetOpen: boolean;
  friendCarouselRef: RefObject<HTMLDivElement | null>;
  handleOpenBacklog: () => void;
  handleOpenSearch: () => void;
  /** Route gestures are optional; ordinary Home loads no intent parser. */
  routeState?: unknown;
  routeKey?: string;
  navigate?: NavigateFunction;
  setMenuShortcut?: React.Dispatch<React.SetStateAction<{ key: string; action: 'menu' | 'categories' } | null>>;
  setViewShortcut?: React.Dispatch<React.SetStateAction<{ key: string; view: 'calendar' | 'todo' | 'diary' } | null>>;
  setActivePersonId?: React.Dispatch<React.SetStateAction<string>>;
};

/** Nonvisual, optional Home shortcuts; always mounted inside the keyboard context. */
const HomeKeyboardShortcutBridge: React.FC<Props> = ({
  taskSearchEnabled, isSearchOpen, isSettingsOpen, searchDaySheetOpen,
  friendCarouselRef, handleOpenBacklog, handleOpenSearch,
  routeState, routeKey, navigate, setMenuShortcut, setViewShortcut, setActivePersonId,
}) => {
  const { enabled } = useKeyboardShortcuts();
  useEffect(() => {
    if (!enabled || isSearchOpen || isSettingsOpen || searchDaySheetOpen) return;
    return registerHomeShortcuts({
      taskSearchEnabled, friendCarouselRef, handleOpenBacklog, handleOpenSearch,
    });
  }, [enabled, taskSearchEnabled, isSearchOpen, isSettingsOpen,
    searchDaySheetOpen, friendCarouselRef, handleOpenBacklog, handleOpenSearch]);
  // Home route-gesture actions share this already-lazy nonvisual bridge.
  // Dispatch in a microtask, exactly once per navigation, to avoid setting
  // parent state synchronously inside this effect or after a stale unmount.
  useEffect(() => {
    const request = routeState && typeof routeState === 'object'
      ? (routeState as { mosaicGestureRequest?: unknown }).mosaicGestureRequest : null;
    if (typeof request !== 'string' || !routeKey || !navigate ||
        !setMenuShortcut || !setViewShortcut || !setActivePersonId) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      processHomeGestureIntent(request, {
        onConsume: () => navigate('/home', { replace: true, state: null }),
        onSearch: handleOpenSearch,
        onMenu: action => setMenuShortcut({ key: routeKey, action }),
        onView: view => {
          setActivePersonId('me');
          setViewShortcut({ key: routeKey, view });
        },
      });
    });
    return () => { active = false; };
  }, [routeState, routeKey, navigate, handleOpenSearch,
    setMenuShortcut, setViewShortcut, setActivePersonId]);
  return null;
};

export default HomeKeyboardShortcutBridge;
