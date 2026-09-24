type PreloadPath =
  | '/home'
  | '/explore'
  | '/notifications'
  | '/messages'
  | '/account'
  | '/settings';

const PRELOADERS: Record<PreloadPath, () => Promise<unknown>> = {
  '/home': () => import('../../pages/HomePage'),
  '/explore': () => import('../../pages/ExplorePage'),
  '/notifications': () => import('./ComingSoon'),
  '/messages': () => import('../../pages/MessagesPage'),
  '/account': () => import('../../pages/AccountPage'),
  '/settings': () => import('../../pages/SettingsPage'),
};

function isPreloadPath(pathname: string): pathname is PreloadPath {
  return pathname in PRELOADERS;
}

export function preloadPrimaryRoute(pathname: string | null) {
  if (!pathname || !isPreloadPath(pathname)) return;
  void PRELOADERS[pathname]().catch((error) => {
    console.warn('[PrimaryRoutePreview] preload failed:', error);
  });
}
