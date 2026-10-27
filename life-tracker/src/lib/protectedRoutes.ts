import type { TabId } from '../components/layout/BottomNav';

/**
 * Single registration point for protected app pages and their navigation
 * defaults. Adding an ordinary detail route requires only its path, page ID,
 * tab owner, and parent; the layout supplies full-page swipe back automatically.
 * Gesture-heavy nested detail pages opt in to edge-back explicitly.
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
  { id: 'bucketListDetail', path: '/bucket-list/:id', kind: 'detail', tab: 'home', parent: '/bucket-list', preview: 'none' },
  { id: 'bucketList', path: '/bucket-list', kind: 'detail', tab: 'home', parent: '/home', alternateParents: ['/account'], preview: 'none' },
  { id: 'backlog', path: '/backlog', kind: 'detail', tab: 'home', parent: '/home', alternateParents: ['/account', '/backlog?view=uncompleted'], preview: 'none' },
  { id: 'explore', path: '/explore', kind: 'primary', tab: 'explore', preview: 'supported' },
  { id: 'friendCalendar', path: '/friends/:friendId', kind: 'detail', tab: 'explore', parent: '/explore', preview: 'none', swipeMode: 'edge-back' },
  { id: 'notifications', path: '/notifications', kind: 'primary', tab: 'notifications', preview: 'supported' },
  { id: 'messages', path: '/messages', kind: 'primary', tab: 'messages', preview: 'supported' },
  { id: 'chat', path: '/messages/:friendId', kind: 'detail', tab: 'messages', parent: '/messages', preview: 'none', hideBottomNav: true, swipeMode: 'edge-back' },
  { id: 'account', path: '/account', kind: 'primary', tab: 'account', extraLeft: '/settings', preview: 'supported' },
  // Existing Settings navigation uses full-width swipes. Preserve this
  // behavior rather than silently changing its gesture threshold.
  { id: 'settings', path: '/settings', kind: 'detail', tab: 'account', parent: '/account', swipeMode: 'full', preview: 'supported' },
  { id: 'settingsAccount', path: '/settings/account', kind: 'detail', tab: 'account', parent: '/settings', alternateParents: ['/account'], swipeMode: 'full', preview: 'none' },
  { id: 'settingsData', path: '/settings/data', kind: 'detail', tab: 'account', parent: '/settings', swipeMode: 'full', preview: 'none' },
  { id: 'settingsAbout', path: '/settings/about', kind: 'detail', tab: 'account', parent: '/settings', swipeMode: 'full', preview: 'none' },
  { id: 'releaseHistory', path: '/settings/releases', kind: 'detail', tab: 'account', parent: '/settings', preview: 'supported' },
  { id: 'preferences', path: '/settings/preferences', kind: 'detail', tab: 'account', parent: '/settings', swipeMode: 'full', preview: 'supported' },
  { id: 'preferenceAppearance', path: '/settings/preferences/appearance', kind: 'detail', tab: 'account', parent: '/settings/preferences', alternateParents: ['/settings'], swipeMode: 'full', preview: 'none' },
  { id: 'preferenceTasks', path: '/settings/preferences/tasks', kind: 'detail', tab: 'account', parent: '/settings/preferences', alternateParents: ['/settings'], swipeMode: 'full', preview: 'none' },
  { id: 'preferenceCalendar', path: '/settings/preferences/calendar', kind: 'detail', tab: 'account', parent: '/settings/preferences', alternateParents: ['/settings'], swipeMode: 'full', preview: 'none' },
  { id: 'preferenceDiary', path: '/settings/preferences/diary', kind: 'detail', tab: 'account', parent: '/settings/preferences', alternateParents: ['/settings'], swipeMode: 'full', preview: 'none' },
  { id: 'preferenceNavigation', path: '/settings/preferences/navigation', kind: 'detail', tab: 'account', parent: '/settings/preferences', alternateParents: ['/settings'], swipeMode: 'full', preview: 'none' },
  { id: 'notificationSettings', path: '/settings/notifications', kind: 'detail', tab: 'account', parent: '/settings', alternateParents: ['/notifications'], swipeMode: 'full', preview: 'supported' },
  { id: 'screenRedirect', path: '/settings/screen', kind: 'redirect', tab: 'account', parent: '/settings', redirectTo: '/settings/preferences', preview: 'none' },
  // Catch mistyped nested Settings URLs inside the guarded shell.
  { id: 'unknownSettingsRedirect', path: '/settings/*', kind: 'redirect', tab: 'account', parent: '/settings', redirectTo: '/settings', preview: 'none' },
  { id: 'profile', path: '/profile', kind: 'detail', tab: 'account', parent: '/settings/account', alternateParents: ['/settings'], swipeMode: 'full', preview: 'supported' },
] as const satisfies readonly ProtectedRoute[];

export type ProtectedRouteEntry = (typeof PROTECTED_ROUTES)[number];
export type ProtectedPageId = Exclude<ProtectedRouteEntry, { kind: 'redirect' }>['id'];

export const PRIMARY_ROUTE_PATHS = PROTECTED_ROUTES
  .filter((route) => route.kind === 'primary')
  .map((route) => route.path);

const routeMatchers = PROTECTED_ROUTES.map((route) => ({
  route,
  pattern: new RegExp('^' + route.path.split('/').map((segment) =>
    segment === '*' ? '.*' : segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^{}()|[\]\\]/g, '\\$&')
  ).join('/') + '$'),
}));

export function matchProtectedRoute(pathname: string): ProtectedRouteEntry | null {
  return routeMatchers.find(({ pattern }) => pattern.test(pathname))?.route ?? null;
}

export function protectedRouteSwipeMode(pathname: string): 'full' | 'home-zone' | 'edge-back' {
  return (matchProtectedRoute(pathname) as ProtectedRoute | null)?.swipeMode ?? 'full';
}

export function protectedRouteHidesBottomNav(pathname: string): boolean {
  return Boolean((matchProtectedRoute(pathname) as ProtectedRoute | null)?.hideBottomNav);
}
