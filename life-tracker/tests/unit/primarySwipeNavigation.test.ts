import { describe, expect, it } from 'vitest';
import { resolvePrimarySwipeDestination } from '../../src/lib/primarySwipeNavigation';

describe('resolvePrimarySwipeDestination', () => {
  // Regression: PROJECT_REFERENCE.md §2 — Home → Explore → Alerts → Chat → Me.
  it('maps the primary tab sequence and the Me right-swipe Settings override', () => {
    expect(resolvePrimarySwipeDestination('/home', 'left')).toBe('/explore');
    expect(resolvePrimarySwipeDestination('/explore', 'right')).toBe('/home');
    expect(resolvePrimarySwipeDestination('/explore', 'left')).toBe('/notifications');
    expect(resolvePrimarySwipeDestination('/notifications', 'left')).toBe('/messages');
    expect(resolvePrimarySwipeDestination('/messages', 'left')).toBe('/account');
    expect(resolvePrimarySwipeDestination('/account', 'right')).toBe('/settings');
  });

  it('does not route-swipe individual chats or secondary account pages', () => {
    expect(resolvePrimarySwipeDestination('/messages/friend_1', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings', 'right')).toBeNull();
    expect(resolvePrimarySwipeDestination('/profile', 'left')).toBeNull();
  });
});
