// Regression: §24.15 (PostHog identity follows resolved auth state only).
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Models } from 'appwrite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountRef = vi.hoisted(() => ({
  get: vi.fn(),
  deleteSession: vi.fn(),
  createEmailPasswordSession: vi.fn(),
  create: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
}));

const posthogRef = vi.hoisted(() => ({
  syncPostHogIdentity: vi.fn(),
}));

const initializeSyncMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/appwrite', () => ({
  account: accountRef,
  client: {},
}));

vi.mock('../../src/lib/posthog', () => posthogRef);

vi.mock('../../src/db/sync', () => ({
  initializeSync: initializeSyncMock,
}));

import { AuthProvider } from '../../src/hooks/AuthProvider';
import { useAuth } from '../../src/hooks/useAuth';

const LAST_KNOWN_USER_KEY = 'mosaic_last_known_user';

function makeUser(
  overrides: Partial<Models.User<Models.Preferences>> = {}
): Models.User<Models.Preferences> {
  return {
    $id: 'user_1',
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    email: 'private@example.com',
    name: 'Private Name',
    registration: '2026-01-01T00:00:00.000Z',
    status: true,
    prefs: { private: 'value' },
    ...overrides,
  } as Models.User<Models.Preferences>;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider PostHog identity integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    initializeSyncMock.mockResolvedValue(undefined);
  });

  it('identifies resolved authenticated state using only the Appwrite user id', async () => {
    accountRef.get.mockResolvedValueOnce(makeUser());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(posthogRef.syncPostHogIdentity).toHaveBeenLastCalledWith('user_1');
    expect(accountRef.get).toHaveBeenCalledTimes(1);
  });

  it('uses the cached OFF-1 identity after a mount-time network failure', async () => {
    localStorage.setItem(
      LAST_KNOWN_USER_KEY,
      JSON.stringify(makeUser({ $id: 'user_cached' }))
    );
    accountRef.get.mockRejectedValueOnce(new Error('Failed to fetch'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user?.$id).toBe('user_cached');
    expect(posthogRef.syncPostHogIdentity).toHaveBeenLastCalledWith('user_cached');
    expect(posthogRef.syncPostHogIdentity).not.toHaveBeenCalledWith(null);
  });

  it('resets identity after successful logout', async () => {
    accountRef.get.mockResolvedValueOnce(makeUser());
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(posthogRef.syncPostHogIdentity).toHaveBeenLastCalledWith(null);
  });

  it('does not reset identity when a retry fails because the network is offline', async () => {
    accountRef.get
      .mockResolvedValueOnce(makeUser())
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    posthogRef.syncPostHogIdentity.mockClear();
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.user?.$id).toBe('user_1');
    expect(posthogRef.syncPostHogIdentity).not.toHaveBeenCalledWith(null);
    expect(posthogRef.syncPostHogIdentity).not.toHaveBeenCalled();
  });
});
