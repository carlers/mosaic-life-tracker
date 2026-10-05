export type PrimarySwipeDirection = 'left' | 'right';

export const ROUTE_PARENT_STATE_KEY = 'parentPath';

export function resolveRouteParent(pathname: string): string | null {
  if (/^\/messages\/[^/]+$/.test(pathname)) {
    return '/messages';
  }

  switch (pathname) {
    case '/settings':
      return '/account';
    case '/profile':
    case '/settings/preferences':
    case '/settings/screen':
      return '/settings';
    default:
      return null;
  }
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

export function resolvePrimarySwipeDestination(
  pathname: string,
  direction: PrimarySwipeDirection
): string | null {
  const parent = resolveRouteParent(pathname);
  if (direction === 'right' && parent) return parent;

  switch (pathname) {
    case '/home':
      return direction === 'left' ? '/explore' : null;
    case '/explore':
      return direction === 'left' ? '/notifications' : '/home';
    case '/notifications':
      return direction === 'left' ? '/messages' : '/explore';
    case '/messages':
      return direction === 'left' ? '/account' : '/notifications';
    case '/account':
      return direction === 'left' ? '/settings' : '/messages';
    default:
      return null;
  }
}
