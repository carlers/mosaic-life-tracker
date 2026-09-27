import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Models } from 'appwrite';

// Regression: §23.6 (offline auth gate). The provider must
// hydrate `user` from the persisted last-known identity on a mount-time
// network error, and must clear that cache only on explicit logout or a
// confirmed 401 — never on a network error.

const initializeSyncMock = vi.hoisted(() => vi.fn());
const waitForDatabaseReadyMock = vi.hoisted(() => vi.fn());

const accountRef = vi.hoisted(() => ({
  get: vi.fn(),
  deleteSession: vi.fn(),
  createEmailPasswordSession: vi.fn(),
  create: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('../../src/lib/appwrite', () => ({
  account: accountRef,
  client: {},
}));

vi.mock('../../src/db/sync', () => ({
  initializeSync: initializeSyncMock,
}));
vi.mock('../../src/lib/databaseBootstrap', () => ({
  waitForDatabaseReady: waitForDatabaseReadyMock,
}));

import { AuthProvider } from '../../src/hooks/AuthProvider';
import { useAuth } from '../../src/hooks/useAuth';
import { AUTH_UNAUTHORIZED_EVENT } from '../../src/lib/authEvents';

const LAST_KNOWN_USER_KEY = 'mosaic_last_known_user';

function makeUser(
  overrides: Partial<Models.User<Models.Preferences>> = {}
): Models.User<Models.Preferences> {
  return {
    $id: 'user_1',
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    email: 'user@example.com',
    name: 'User',
    registration: '2026-01-01T00:00:00.000Z',
    status: true,
    prefs: {},
    ...overrides,
  } as Models.User<Models.Preferences>;
}

function makeNetworkError(): Error {
  return new Error('Failed to fetch');
}

function makeUnauthorizedError(): Error {
  const err = new Error('Unauthorized');
  (err as { code?: number }).code = 401;
  return err;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider offline auth gate', () => {
  beforeEach(() => {
    localStorage.clear();
    accountRef.get.mockReset();
    accountRef.deleteSession.mockReset();
    accountRef.createEmailPasswordSession.mockReset();
    accountRef.create.mockReset();
    accountRef.updateEmail.mockReset();
    accountRef.updatePassword.mockReset();
    initializeSyncMock.mockReset();
    initializeSyncMock.mockResolvedValue(undefined);
    waitForDatabaseReadyMock.mockReset();
    waitForDatabaseReadyMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Regression: §19 (successful login triggers sync after auth resolves).
  it('starts sync after login establishes an authenticated session', async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(initializeSyncMock).not.toHaveBeenCalled();

    const fresh = makeUser({ $id: 'user_fresh' });
    accountRef.get.mockResolvedValueOnce(fresh);

    await act(async () => {
      await result.current.login('user@example.com', 'password123');
    });

    await waitFor(() => expect(result.current.user?.$id).toBe('user_fresh'));
    await waitFor(() =>
      expect(initializeSyncMock).toHaveBeenCalledWith('user_fresh')
    );
  });

  it('hydrates cached identity immediately when definitely offline without a session request', async () => {
    const cached = makeUser({
      $id: 'user_cached',
      email: 'cached@example.com',
    });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user?.$id).toBe('user_cached');
    expect(result.current.isOffline).toBe(true);
    await act(async () => Promise.resolve());
    expect(accountRef.get).not.toHaveBeenCalled();
  });

  it('uses the offline unauthenticated state immediately with no cache', async () => {
    localStorage.removeItem(LAST_KNOWN_USER_KEY);
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isOffline).toBe(true);
    await act(async () => Promise.resolve());
    expect(accountRef.get).not.toHaveBeenCalled();
  });

  it('clears the cache and user on mount-time 401', async () => {
    const cached = makeUser({ $id: 'user_cached' });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isOffline).toBe(false);
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
  });

  it('clears the cache on explicit logout()', async () => {
    const cached = makeUser({ $id: 'user_1' });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockResolvedValueOnce(cached);
    accountRef.deleteSession.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.$id).toBe('user_1');
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).not.toBeNull();

    let ok = false;
    await act(async () => {
      ok = await result.current.logout();
    });

    expect(ok).toBe(true);
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
  });

  it('clears the cache on the auth:unauthorized event', async () => {
    const cached = makeUser({ $id: 'user_1' });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockResolvedValueOnce(cached);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
  });

  it('rewrites the cache and clears isOffline on successful retry()', async () => {
    localStorage.removeItem(LAST_KNOWN_USER_KEY);
    accountRef.get.mockRejectedValueOnce(makeNetworkError());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isOffline).toBe(true);
    expect(result.current.user).toBeNull();

    const fresh = makeUser({
      $id: 'user_fresh',
      email: 'fresh@example.com',
    });
    accountRef.get.mockResolvedValueOnce(fresh);

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.user?.$id).toBe('user_fresh');
    expect(result.current.isOffline).toBe(false);
    const cachedRaw = localStorage.getItem(LAST_KNOWN_USER_KEY);
    expect(cachedRaw).not.toBeNull();
    expect(JSON.parse(cachedRaw as string).$id).toBe('user_fresh');
  });
});
