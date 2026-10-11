import { describe, expect, it } from 'vitest';
import {
  resolvePrimarySwipeDestination,
  resolveRouteParent,
} from '../../src/lib/primarySwipeNavigation';
import { PROTECTED_ROUTES, PRIMARY_ROUTE_PATHS, matchProtectedRoute, protectedRouteSwipeMode, protectedRouteHidesBottomNav } from '../../src/lib/protectedRoutes';

describe('resolvePrimarySwipeDestination', () => {
  // Regression: §2 (primary route order and Me → Settings swipe).
  it('maps the primary sequence and the corrected Me swipe directions', () => {
    expect(resolvePrimarySwipeDestination('/home', 'left')).toBe('/explore');
    expect(resolvePrimarySwipeDestination('/explore', 'right')).toBe('/home');
    expect(resolvePrimarySwipeDestination('/explore', 'left')).toBe('/notifications');
    expect(resolvePrimarySwipeDestination('/notifications', 'left')).toBe('/messages');
    expect(resolvePrimarySwipeDestination('/messages', 'left')).toBe('/account');
    expect(resolvePrimarySwipeDestination('/account', 'left')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/account', 'right')).toBe('/messages');
  });

  it('keeps Settings as the Me detail edge and maps social detail parents', () => {
    expect(resolvePrimarySwipeDestination('/settings', 'right')).toBe('/account');
    expect(resolvePrimarySwipeDestination('/settings', 'left')).toBeNull();
    expect(resolveRouteParent('/messages/friend_1')).toBe('/messages');
    expect(resolvePrimarySwipeDestination('/messages/friend_1', 'right')).toBe('/messages');
    expect(resolvePrimarySwipeDestination('/messages/friend_1', 'left')).toBeNull();
    expect(resolveRouteParent('/friends/friend_1')).toBe('/explore');
    expect(resolvePrimarySwipeDestination('/friends/friend_1', 'right')).toBe('/explore');
    expect(resolvePrimarySwipeDestination('/friends/friend_1', 'left')).toBeNull();
  });

  // Regression: §2 (Settings child pages are right-swipe detail routes).
  it('returns Settings from Profile and Preferences on a right swipe', () => {
    expect(resolvePrimarySwipeDestination('/profile', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings/preferences', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings/releases', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/profile', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings/preferences', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'left')).toBeNull();
    const fromAlerts = { parentPath: '/notifications', fromAlerts: true };
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'right', fromAlerts)).toBe('/notifications');
    expect(resolveRouteParent('/settings/notifications', fromAlerts)).toBe('/notifications');
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'right', { parentPath: '/evil' })).toBe('/settings');
  });
  it('derives page layout and swipe defaults from the same protected-route entries', () => {
    expect(PROTECTED_ROUTES.map((route) => route.path)).toEqual([
      '/home', '/backlog', '/explore', '/friends/:friendId', '/notifications',
      '/messages', '/messages/:friendId', '/account', '/settings',
      '/settings/releases', '/settings/preferences', '/settings/notifications', '/settings/screen', '/profile',
    ]);
    expect(new Set(PROTECTED_ROUTES.map((route) => route.path)).size).toBe(PROTECTED_ROUTES.length);
    expect(PRIMARY_ROUTE_PATHS).toEqual([
      '/home', '/explore', '/notifications', '/messages', '/account',
    ]);
    expect(matchProtectedRoute('/backlog')?.id).toBe('backlog');
    expect(resolvePrimarySwipeDestination('/backlog', 'right', { parentPath: '/account' })).toBe('/account');
    expect(resolvePrimarySwipeDestination('/backlog', 'right')).toBe('/home');
    expect(matchProtectedRoute('/messages/user_1')?.id).toBe('chat');
    expect(matchProtectedRoute('/friends/friend_1')?.id).toBe('friendCalendar');
    expect(matchProtectedRoute('/friends/')?.id).toBeUndefined();
    expect(matchProtectedRoute('/settings/preferences')?.id).toBe('preferences');
    expect(matchProtectedRoute('/settings/notifications')?.id).toBe('notificationSettings');
    expect(matchProtectedRoute('/login')).toBeNull();
    expect(protectedRouteSwipeMode('/messages/user_1')).toBe('edge-back');
    expect(protectedRouteSwipeMode('/friends/friend_1')).toBe('edge-back');
    expect(protectedRouteSwipeMode('/settings/preferences')).toBe('full');
    expect(protectedRouteSwipeMode('/home')).toBe('home-zone');
    expect(protectedRouteHidesBottomNav('/messages/user_1')).toBe(true);
    expect(protectedRouteHidesBottomNav('/friends/friend_1')).toBe(false);
    expect(protectedRouteHidesBottomNav('/profile')).toBe(false);
  });

  it('requires a declared route parent for every protected detail and redirect', () => {
    for (const route of PROTECTED_ROUTES) {
      if (route.kind !== 'primary') {
        expect(route.parent).toMatch(/^\//);
        expect(matchProtectedRoute(route.parent)).not.toBeNull();
      }
    }
    expect(resolveRouteParent('/messages/friend_1')).toBe('/messages');
    expect(resolveRouteParent('/friends/friend_1')).toBe('/explore');
    expect(resolveRouteParent('/settings/screen')).toBe('/settings');
    expect(resolveRouteParent('/settings/notifications', { parentPath: '/notifications' }))
      .toBe('/notifications');
    expect(resolveRouteParent('/settings/notifications', { parentPath: '/untrusted' }))
      .toBe('/settings');
  });

});
