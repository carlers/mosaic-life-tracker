import { describe, expect, it } from 'vitest';
import {
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

  it('shortens settle time for faster releases and disables motion when requested', () => {
    expect(resolveRouteSwipeSettleDuration(400, 80, 0.2, false)).toBe(180);
    expect(resolveRouteSwipeSettleDuration(400, 80, 3.2, false)).toBe(100);
    expect(resolveRouteSwipeSettleDuration(400, 80, 0.2, true)).toBe(0);
  });
});
