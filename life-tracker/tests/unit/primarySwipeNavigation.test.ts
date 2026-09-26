import { describe, expect, it } from 'vitest';
import { resolvePrimarySwipeDestination } from '../../src/lib/primarySwipeNavigation';

describe('resolvePrimarySwipeDestination', () => {
  // Regression: PROJECT_REFERENCE.md §2 — Home → Explore → Alerts → Chat → Me, then Me left → Settings.
  it('maps the primary sequence and the corrected Me swipe directions', () => {
    expect(resolvePrimarySwipeDestination('/home', 'left')).toBe('/explore');
    expect(resolvePrimarySwipeDestination('/explore', 'right')).toBe('/home');
    expect(resolvePrimarySwipeDestination('/explore', 'left')).toBe('/notifications');
    expect(resolvePrimarySwipeDestination('/notifications', 'left')).toBe('/messages');
    expect(resolvePrimarySwipeDestination('/messages', 'left')).toBe('/account');
    expect(resolvePrimarySwipeDestination('/account', 'left')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/account', 'right')).toBe('/messages');
  });

  it('keeps Settings as the Me detail edge and excludes individual chats', () => {
    expect(resolvePrimarySwipeDestination('/settings', 'right')).toBe('/account');
    expect(resolvePrimarySwipeDestination('/settings', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/messages/friend_1', 'left')).toBeNull();
  });

  // Regression: PROJECT_REFERENCE.md §2 — Settings child pages are right-swipe-only details.
  it('returns Settings from Profile and Preferences on a right swipe', () => {
    expect(resolvePrimarySwipeDestination('/profile', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings/preferences', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/profile', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings/preferences', 'left')).toBeNull();
  });
});
