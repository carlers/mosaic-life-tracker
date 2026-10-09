import { matchProtectedRoute } from './protectedRoutes';

export type RouteTransitionDirection = 'forward' | 'backward' | 'none';
export type RouteNavigationType = 'PUSH' | 'REPLACE' | 'POP';

const PRIMARY_ORDER = ['/home', '/explore', '/notifications', '/messages', '/account'];
const primaryIndex = (pathname: string) => {
  const tab = matchProtectedRoute(pathname)?.tab;
  return PRIMARY_ORDER.indexOf(tab ? '/' + tab : pathname);
};

function isAncestor(parent: string, child: string): boolean {
  let route = matchProtectedRoute(child);
  const seen = new Set<string>();
  while (route && route.kind === 'detail' && !seen.has(route.path)) {
    seen.add(route.path);
    const parents: readonly string[] = [route.parent, ...('alternateParents' in route ? route.alternateParents ?? [] : [])];
    if (parents.includes(parent)) return true;
    route = matchProtectedRoute(route.parent);
  }
  return false;
}

export function resolveRouteTransition(
  from: string | null,
  to: string,
  navigationType: RouteNavigationType,
  historyDelta: number | null,
  explicitBack = false
): RouteTransitionDirection {
  if (!from || from === to || !matchProtectedRoute(to) || !matchProtectedRoute(from)) return 'none';
  if (explicitBack) return 'backward';
  if (navigationType === 'POP' && historyDelta !== null && historyDelta !== 0) {
    return historyDelta < 0 ? 'backward' : 'forward';
  }
  if (isAncestor(from, to)) return 'forward';
  if (isAncestor(to, from)) return 'backward';
  const start = primaryIndex(from);
  const end = primaryIndex(to);
  if (start >= 0 && end >= 0 && start !== end) {
    return end > start ? 'forward' : 'backward';
  }
  return navigationType === 'POP' ? 'backward' : navigationType === 'REPLACE' ? 'none' : 'forward';
}

export function readRouterHistoryIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object' || !('idx' in state)) return null;
  const value = (state as { idx?: unknown }).idx;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
