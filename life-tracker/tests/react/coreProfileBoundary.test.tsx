import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMyProfile } from '../../src/hooks/useMyProfile';

const social = vi.hoisted(() => ({
  fetchMyProfile: vi.fn(), createOrUpdateProfile: vi.fn(), isUsernameAvailable: vi.fn(),
}));
vi.mock('../../src/lib/social', () => social);
vi.mock('../../src/lib/backendCapabilities', () => ({ hasCapability: () => false }));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'core_owner' }, isOffline: false }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: 'online' }),
}));
afterEach(cleanup);

describe('core profile capability boundary', () => {
  it('never reads or writes an Appwrite social profile, including explicit retries', async () => {
    const { result } = renderHook(() => useMyProfile());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toBeNull();
    await act(() => result.current.refetch());
    await expect(result.current.checkUsername('test_handle')).resolves.toBeNull();
    await expect(result.current.createProfile({ username: 'test_handle', displayName: 'Test' }))
      .rejects.toThrow('unavailable');
    expect(social.fetchMyProfile).not.toHaveBeenCalled();
    expect(social.createOrUpdateProfile).not.toHaveBeenCalled();
    expect(social.isUsernameAvailable).not.toHaveBeenCalled();
  });
});
