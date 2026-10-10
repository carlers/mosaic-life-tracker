import type { TabId } from '../components/layout/BottomNav';

/**
 * Single registration point for protected app pages and their navigation
 * defaults. Adding an ordinary detail route requires only its path, page ID,
 * tab owner, and parent; the layout supplies edge-back automatically.
 *
 * The protected <Route> elements in App.tsx are generated from this table.
 * Authentication/reset routes live outside the protected shell.
 */
type BaseRoute = {
  id: string;
  path: string;
  tab: TabId;
  /** Only routes with an existing PrimaryRoutePreview implementation opt in. */
  preview: 'supported' | 'none';
  /** Explicitly override the standard per-kind swipe activation when needed. */
  swipeMode?: 'full' | 'home-zone' | 'edge-back';
  hideBottomNav?: boolean;
};

type PrimaryRoute = BaseRoute & {
  kind: 'primary';
  extraLeft?: string;
  parent?: never;
  alternateParents?: never;
  redirectTo?: never;
};
type DetailRoute = BaseRoute & {
  kind: 'detail';
  parent: string;
  alternateParents?: readonly string[];
  extraLeft?: never;
  redirectTo?: never;
};
type RedirectRoute = BaseRoute & {
  kind: 'redirect';
  parent: string;
  redirectTo: string;
  extraLeft?: never;
  alternateParents?: never;
};

export type ProtectedRoute = PrimaryRoute | DetailRoute | RedirectRoute;

export const PROTECTED_ROUTES = [
  { id: 'home', path: '/home', kind: 'primary', tab: 'home', preview: 'supported', swipeMode: 'home-zone' },
  { id: 'explore', path: '/explore', kind: 'primary', tab: 'explore', preview: 'supported' },
  { id: 'friendCalendar', path: '/friends/:friendId', kind: 'detail', tab: 'explore', parent: '/explore', preview: 'none' },
  { id: 'notifications', path: '/notifications', kind: 'primary', tab: 'notifications', preview: 'supported' },
  { id: 'messages', path: '/messages', kind: 'primary', tab: 'messages', preview: 'supported' },
  { id: 'chat', path: '/messages/:friendId', kind: 'detail', tab: 'messages', parent: '/messages', preview: 'none', hideBottomNav: true },
  { id: 'account', path: '/account', kind: 'primary', tab: 'account', extraLeft: '/settings', preview: 'supported' },
  // Existing Settings navigation uses full-width swipes. Preserve this
  // behavior rather than silently changing its gesture threshold.
  { id: 'settings', path: '/settings', kind: 'detail', tab: 'account', parent: '/account', swipeMode: 'full', preview: 'supported' },
  { id: 'releaseHistory', path: '/settings/releases', kind: 'detail', tab: 'account', parent: '/settings', preview: 'none' },
  { id: 'preferences', path: '/settings/preferences', kind: 'detail', tab: 'account', parent: '/settings', swipeMode: 'full', preview: 'none' },
  { id: 'notificationSettings', path: '/settings/notifications', kind: 'detail', tab: 'account', parent: '/settings', alternateParents: ['/notifications'], swipeMode: 'full', preview: 'none' },
  { id: 'screenRedirect', path: '/settings/screen', kind: 'redirect', tab: 'account', parent: '/settings', redirectTo: '/settings/preferences', preview: 'none' },
  { id: 'profile', path: '/profile', kind: 'detail', tab: 'account', parent: '/settings', swipeMode: 'full', preview: 'none' },
] as const satisfies readonly ProtectedRoute[];

export type ProtectedRouteEntry = (typeof PROTECTED_ROUTES)[number];
export type ProtectedPageId = Exclude<ProtectedRouteEntry['id'], 'screenRedirect'>;

export const PRIMARY_ROUTE_PATHS = PROTECTED_ROUTES
  .filter((route) => route.kind === 'primary')
  .map((route) => route.path);

const routeMatchers = PROTECTED_ROUTES.map((route) => ({
  route,
  pattern: new RegExp('^' + route.path.split('/').map((segment) =>
    segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^{}()|[\]\\]/g, '\\$&')
  ).join('/') + '$'),
}));

export function matchProtectedRoute(pathname: string): ProtectedRouteEntry | null {
  return routeMatchers.find(({ pattern }) => pattern.test(pathname))?.route ?? null;
}

export function protectedRouteSwipeMode(pathname: string): 'full' | 'home-zone' | 'edge-back' {
  const route = matchProtectedRoute(pathname);
  if (!route) return 'full';
  if ('swipeMode' in route && route.swipeMode) return route.swipeMode;
  return route.kind === 'detail' ? 'edge-back' : 'full';
}

export function protectedRouteHidesBottomNav(pathname: string): boolean {
  const route = matchProtectedRoute(pathname);
  return Boolean(route && 'hideBottomNav' in route && route.hideBottomNav);
}
