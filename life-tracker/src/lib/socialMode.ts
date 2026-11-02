/**
 * Remote operator solo mode is a UI/command suppression profile, NOT an
 * authorization boundary. Existing local/remote rows and queues are retained.
 */
export function isSocialRoute(pathname: string): boolean {
  return /^\/(?:explore|friends|messages|notifications)(?:\/|$)/.test(pathname) ||
    /^\/settings\/notifications(?:\/|$)/.test(pathname);
}

export function soloSwipeDestination(
  pathname: string,
  direction: 'left' | 'right',
  ordinary: string | null,
): string | null {
  if (pathname === '/home') return direction === 'left' ? '/account' : null;
  if (pathname === '/account') return direction === 'right' ? '/home' : '/settings';
  return ordinary && isSocialRoute(ordinary) ? null : ordinary;
}
