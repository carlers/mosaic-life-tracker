import { describe, expect, it } from 'vitest';
import {
  recentRouteSwipeVelocity,
  resolveRouteSwipeSettleDuration,
  shouldCommitRouteSwipe,
} from '../../src/components/layout/routeSwipeMotion';

describe('route swipe motion', () => {
  it('commits by distance or a short intentional flick, but not reverse velocity', () => {
    expect(shouldCommitRouteSwipe(70, 64, 0)).toBe(true);
    expect(shouldCommitRouteSwipe(40, 64, 0.7)).toBe(true);
    expect(shouldCommitRouteSwipe(20, 64, 1.2)).toBe(false);
    expect(shouldCommitRouteSwipe(40, 64, -0.8)).toBe(false);
  });

  it('uses recent pointer movement rather than diluting a final flick with a long hold', () => {
    expect(recentRouteSwipeVelocity([
      { x: 0, time: 0 }, { x: 70, time: 800 }, { x: 120, time: 830 },
    ])).toBeCloseTo(50 / 30);
    expect(recentRouteSwipeVelocity([
      { x: 0, time: 0 }, { x: 100, time: 800 }, { x: 100, time: 950 },
    ])).toBe(0);
    expect(recentRouteSwipeVelocity([
      { x: 100, time: 0 }, { x: 85, time: 20 }, { x: 65, time: 40 },
    ])).toBeLessThan(0);
  });

  it('shortens settle time for faster releases and disables motion when requested', () => {
    expect(resolveRouteSwipeSettleDuration(400, 80, 0.2, false)).toBe(180);
    expect(resolveRouteSwipeSettleDuration(400, 80, 3.2, false)).toBe(100);
    expect(resolveRouteSwipeSettleDuration(400, 80, 0.2, true)).toBe(0);
  });
});
