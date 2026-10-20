import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Models } from 'appwrite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountRef = vi.hoisted(() => ({
  get: vi.fn(), deleteSession: vi.fn(), createEmailPasswordSession: vi.fn(),
  create: vi.fn(), updateEmail: vi.fn(), updatePassword: vi.fn(),
}));
const effects = vi.hoisted(() => ({
  initializeSync: vi.fn(), suspendSyncOwner: vi.fn(),
  waitForDatabaseReady: vi.fn(),
  scopeSharedTaskQueue: vi.fn(), flushSharedMemberships: vi.fn(),
  flushSharedCompletions: vi.fn(), setPushActiveUser: vi.fn(),
}));
vi.mock('../../src/lib/backendCapabilities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/backendCapabilities')>();
  return {
    ...actual,
    MOSAIC_FEATURE_PROFILE: 'core-only',
    hasCapability: (capability: Parameters<typeof actual.hasCapability>[0]) =>
      actual.hasCapability(capability, 'core-only'),
  };
});
vi.mock('../../src/lib/appwrite', () => ({ account: accountRef, client: {} }));
vi.mock('../../src/lib/databaseBootstrap', () => ({
  waitForDatabaseReady: effects.waitForDatabaseReady,
}));
vi.mock('../../src/db/sync', () => ({
  initializeSync: effects.initializeSync, suspendSyncOwner: effects.suspendSyncOwner,
}));
vi.mock('../../src/lib/taskShareQueue', () => ({
  scopeSharedTaskQueue: effects.scopeSharedTaskQueue,
  flushSharedMemberships: effects.flushSharedMemberships,
  flushSharedCompletions: effects.flushSharedCompletions,
}));
vi.mock('../../src/lib/pushNotifications', () => ({
  setPushActiveUser: effects.setPushActiveUser,
}));

import { AuthProvider } from '../../src/hooks/AuthProvider';
import { useAuth } from '../../src/hooks/useAuth';
import { resetConnectivityForTests } from '../../src/lib/connectivity';

const LAST_KNOWN_USER_KEY = 'mosaic_last_known_user';
function makeUser(): Models.User<Models.Preferences> {
  return {
    $id: 'owner_core', $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    email: 'owner@example.test', name: 'Owner',
    registration: '2026-01-01T00:00:00.000Z',
    status: true, prefs: {},
  } as Models.User<Models.Preferences>;
}
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('core-only AuthProvider disabled backend effects (#1027)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(makeUser()));
    accountRef.get.mockResolvedValue(makeUser());
    effects.waitForDatabaseReady.mockResolvedValue(undefined);
    effects.initializeSync.mockResolvedValue(undefined);
    effects.suspendSyncOwner.mockResolvedValue(undefined);
    effects.setPushActiveUser.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    resetConnectivityForTests({
      status: 'online', reason: 'test-core-only',
      lastConfirmedAt: Date.now(),
    });
  });

  it('keeps local owner but never starts shared queue, push registration or eight-domain Appwrite sync while online', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe('owner_core'));
    await act(async () => { await Promise.resolve(); });
    expect(effects.scopeSharedTaskQueue).not.toHaveBeenCalled();
    expect(effects.flushSharedMemberships).not.toHaveBeenCalled();
    expect(effects.flushSharedCompletions).not.toHaveBeenCalled();
    expect(effects.setPushActiveUser).not.toHaveBeenCalled();
    expect(effects.waitForDatabaseReady).not.toHaveBeenCalled();
    expect(effects.initializeSync).not.toHaveBeenCalled();
  });

  it('does not hydrate background share/push workers even from cached offline identity', async () => {
    resetConnectivityForTests({
      status: 'offline', reason: 'test-core-offline', lastConfirmedAt: null,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user?.$id).toBe('owner_core');
    await act(async () => { await Promise.resolve(); });
    expect(effects.scopeSharedTaskQueue).not.toHaveBeenCalled();
    expect(effects.flushSharedMemberships).not.toHaveBeenCalled();
    expect(effects.setPushActiveUser).not.toHaveBeenCalled();
    expect(effects.initializeSync).not.toHaveBeenCalled();
  });
});
