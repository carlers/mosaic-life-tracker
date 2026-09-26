import { describe, expect, it } from 'vitest';
import { getPrimaryRoutePreloadTargets } from '../../src/components/layout/primaryRoutePreload';

// Regression: §2 (idle preloading warms neighbors without mounting hidden routes).
describe('primary route preload targets', () => {
  it('returns both reachable neighbors in deterministic left/right order', () => {
    expect(getPrimaryRoutePreloadTargets('/explore')).toEqual([
      '/notifications',
      '/home',
    ]);
    expect(getPrimaryRoutePreloadTargets('/account')).toEqual([
      '/settings',
      '/messages',
    ]);
    expect(getPrimaryRoutePreloadTargets('/home')).toEqual(['/explore']);
    expect(getPrimaryRoutePreloadTargets('/settings')).toEqual(['/account']);
  });
});
