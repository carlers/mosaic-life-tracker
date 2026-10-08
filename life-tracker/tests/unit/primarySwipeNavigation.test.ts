import { describe, expect, it } from 'vitest';
import {
  resolvePrimarySwipeDestination,
  resolveRouteParent,
} from '../../src/lib/primarySwipeNavigation';

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
    expect(resolvePrimarySwipeDestination('/profile', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings/preferences', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'left')).toBeNull();
    const fromAlerts = { parentPath: '/notifications', fromAlerts: true };
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'right', fromAlerts)).toBe('/notifications');
    expect(resolveRouteParent('/settings/notifications', fromAlerts)).toBe('/notifications');
    expect(resolvePrimarySwipeDestination('/settings/notifications', 'right', { parentPath: '/evil' })).toBe('/settings');
  });
});
