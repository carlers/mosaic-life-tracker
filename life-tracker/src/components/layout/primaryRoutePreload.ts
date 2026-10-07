import { resolvePrimarySwipeDestination } from '../../lib/primarySwipeNavigation';
import {
  loadAccountPage,
  loadNotificationsPage,
  loadExplorePage,
  loadHomePage,
  loadMessagesPage,
  loadSettingsPage,
} from './routeModuleLoaders';

type PreloadPath =
  | '/home'
  | '/explore'
  | '/notifications'
  | '/messages'
  | '/account'
  | '/settings';

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
