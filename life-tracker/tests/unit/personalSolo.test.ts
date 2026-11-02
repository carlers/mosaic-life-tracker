import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPersonalSoloMode, setPersonalSoloMode, subscribePersonalSolo } from '../../src/lib/personalSolo';
import { __resetAccountWorkScopeForTests, scopeAccountWork } from '../../src/lib/accountWorkScope';
import { isFeatureEnabled } from '../../src/lib/featureControls';
const mocks = vi.hoisted(() => ({ disabled: false }));
vi.mock('../../src/lib/posthog', () => ({
  getPostHogFeatureFlagState: () => ({ enabled: mocks.disabled, isLoaded: true, hasError: false }),
}));
let rows: Map<string, string>;
beforeEach(() => {
  rows = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => { rows.set(key, value); },
    removeItem: (key: string) => { rows.delete(key); },
  });
  __resetAccountWorkScopeForTests();
  mocks.disabled = false;
});
afterEach(() => { __resetAccountWorkScopeForTests(); vi.unstubAllGlobals(); });
describe('owner scoped single-user mode', () => {
  it('does not affect other accounts or delete saved choice', () => {
    scopeAccountWork('owner-a');
    expect(isFeatureEnabled('mosaic_disable_all_social')).toBe(true);
    setPersonalSoloMode('owner-a', true);
    expect(isFeatureEnabled('mosaic_disable_all_social')).toBe(false);
    scopeAccountWork('owner-b');
    expect(isFeatureEnabled('mosaic_disable_all_social')).toBe(true);
    expect(getPersonalSoloMode('owner-a')).toBe(true);
    setPersonalSoloMode('owner-a', false);
    scopeAccountWork('owner-a');
    expect(isFeatureEnabled('mosaic_disable_all_social')).toBe(true);
  });
  it('only notifies on changes and respects independent operator kill switch', () => {
    const cb = vi.fn();
    const stop = subscribePersonalSolo(cb);
    scopeAccountWork('owner-c');
    setPersonalSoloMode('owner-c', true);
    setPersonalSoloMode('owner-c', true);
    expect(cb).toHaveBeenCalledTimes(1);
    setPersonalSoloMode('owner-c', false);
    expect(cb).toHaveBeenCalledTimes(2);
    mocks.disabled = true;
    expect(isFeatureEnabled('mosaic_disable_all_social')).toBe(false);
    stop();
  });
});
