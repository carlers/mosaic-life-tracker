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
  // Keep friend-trackpad wiring in this already lazy module, not the Home
  // initial closure: the protected Home PWA gzip cap has ~50 bytes headroom.
  // The owning Swiper is the first carousel within Home's workspace;
  // nested Calendar/Day/Todo carousels retain wheel ownership.
  useEffect(() => {
    const lane = friendCarouselRef.current;
    const workspace = lane?.closest('.mosaic-home-workspace');
    const viewport = workspace?.querySelector<HTMLElement>('.swiper');
    const swiper = (viewport as (HTMLElement & { swiper?: import('swiper').Swiper }) | null)?.swiper;
    if (!viewport || !swiper || !setActivePersonId) return;
    let disposed = false;
    let detach: (() => void) | undefined;
    void import('./horizontalTrackpadSnap').then(({ attachResponsiveTrackpadNavigation }) => {
      if (disposed) return;
      detach = attachResponsiveTrackpadNavigation(
        viewport,
        direction => {
          const index = swiper.activeIndex + (direction === 'next' ? 1 : -1);
          if (index >= 0 && index < swiper.slides.length) swiper.slideTo(index, 0);
        },
        () => !isSearchOpen && !isSettingsOpen && !searchDaySheetOpen,
        direction => direction === 'next'
          ? swiper.activeIndex < swiper.slides.length - 1 : swiper.activeIndex > 0,
        (_event, target) => {
          for (let node: Element | null = target; node && node !== viewport; node = node.parentElement) {
            if (node.matches('.swiper, .embla, [data-route-swipe-horizontal-owner], [data-route-swipe-ignore="true"]')) return false;
            if (node.scrollWidth > node.clientWidth + 1 &&
                /auto|scroll/.test(getComputedStyle(node).overflowX)) return false;
          }
          return true;
        },
      );
    }).catch(() => { /* Touch/cursor/keyboard friend navigation remains available. */ });
    return () => { disposed = true; detach?.(); };
  }, [friendCarouselRef, isSearchOpen, isSettingsOpen, searchDaySheetOpen, setActivePersonId]);

  return null;
};

export default HomeKeyboardShortcutBridge;
