import { describe, expect, it } from 'vitest';
import { isSocialRoute, soloSwipeDestination } from '../../src/lib/socialMode';

describe('single-user navigation', () => {
  it('blocks all registered social page families and deep links, not core pages', () => {
    for (const path of ['/explore', '/explore/', '/friends/f_1', '/messages',
      '/messages/f_1', '/notifications', '/settings/notifications']) {
      expect(isSocialRoute(path)).toBe(true);
    }
    for (const path of ['/home', '/account', '/backlog', '/bucket-list',
      '/settings', '/settings/preferences', '/profile']) {
      expect(isSocialRoute(path)).toBe(false);
    }
  });
  it('reduces primary swipe targets to Home and Me without trapping settings', () => {
    expect(soloSwipeDestination('/home', 'left', '/explore')).toBe('/account');
    expect(soloSwipeDestination('/home', 'right', null)).toBeNull();
    expect(soloSwipeDestination('/account', 'right', '/messages')).toBe('/home');
    expect(soloSwipeDestination('/account', 'left', '/settings')).toBe('/settings');
    expect(soloSwipeDestination('/settings', 'left', '/notifications')).toBeNull();
    expect(soloSwipeDestination('/settings', 'right', '/account')).toBe('/account');
  });
});
