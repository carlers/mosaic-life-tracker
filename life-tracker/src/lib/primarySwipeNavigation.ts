export type PrimarySwipeDirection = 'left' | 'right';

export function resolvePrimarySwipeDestination(
  pathname: string,
  direction: PrimarySwipeDirection
): string | null {
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
