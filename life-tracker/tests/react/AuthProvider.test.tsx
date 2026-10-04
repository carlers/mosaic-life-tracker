import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Models } from "appwrite";

// Regression: §23.6 (offline auth gate). The provider must
// hydrate `user` from the persisted last-known identity on a mount-time
// network error, and must clear that cache only on explicit logout or a
// confirmed 401 — never on a network error.

const initializeSyncMock = vi.hoisted(() => vi.fn());
const suspendSyncOwnerMock = vi.hoisted(() => vi.fn());
const waitForDatabaseReadyMock = vi.hoisted(() => vi.fn());
const fetchMyProfileMock = vi.hoisted(() => vi.fn());
const createOrUpdateProfileMock = vi.hoisted(() => vi.fn());
const writeCachedOwnProfileMock = vi.hoisted(() => vi.fn());
const requestAccountDeletionMock = vi.hoisted(() => vi.fn());
const clearDeletedAccountLocalDataMock = vi.hoisted(() => vi.fn());

const accountRef = vi.hoisted(() => ({
  get: vi.fn(),
  deleteSession: vi.fn(),
  createEmailPasswordSession: vi.fn(),
  create: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
  createRecovery: vi.fn(),
  updateRecovery: vi.fn(),
}));

vi.mock("../../src/lib/appwrite", () => ({
  account: accountRef,
  client: {},
}));

vi.mock("../../src/db/sync", () => ({
  initializeSync: initializeSyncMock,
  suspendSyncOwner: suspendSyncOwnerMock,
}));
vi.mock("../../src/lib/databaseBootstrap", () => ({
  waitForDatabaseReady: waitForDatabaseReadyMock,
}));
vi.mock("../../src/lib/social", () => ({
  fetchMyProfile: fetchMyProfileMock,
  createOrUpdateProfile: createOrUpdateProfileMock,
}));
vi.mock("../../src/lib/profileCache", () => ({
  writeCachedOwnProfile: writeCachedOwnProfileMock,
}));
vi.mock("../../src/lib/accountDeletion", () => ({
  requestAccountDeletion: requestAccountDeletionMock,
}));
vi.mock("../../src/lib/accountDeletionLocal", () => ({
  clearDeletedAccountLocalData: clearDeletedAccountLocalDataMock,
}));

import { AuthProvider } from "../../src/hooks/AuthProvider";
import { useAuth } from "../../src/hooks/useAuth";
import { AUTH_UNAUTHORIZED_EVENT } from "../../src/lib/authEvents";
import {
  getConnectivitySnapshot,
  resetConnectivityForTests,
} from "../../src/lib/connectivity";

const LAST_KNOWN_USER_KEY = "mosaic_last_known_user";
const ACCOUNT_DELETION_INTENT_KEY = "mosaic_account_deletion_intent_v1";

function makeUser(
  overrides: Partial<Models.User<Models.Preferences>> = {},
): Models.User<Models.Preferences> {
  return {
    $id: "user_1",
    $createdAt: "2026-01-01T00:00:00.000Z",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    email: "user@example.com",
    name: "User",
    registration: "2026-01-01T00:00:00.000Z",
    status: true,
    prefs: {},
    ...overrides,
  } as Models.User<Models.Preferences>;
}

function makeNetworkError(): Error {
  return new Error("Failed to fetch");
}

function makeUnauthorizedError(): Error {
  const err = new Error("Unauthorized");
  (err as { code?: number }).code = 401;
  return err;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthProvider offline auth gate", () => {
  beforeEach(() => {
    localStorage.clear();
    accountRef.get.mockReset();
    accountRef.deleteSession.mockReset();
    accountRef.createEmailPasswordSession.mockReset();
    accountRef.create.mockReset();
    accountRef.updateEmail.mockReset();
    accountRef.updatePassword.mockReset();
    accountRef.createRecovery.mockReset();
    accountRef.updateRecovery.mockReset();
    initializeSyncMock.mockReset();
    initializeSyncMock.mockResolvedValue(undefined);
    suspendSyncOwnerMock.mockReset();
    suspendSyncOwnerMock.mockResolvedValue(undefined);
    waitForDatabaseReadyMock.mockReset();
    waitForDatabaseReadyMock.mockResolvedValue(undefined);
    fetchMyProfileMock.mockReset();
    fetchMyProfileMock.mockImplementation(async (userId: string) => ({
      $id: `profile_${userId}`,
      user_id: userId,
      username: 'existing_user',
      display_name: 'Existing User',
      avatar_file_id: '',
      bio: '',
      is_searchable: true,
    }));
    createOrUpdateProfileMock.mockReset();
    createOrUpdateProfileMock.mockImplementation(async (input) => ({
      $id: `profile_${input.userId}`,
      user_id: input.userId,
      username: input.username,
      display_name: input.displayName,
      avatar_file_id: input.avatarFileId || '',
      bio: input.bio || '',
      is_searchable: true,
    }));
    writeCachedOwnProfileMock.mockReset();
    requestAccountDeletionMock.mockReset().mockResolvedValue({
      accepted: true,
      deletionPending: true,
    });
    clearDeletedAccountLocalDataMock.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    resetConnectivityForTests({
      status: "checking",
      reason: "test-startup",
      lastConfirmedAt: null,
    });
    accountRef.get.mockRejectedValue(makeUnauthorizedError());
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("requests and completes password recovery through Appwrite", async () => {
    accountRef.createRecovery.mockResolvedValue({});
    accountRef.updateRecovery.mockResolvedValue({});
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      expect(
        await result.current.requestPasswordRecovery("user@example.com"),
      ).toBe(true);
    });
    expect(accountRef.createRecovery).toHaveBeenCalledWith(
      "user@example.com",
      `${window.location.origin}/reset-password`,
    );
    expect(result.current.recoverySuccess).toBe("requested");

    await act(async () => {
      expect(
        await result.current.completePasswordRecovery(
          "user-id",
          "secret",
          "password123",
        ),
      ).toBe(true);
    });
    expect(accountRef.updateRecovery).toHaveBeenCalledWith(
      "user-id",
      "secret",
      "password123",
    );
    expect(result.current.recoverySuccess).toBe("completed");
  });

  it("exposes recovery failures and ignores stale async results", async () => {
    let resolveFirst!: () => void;
    accountRef.createRecovery
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error("Recovery unavailable"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.requestPasswordRecovery("first@example.com");
      await result.current.requestPasswordRecovery("second@example.com");
    });
    expect(result.current.recoveryError).toBe("Recovery unavailable");
    await act(async () => {
      resolveFirst();
      await first;
    });
    expect(result.current.recoveryError).toBe("Recovery unavailable");
    expect(result.current.recoverySuccess).toBeNull();
  });

  it("does not update recovery state after unmount", async () => {
    let resolve!: () => void;
    accountRef.createRecovery.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.requestPasswordRecovery("user@example.com");
    });
    unmount();
    await act(async () => {
      resolve();
      expect(await pending).toBe(false);
    });
  });

  it("creates the username profile before publishing a newly signed-up user", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const fresh = makeUser({
      $id: "user_signup",
      email: "new@example.com",
      name: "New User",
    });
    accountRef.create.mockResolvedValueOnce(fresh);
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);
    accountRef.get.mockResolvedValueOnce(fresh);
    fetchMyProfileMock.mockResolvedValueOnce(null);

    let ok = false;
    await act(async () => {
      ok = await result.current.signup(
        "new@example.com",
        "test-pass-123",
        "New User",
        "New_User",
      );
    });

    expect(ok).toBe(true);
    expect(createOrUpdateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_signup",
        username: "new_user",
        displayName: "New User",
      }),
      { queueOnTransient: false },
    );
    expect(writeCachedOwnProfileMock).toHaveBeenCalled();
    expect(result.current.user?.$id).toBe("user_signup");
    expect(result.current.pendingSignup).toBeNull();
    await waitFor(() =>
      expect(initializeSyncMock).toHaveBeenCalledWith("user_signup"),
    );
  });

  it("keeps username collisions in resumable signup instead of publishing a half-onboarded user", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const fresh = makeUser({
      $id: "user_collision",
      email: "collision@example.com",
      name: "Collision User",
    });
    accountRef.create.mockResolvedValueOnce(fresh);
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);
    accountRef.get.mockResolvedValueOnce(fresh);
    fetchMyProfileMock.mockResolvedValueOnce(null);
    createOrUpdateProfileMock.mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), { code: 409 }),
    );

    await act(async () => {
      expect(
        await result.current.signup(
          "collision@example.com",
          "test-pass-123",
          "Collision User",
          "claimed_name",
        ),
      ).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.pendingSignup).toEqual({
      email: "collision@example.com",
      name: "Collision User",
    });
    expect(result.current.error).toBe("That username is already taken.");
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
    expect(initializeSyncMock).not.toHaveBeenCalled();
  });

  it("resumes signup when account creation already succeeded on an earlier attempt", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const existing = makeUser({
      $id: "user_resume",
      email: "resume@example.com",
      name: "Resume User",
    });
    accountRef.create.mockRejectedValueOnce(
      Object.assign(new Error("already exists"), { code: 409 }),
    );
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);
    accountRef.get.mockResolvedValueOnce(existing);
    fetchMyProfileMock.mockResolvedValueOnce(null);

    await act(async () => {
      expect(
        await result.current.signup(
          "resume@example.com",
          "test-pass-123",
          "Resume User",
          "resume_user",
        ),
      ).toBe(true);
    });

    expect(result.current.user?.$id).toBe("user_resume");
    expect(createOrUpdateProfileMock).toHaveBeenCalledOnce();
  });

  it("does not let a reload with a pending signup session bypass username setup", async () => {
    localStorage.setItem(
      "mosaic_pending_signup",
      JSON.stringify({
        email: "pending@example.com",
        name: "Pending User",
        userId: "user_pending",
      }),
    );
    accountRef.get.mockReset();
    accountRef.get.mockResolvedValueOnce(
      makeUser({
        $id: "user_pending",
        email: "pending@example.com",
        name: "Pending User",
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() =>
      expect(result.current.pendingSignup?.email).toBe("pending@example.com"),
    );
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
    expect(initializeSyncMock).not.toHaveBeenCalled();
  });

  it("finalizes an accepted account deletion without calling normal logout", async () => {
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(makeUser()));
    accountRef.get.mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));

    await act(async () => {
      expect(await result.current.deleteAccount("DELETE")).toBe(true);
    });

    expect(suspendSyncOwnerMock).toHaveBeenCalledWith("user_1");
    expect(requestAccountDeletionMock).toHaveBeenCalledWith("DELETE");
    expect(clearDeletedAccountLocalDataMock).toHaveBeenCalledWith("user_1");
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
    expect(accountRef.deleteSession).not.toHaveBeenCalled();
  });

  it("keeps account work frozen when the deletion response is ambiguous", async () => {
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(makeUser()));
    accountRef.get.mockResolvedValue(makeUser());
    requestAccountDeletionMock.mockRejectedValueOnce(
      new Error("Function request timed out"),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));
    initializeSyncMock.mockClear();

    await act(async () => {
      expect(await result.current.deleteAccount("DELETE")).toBe(true);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toMatch(/deletion is still pending/i);
    expect(clearDeletedAccountLocalDataMock).not.toHaveBeenCalled();
    expect(initializeSyncMock).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem(ACCOUNT_DELETION_INTENT_KEY) as string)
        .userId,
    ).toBe("user_1");
  });

  it("keeps a pre-pivot server deletion request frozen without erasing local rows", async () => {
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(makeUser()));
    accountRef.get.mockResolvedValue(makeUser());
    requestAccountDeletionMock.mockResolvedValueOnce({
      accepted: false,
      deletionPending: true,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));

    await act(async () => {
      expect(await result.current.deleteAccount("DELETE")).toBe(true);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toMatch(/privacy marker is available/i);
    expect(clearDeletedAccountLocalDataMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACCOUNT_DELETION_INTENT_KEY)).not.toBeNull();
  });

  it("does not hydrate a cached account with a persisted deletion intent and retries it live", async () => {
    const cached = makeUser();
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    localStorage.setItem(
      ACCOUNT_DELETION_INTENT_KEY,
      JSON.stringify({
        userId: cached.$id,
        startedAt: "2026-10-04T00:00:00.000Z",
      }),
    );
    accountRef.get.mockReset().mockResolvedValueOnce(cached);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    await waitFor(() =>
      expect(requestAccountDeletionMock).toHaveBeenCalledWith("DELETE"),
    );
    await waitFor(() =>
      expect(clearDeletedAccountLocalDataMock).toHaveBeenCalledWith("user_1"),
    );
    expect(localStorage.getItem(ACCOUNT_DELETION_INTENT_KEY)).toBeNull();
  });

  it("freezes another tab immediately when account deletion starts", async () => {
    const cached = makeUser();
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockResolvedValue(cached);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "mosaic_auth_broadcast",
          newValue: JSON.stringify({
            type: "deletion_pending",
            userId: "user_1",
            at: Date.now(),
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(suspendSyncOwnerMock).toHaveBeenCalledWith("user_1");
    expect(clearDeletedAccountLocalDataMock).not.toHaveBeenCalled();
  });

  it("keeps legacy login usable even when no social profile exists yet", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const fresh = makeUser({
      $id: "user_needs_profile",
      email: "needs-profile@example.com",
      name: "Needs Profile",
    });
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);
    accountRef.get.mockResolvedValueOnce(fresh);
    fetchMyProfileMock.mockResolvedValueOnce(null);

    await act(async () => {
      expect(
        await result.current.login("needs-profile@example.com", "test-pass-123"),
      ).toBe(true);
    });

    expect(result.current.user?.$id).toBe("user_needs_profile");
    expect(result.current.pendingSignup).toBeNull();
    expect(result.current.error).toBeNull();
    expect(fetchMyProfileMock).not.toHaveBeenCalled();
  });

  it("reuses a matching already-active Appwrite session after delete-session fails", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const existing = makeUser({
      $id: "user_active_session",
      email: "active@example.com",
    });
    accountRef.deleteSession.mockRejectedValueOnce(new Error("delete unavailable"));
    accountRef.createEmailPasswordSession.mockRejectedValueOnce(
      Object.assign(
        new Error("Creation of a session is prohibited when a session is active"),
        { type: "user_session_already_exists", code: 401 },
      ),
    );
    accountRef.get.mockResolvedValueOnce(existing);

    await act(async () => {
      expect(
        await result.current.login("ACTIVE@example.com", "test-pass-123"),
      ).toBe(true);
    });

    expect(result.current.user?.$id).toBe("user_active_session");
    expect(accountRef.get).toHaveBeenCalledTimes(2);
  });

  it("retries the account switch when another active session is discovered", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const other = makeUser({
      $id: "user_other_active",
      email: "other@example.com",
    });
    const wanted = makeUser({
      $id: "user_wanted",
      email: "wanted@example.com",
    });
    accountRef.deleteSession
      .mockRejectedValueOnce(new Error("delete unavailable"))
      .mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession
      .mockRejectedValueOnce(
        Object.assign(
          new Error("Creation of a session is prohibited when a session is active"),
          { type: "user_session_already_exists", code: 401 },
        ),
      )
      .mockResolvedValueOnce(undefined);
    accountRef.get
      .mockResolvedValueOnce(other)
      .mockResolvedValueOnce(wanted);

    await act(async () => {
      expect(
        await result.current.login("wanted@example.com", "test-pass-123"),
      ).toBe(true);
    });

    expect(result.current.user?.$id).toBe("user_wanted");
    expect(result.current.error).toBeNull();
    expect(accountRef.deleteSession).toHaveBeenCalledTimes(2);
    expect(accountRef.createEmailPasswordSession).toHaveBeenCalledTimes(2);
    expect(accountRef.get).toHaveBeenCalledTimes(3);
  });

  it("fails closed without re-adopting another active account when switching cannot clear it", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    accountRef.deleteSession
      .mockRejectedValueOnce(new Error("delete unavailable"))
      .mockRejectedValueOnce(new Error("delete still unavailable"));
    accountRef.createEmailPasswordSession.mockRejectedValueOnce(
      Object.assign(
        new Error("Creation of a session is prohibited when a session is active"),
        { type: "user_session_already_exists", code: 401 },
      ),
    );
    accountRef.get.mockResolvedValueOnce(
      makeUser({
        $id: "user_other_active",
        email: "other@example.com",
      }),
    );

    await act(async () => {
      expect(
        await result.current.login("wanted@example.com", "test-pass-123"),
      ).toBe(false);
      await Promise.resolve();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toMatch(/another mosaic account is still active/i);
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
    expect(accountRef.get).toHaveBeenCalledTimes(2);
  });

  // Regression: §19 (successful login triggers sync after auth resolves).
  it("starts sync after login establishes an authenticated session", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(initializeSyncMock).not.toHaveBeenCalled();

    const fresh = makeUser({ $id: "user_fresh" });
    accountRef.get.mockResolvedValueOnce(fresh);

    await act(async () => {
      await result.current.login("user@example.com", "password123");
    });

    await waitFor(() => expect(result.current.user?.$id).toBe("user_fresh"));
    await waitFor(() =>
      expect(initializeSyncMock).toHaveBeenCalledWith("user_fresh"),
    );
  });

  it("suspends the authenticated sync owner before logout mutates the session", async () => {
    const cached = makeUser({ $id: "user_cached_logout" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockResolvedValue(cached);
    accountRef.deleteSession.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() =>
      expect(result.current.user?.$id).toBe("user_cached_logout"),
    );

    await act(async () => {
      expect(await result.current.logout()).toBe(true);
    });

    expect(suspendSyncOwnerMock).toHaveBeenCalledWith("user_cached_logout");
    expect(
      suspendSyncOwnerMock.mock.invocationCallOrder[0],
    ).toBeLessThan(accountRef.deleteSession.mock.invocationCallOrder[0]);
  });

  it("hydrates cached identity immediately when definitely offline without a session request", async () => {
    const cached = makeUser({
      $id: "user_cached",
      email: "cached@example.com",
    });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    resetConnectivityForTests({
      status: "offline",
      reason: "browser-offline",
      lastConfirmedAt: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user?.$id).toBe("user_cached");
    expect(result.current.isOffline).toBe(true);
    await act(async () => Promise.resolve());
    expect(accountRef.get).not.toHaveBeenCalled();
  });

  it("uses the offline unauthenticated state immediately with no cache", async () => {
    localStorage.removeItem(LAST_KNOWN_USER_KEY);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    resetConnectivityForTests({
      status: "offline",
      reason: "browser-offline",
      lastConfirmedAt: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isOffline).toBe(true);
    await act(async () => Promise.resolve());
    expect(accountRef.get).not.toHaveBeenCalled();
  });

  it("renders cached identity immediately while browser says online but Appwrite is still unresolved", async () => {
    const cached = makeUser({ $id: "user_cached_online_hint" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));

    let rejectLiveCheck!: (error: Error) => void;
    const liveCheck = new Promise<Models.User<Models.Preferences>>(
      (_resolve, reject) => {
        rejectLiveCheck = reject;
      },
    );
    accountRef.get.mockReset();
    accountRef.get.mockReturnValueOnce(liveCheck);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user?.$id).toBe("user_cached_online_hint");
    expect(getConnectivitySnapshot().status).toBe("checking");
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledOnce());

    await act(async () => {
      rejectLiveCheck(makeNetworkError());
      await liveCheck.catch(() => undefined);
    });

    await waitFor(() =>
      expect(getConnectivitySnapshot().status).toBe("offline"),
    );
    expect(result.current.user?.$id).toBe("user_cached_online_hint");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it("clears the cache and user on mount-time 401", async () => {
    const cached = makeUser({ $id: "user_cached" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user?.$id).toBe("user_cached");
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.isOffline).toBe(false);
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
  });

  it("clears the cache on explicit logout()", async () => {
    const cached = makeUser({ $id: "user_1" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockResolvedValueOnce(cached);
    accountRef.deleteSession.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.$id).toBe("user_1");
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).not.toBeNull();

    let ok = false;
    await act(async () => {
      ok = await result.current.logout();
    });

    expect(ok).toBe(true);
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
  });

  it("preserves user and cache when a resource 401 is followed by a successful session probe", async () => {
    const cached = makeUser({ $id: "user_1" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get.mockResolvedValue(cached);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    });

    await waitFor(() => expect(accountRef.get).toHaveBeenCalledTimes(2));
    expect(result.current.user?.$id).toBe("user_1");
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("expires user and cache only when the resource-401 session probe returns 401", async () => {
    const cached = makeUser({ $id: "user_1" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get
      .mockResolvedValueOnce(cached)
      .mockRejectedValueOnce(makeUnauthorizedError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));

    act(() => window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT)));

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).toBeNull();
    expect(result.current.error).toBe(
      "Your session has expired. Please sign in again.",
    );
  });

  it("keeps the user on a failed resource-401 probe and reports offline", async () => {
    const cached = makeUser({ $id: "user_1" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    accountRef.get
      .mockResolvedValueOnce(cached)
      .mockRejectedValueOnce(makeNetworkError());
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));

    act(() => window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT)));

    await waitFor(() => expect(result.current.isOffline).toBe(true));
    expect(result.current.user?.$id).toBe("user_1");
    expect(localStorage.getItem(LAST_KNOWN_USER_KEY)).not.toBeNull();
  });

  it("coalesces concurrent unauthorized events into one session probe", async () => {
    const cached = makeUser({ $id: "user_1" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    let resolveProbe!: (user: Models.User<Models.Preferences>) => void;
    accountRef.get.mockResolvedValueOnce(cached).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProbe = resolve;
      }),
    );
    renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledOnce());

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    });
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledTimes(2));
    expect(accountRef.get).toHaveBeenCalledTimes(2);
    await act(async () => resolveProbe(cached));
  });

  it("does not let a stale unauthorized probe reverse logout", async () => {
    const cached = makeUser({ $id: "user_1" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    let rejectProbe!: (error: Error) => void;
    const probe = new Promise<Models.User<Models.Preferences>>(
      (_resolve, reject) => { rejectProbe = reject; },
    );
    accountRef.get
      .mockResolvedValueOnce(cached)
      .mockReturnValueOnce(probe);
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.$id).toBe("user_1"));
    act(() => window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT)));
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledTimes(2));

    await act(async () => { await result.current.logout(); });
    await act(async () => { rejectProbe(makeUnauthorizedError()); await probe.catch(() => undefined); });
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not let a stale unauthorized probe reverse a cross-tab login", async () => {
    const cached = makeUser({ $id: "user_1" });
    const other = makeUser({ $id: "user_other" });
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(cached));
    let rejectProbe!: (error: Error) => void;
    const probe = new Promise<Models.User<Models.Preferences>>(
      (_resolve, reject) => { rejectProbe = reject; },
    );
    accountRef.get
      .mockResolvedValueOnce(cached)
      .mockReturnValueOnce(probe)
      .mockResolvedValueOnce(other);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledOnce());
    act(() => window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT)));
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledTimes(2));
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(other));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "mosaic_auth_broadcast",
        newValue: JSON.stringify({ type: "login", at: Date.now() }),
      }));
    });
    await act(async () => {
      rejectProbe(makeUnauthorizedError());
      await probe.catch(() => undefined);
    });
    expect(result.current.user?.$id).toBe("user_other");
    expect(result.current.error).toBeNull();
  });

  it("rewrites the cache and clears isOffline on successful retry()", async () => {
    localStorage.removeItem(LAST_KNOWN_USER_KEY);
    accountRef.get.mockRejectedValueOnce(makeNetworkError());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isOffline).toBe(true);
    expect(result.current.user).toBeNull();

    const fresh = makeUser({
      $id: "user_fresh",
      email: "fresh@example.com",
    });
    accountRef.get.mockResolvedValueOnce(fresh);

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.user?.$id).toBe("user_fresh");
    expect(result.current.isOffline).toBe(false);
    const cachedRaw = localStorage.getItem(LAST_KNOWN_USER_KEY);
    expect(cachedRaw).not.toBeNull();
    expect(JSON.parse(cachedRaw as string).$id).toBe("user_fresh");
  });

  it("waits for local database readiness before starting post-auth sync", async () => {
    accountRef.get.mockRejectedValueOnce(makeUnauthorizedError());
    let releaseDatabase!: () => void;
    const databaseReady = new Promise<void>((resolve) => {
      releaseDatabase = resolve;
    });
    waitForDatabaseReadyMock.mockReturnValueOnce(databaseReady);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);
    accountRef.get.mockResolvedValueOnce(makeUser({ $id: "user_db_wait" }));

    await act(async () => {
      await result.current.login("user@example.com", "test-pass");
    });

    expect(initializeSyncMock).not.toHaveBeenCalled();
    releaseDatabase();
    await waitFor(() =>
      expect(initializeSyncMock).toHaveBeenCalledWith("user_db_wait"),
    );
  });

  it("ignores an older session result that finishes after a newer login", async () => {
    let resolveInitial!: (user: Models.User<Models.Preferences>) => void;
    const initialPromise = new Promise<Models.User<Models.Preferences>>(
      (resolve) => {
        resolveInitial = resolve;
      },
    );
    const oldUser = makeUser({ $id: "user_old" });
    const freshUser = makeUser({ $id: "user_fresh" });
    accountRef.get
      .mockReturnValueOnce(initialPromise)
      .mockResolvedValueOnce(freshUser);
    accountRef.deleteSession.mockResolvedValueOnce(undefined);
    accountRef.createEmailPasswordSession.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(accountRef.get).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.login("user@example.com", "test-pass");
    });
    expect(result.current.user?.$id).toBe("user_fresh");

    await act(async () => {
      resolveInitial(oldUser);
      await initialPromise;
    });

    expect(result.current.user?.$id).toBe("user_fresh");
    expect(
      JSON.parse(localStorage.getItem(LAST_KNOWN_USER_KEY) as string).$id,
    ).toBe("user_fresh");
  });
});
