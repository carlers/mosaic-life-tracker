import { describe, expect, it } from 'vitest';
import { resolvePrimarySwipeDestination } from '../../src/lib/primarySwipeNavigation';

describe('settings child swipe navigation', () => {
  // Regression: task acceptance — Settings child pages are right-swipe-only details.
  it('returns Settings from Profile and Screen on a right swipe', () => {
    expect(resolvePrimarySwipeDestination('/profile', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings/screen', 'right')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/profile', 'left')).toBeNull();
    expect(resolvePrimarySwipeDestination('/settings/screen', 'left')).toBeNull();
  });

  it('preserves Settings as the right-swipe detail edge of Me', () => {
    expect(resolvePrimarySwipeDestination('/account', 'left')).toBe('/settings');
    expect(resolvePrimarySwipeDestination('/settings', 'right')).toBe('/account');
    expect(resolvePrimarySwipeDestination('/settings', 'left')).toBeNull();
  });
});
