import { resolvePrimarySwipeDestination } from '../../lib/primarySwipeNavigation';
import {
  loadAccountPage,
  loadNotificationsPage,
  loadExplorePage,
  loadHomePage,
  loadMessagesPage,
  loadSettingsPage,
} from './routeModuleLoaders';

import type { PROTECTED_ROUTES } from '../../lib/protectedRoutes';

// Keep preloading exhaustive for routes marked as preview-supported without
// pulling their actual page modules into the bootstrap bundle eagerly.
type PreloadPath = Extract<
  (typeof PROTECTED_ROUTES)[number],
  { readonly preview: 'supported' }
>['path'];

const PRELOADERS: Record<PreloadPath, () => Promise<unknown>> = {
  '/home': loadHomePage,
  '/explore': loadExplorePage,
  '/notifications': loadNotificationsPage,
  '/messages': loadMessagesPage,
  '/account': loadAccountPage,
  '/settings': loadSettingsPage,
};

function isPreloadPath(pathname: string): pathname is PreloadPath {
  return pathname in PRELOADERS;
}

export function getPrimaryRoutePreloadTargets(pathname: string): string[] {
  const left = resolvePrimarySwipeDestination(pathname, 'left');
  const right = resolvePrimarySwipeDestination(pathname, 'right');
  return [left, right].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index
  );
}

export function preloadPrimaryRoute(pathname: string | null) {
  if (!pathname || !isPreloadPath(pathname)) return;
  void PRELOADERS[pathname]().catch((error) => {
    console.warn('[PrimaryRoutePreview] preload failed:', error);
  });
}
