import { matchProtectedRoute, PRIMARY_ROUTE_PATHS } from './protectedRoutes';

export type PrimarySwipeDirection = 'left' | 'right';
export const ROUTE_PARENT_STATE_KEY = 'parentPath';

export function resolveRouteParent(pathname: string, state?: unknown): string | null {
  const route = matchProtectedRoute(pathname);
  if (!route || !('parent' in route)) return null;
  if ('alternateParents' in route && route.alternateParents) {
    const origin = state && typeof state === 'object' &&
      ROUTE_PARENT_STATE_KEY in state
      ? (state as Record<string, unknown>)[ROUTE_PARENT_STATE_KEY]
      : null;
    if (route.alternateParents.some((allowed) => allowed === origin)) {
      return origin as string;
    }
  }
  return route.parent;
}

export function hasExpectedRouteParent(
  locationKey: string,
  state: unknown,
  parentPath: string
): boolean {
  if (locationKey === 'default' || !state || typeof state !== 'object') {
    return false;
  }
  return (
    ROUTE_PARENT_STATE_KEY in state &&
    (state as Record<string, unknown>)[ROUTE_PARENT_STATE_KEY] === parentPath
  );
}

export function makeRouteParentState(parentPath: string) {
  return { [ROUTE_PARENT_STATE_KEY]: parentPath };
}

/**
 * Offer a child-return swipe only after a one-entry browser/Android Back
 * from a Settings child to Settings. Never guess at the browser's forward URL.
 */
export function resolveSettingsHistoryForward(
  previous: { pathname: string; parent: string | null; index: number | null },
  current: { pathname: string; index: number | null },
  navigationType: 'PUSH' | 'REPLACE' | 'POP'
): string | null {
  if (navigationType !== 'POP' || current.pathname !== '/settings' ||
    previous.parent !== '/settings' ||
    previous.index === null || current.index === null ||
    previous.index !== current.index + 1) return null;

  const route = matchProtectedRoute(previous.pathname);
  return route?.kind === 'detail' ? previous.pathname : null;
}

export function resolvePrimarySwipeDestination(
  pathname: string,
  direction: PrimarySwipeDirection,
  state?: unknown
): string | null {
  const parent = resolveRouteParent(pathname, state);
  if (direction === 'right' && parent) return parent;

  const route = matchProtectedRoute(pathname);
  if (!route || route.kind !== 'primary') return null;
  const index = PRIMARY_ROUTE_PATHS.indexOf(route.path);
  if (direction === 'right') return PRIMARY_ROUTE_PATHS[index - 1] ?? null;
  return PRIMARY_ROUTE_PATHS[index + 1] ??
    ('extraLeft' in route ? route.extraLeft : null) ?? null;
}
