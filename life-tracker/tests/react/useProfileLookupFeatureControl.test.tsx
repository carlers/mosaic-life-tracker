import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: false,
  searchProfiles: vi.fn(),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'friend-seeker' } }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: 'online' }),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => mocks.enabled,
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: () => mocks.enabled,
}));
vi.mock('../../src/lib/social', () => ({
  searchProfiles: mocks.searchProfiles,
}));
import { useProfileLookup } from '../../src/hooks/useProfileLookup';

describe('Friend discovery operator control', () => {
  beforeEach(() => {
    mocks.enabled = false;
    mocks.searchProfiles.mockReset().mockResolvedValue([]);
  });

  it('rejects search input while disabled and does not initiate a lookup', () => {
    const { result } = renderHook(() => useProfileLookup(0));
    act(() => result.current.setQuery('alex'));
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(mocks.searchProfiles).not.toHaveBeenCalled();
  });

  it('masks query and search state immediately when remotely disabled', () => {
    mocks.enabled = true;
    const { result, rerender } = renderHook(() => useProfileLookup(10000));
    act(() => result.current.setQuery('alex'));
    expect(result.current.query).toBe('alex');
    mocks.enabled = false;
    rerender();
    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(mocks.searchProfiles).not.toHaveBeenCalled();
  });
});
