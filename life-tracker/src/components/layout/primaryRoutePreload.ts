import {
  preloadHomeRoutePage,
  preloadAccountRoutePage,
  preloadSettingsRoutePage,
  preloadReleaseHistoryRoutePage,
  preloadPreferencesRoutePage,
  preloadNotificationSettingsRoutePage,
  preloadProfileRoutePage,
  preloadExploreRoutePage,
  preloadMessagesRoutePage,
  preloadNotificationsRoutePage,
} from './routePageComponents';

import type { PROTECTED_ROUTES } from '../../lib/protectedRoutes';

// Keep preloading exhaustive for routes marked as preview-supported without
// pulling their actual page modules into the bootstrap bundle eagerly.
type PreloadPath = Extract<
  (typeof PROTECTED_ROUTES)[number],
  { readonly preview: 'supported' }
>['path'];

const PRELOADERS: Record<PreloadPath, () => Promise<unknown>> = {
  '/home': preloadHomeRoutePage,
  '/explore': preloadExploreRoutePage,
  '/notifications': preloadNotificationsRoutePage,
  '/messages': preloadMessagesRoutePage,
  '/account': preloadAccountRoutePage,
  '/settings': preloadSettingsRoutePage,
  '/settings/account': preloadSettingsRoutePage,
  '/settings/data': preloadSettingsRoutePage,
  '/settings/about': preloadSettingsRoutePage,
  '/settings/preferences/appearance': preloadPreferencesRoutePage,
  '/settings/preferences/tasks': preloadPreferencesRoutePage,
  '/settings/preferences/calendar': preloadPreferencesRoutePage,
  '/settings/preferences/diary': preloadPreferencesRoutePage,
  '/settings/preferences/navigation': preloadPreferencesRoutePage,
  '/settings/preferences': preloadPreferencesRoutePage,
  '/settings/notifications': preloadNotificationSettingsRoutePage,
  '/settings/releases': preloadReleaseHistoryRoutePage,
  '/profile': preloadProfileRoutePage,
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

// Warm Settings modules only after visiting Settings; do not add them to
// Home startup. Repeated detail paths share the same prepared importer.
export const SETTINGS_SUBPAGE_PRELOAD_TARGETS = [
  '/settings/account',
  '/settings/data',
  '/settings/about',
  '/settings/preferences',
  '/settings/notifications',
  '/settings/releases',
  '/profile',
] as const satisfies readonly PreloadPath[];

export function preloadSettingsSubpages(): void {
  for (const pathname of SETTINGS_SUBPAGE_PRELOAD_TARGETS) preloadPrimaryRoute(pathname);
}
