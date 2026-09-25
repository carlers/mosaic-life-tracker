import { describe, expect, it } from 'vitest';
import { getPrimaryRoutePreloadTargets } from '../../src/components/layout/primaryRoutePreload';

// Regression: PROJECT_REFERENCE.md §2 — idle preloading warms both reachable
// directions without mounting hidden route trees.
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
