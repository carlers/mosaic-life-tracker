import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { account } from "../lib/appwrite";
import {
  AUTH_UNAUTHORIZED_EVENT,
  isUnauthorizedError,
} from "../lib/authEvents";
import { AuthContext } from "./authContext";
import type { Models } from "appwrite";
import { syncPostHogIdentity } from "../lib/posthog";
import { waitForDatabaseReady } from "../lib/databaseBootstrap";
import { markStartup } from "../lib/startupMetrics";
import { scopeSyncStatusToUser } from "../lib/syncStatus";
import {
  getConnectivitySnapshot,
  markConnectivityChecking,
  reportConnectivityResult,
} from "../lib/connectivity";
import { useConnectivity } from "./useConnectivity";
import { preloadHomePage } from "../lib/homePreload";
import { scopeAccountWork } from "../lib/accountWorkScope";
import { validatePassword } from "../lib/password";
import {
  isValidUsername,
  normalizeUsername,
  USERNAME_REQUIREMENTS,
} from "../lib/profileUsername";

const AUTH_BROADCAST_KEY = "mosaic_auth_broadcast";
const LAST_KNOWN_USER_KEY = "mosaic_last_known_user";
const PENDING_SIGNUP_KEY = "mosaic_pending_signup";
const ACCOUNT_DELETION_INTENT_KEY = "mosaic_account_deletion_intent_v1";

type AuthBroadcast = {
  type: "login" | "logout" | "deletion_pending" | "deletion_accepted";
  at: number;
  userId?: string;
};
interface AccountDeletionIntent {
  userId: string;
  email?: string;
  startedAt: string;
}
interface PendingSignupRecord {
  email: string;
  name: string;
  username?: string;
  userId?: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function readAccountDeletionIntent(): AccountDeletionIntent | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_DELETION_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AccountDeletionIntent>;
    if (
      typeof parsed.userId !== "string" ||
      !parsed.userId ||
      typeof parsed.startedAt !== "string" ||
      !parsed.startedAt
    ) {
      localStorage.removeItem(ACCOUNT_DELETION_INTENT_KEY);
      return null;
    }
    return {
      userId: parsed.userId,
      ...(typeof parsed.email === "string" && parsed.email.trim()
        ? { email: normalizeEmail(parsed.email) }
        : {}),
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

function writeAccountDeletionIntent(userId: string, email?: string): void {
  try {
    localStorage.setItem(
      ACCOUNT_DELETION_INTENT_KEY,
      JSON.stringify({
        userId,
        ...(email ? { email: normalizeEmail(email) } : {}),
        startedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Server state remains authoritative; this only weakens reload recovery.
  }
}

function deletionIntentMatchesEmail(
  intent: AccountDeletionIntent | null,
  email: string,
): intent is AccountDeletionIntent {
  return Boolean(
    intent?.email &&
      normalizeEmail(intent.email) === normalizeEmail(email),
  );
}

function clearAccountDeletionIntent(userId?: string): void {
  try {
    if (userId) {
      const current = readAccountDeletionIntent();
      if (current && current.userId !== userId) return;
    }
    localStorage.removeItem(ACCOUNT_DELETION_INTENT_KEY);
  } catch {
    // Best-effort browser metadata cleanup.
  }
}

function isSessionAlreadyActiveError(error: unknown): boolean {
  const type = (error as { type?: string } | null)?.type;
  if (type === "user_session_already_exists") return true;
  const message = error instanceof Error ? error.message : "";
  return /session.*(?:already exists|already active|prohibited when a session is active)/i.test(
    message,
  );
}

function isBlockedUserError(error: unknown): boolean {
  const type = (error as { type?: string } | null)?.type;
  if (type === "user_blocked") return true;
  const message = error instanceof Error ? error.message : "";
  return /user.*blocked|account.*blocked/i.test(message);
}

class ActiveSessionAccountMismatchError extends Error {
  constructor() {
    super(
      "Another Mosaic account is still active. Please try signing in again.",
    );
    this.name = "ActiveSessionAccountMismatchError";
  }
}

async function createSessionOrReuseMatching(
  email: string,
  password: string,
): Promise<Models.User<Models.Preferences> | null> {
  try {
    await callAccount(() =>
      account.createEmailPasswordSession(email, password),
    );
    return null;
  } catch (sessionError) {
    if (!isSessionAlreadyActiveError(sessionError)) {
      throw sessionError;
    }

    const existing = await callAccount(() => account.get());
    if (normalizeEmail(existing.email) === normalizeEmail(email)) {
      return existing;
    }

    // A stale/failed delete can leave another account's valid session behind.
    // Now that account.get() proved connectivity, retry the switch instead of
    // ever accepting the wrong authenticated owner.
    try {
      await callAccount(() => account.deleteSession("current"));
    } catch {
      throw new ActiveSessionAccountMismatchError();
    }

    await callAccount(() =>
      account.createEmailPasswordSession(email, password),
    );
    return null;
  }
}

function readPendingSignup(): PendingSignupRecord | null {
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSignupRecord>;
    if (
      typeof parsed.email !== "string" ||
      parsed.email.trim().length === 0 ||
      typeof parsed.name !== "string"
    ) {
      localStorage.removeItem(PENDING_SIGNUP_KEY);
      return null;
    }
    return {
      email: normalizeEmail(parsed.email),
      name: parsed.name,
      ...(typeof parsed.username === "string" && isValidUsername(parsed.username)
        ? { username: normalizeUsername(parsed.username) }
        : {}),
      ...(typeof parsed.userId === "string" && parsed.userId
        ? { userId: parsed.userId }
        : {}),
    };
  } catch {
    return null;
  }
}

function writePendingSignup(record: PendingSignupRecord): void {
  try {
    localStorage.setItem(
      PENDING_SIGNUP_KEY,
      JSON.stringify({
        ...record,
        email: normalizeEmail(record.email),
      }),
    );
  } catch {
    // Recovery metadata is best-effort; the account remains authoritative.
  }
}

function clearPendingSignup(): void {
  try {
    localStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function broadcastAuth(
  type: AuthBroadcast["type"],
  userId?: string,
) {
  try {
    const payload: AuthBroadcast = {
      type,
      at: Date.now(),
      ...(userId ? { userId } : {}),
    };
    localStorage.setItem(AUTH_BROADCAST_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function readCachedUser(): Models.User<Models.Preferences> | null {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<Models.User<Models.Preferences>>;
    if (typeof candidate.$id !== "string" || candidate.$id.length === 0) {
      return null;
    }
    if (typeof candidate.email !== "string") return null;
    if (!candidate.prefs || typeof candidate.prefs !== "object") return null;
    return candidate as Models.User<Models.Preferences>;
  } catch {
    return null;
  }
}

function writeCachedUser(user: Models.User<Models.Preferences>): void {
  try {
    localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function clearCachedUser(): void {
  try {
    localStorage.removeItem(LAST_KNOWN_USER_KEY);
  } catch {
    // Ignore storage failures.
  }
}

async function suspendAccountWorkForUser(userId: string): Promise<void> {
  scopeAccountWork(null);
  if (!userId) return;
  try {
    const { suspendSyncOwner } = await import("../db/sync");
    await suspendSyncOwner(userId);
  } catch (syncError) {
    console.warn("[AuthProvider] Sync suspension failed:", syncError);
  }
}

async function callAccount<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    reportConnectivityResult();
    return result;
  } catch (error) {
    reportConnectivityResult(error);
    throw error;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Cached identity is the local startup authority. Live Appwrite verification
  // reconciles in the background and must never hold a previously-hydrated
  // account behind a page-level spinner.
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    () => {
      const initialUser = readCachedUser();
      const deletionIntent = readAccountDeletionIntent();
      if (initialUser && deletionIntent?.userId === initialUser.$id) {
        scopeAccountWork(null);
        return null;
      }
      const signup = readPendingSignup();
      if (initialUser && signup?.username &&
          normalizeEmail(signup.email) === normalizeEmail(initialUser.email) &&
          (!signup.userId || signup.userId === initialUser.$id)) {
        scopeAccountWork(null);
        return null;
      }
      scopeAccountWork(initialUser?.$id ?? null);
      return initialUser;
    },
  );
  const [pendingSignup, setPendingSignup] = useState<{
    email: string;
    name: string;
    username?: string;
  } | null>(() => {
    const pending = readPendingSignup();
    return pending ? { email: pending.email, name: pending.name, username: pending.username } : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<
    "requested" | "completed" | null
  >(null);
  const connectivity = useConnectivity();
  const isOffline = connectivity.status === "offline";
  const isMountedRef = useRef(true);
  const resolveInFlightGenerationRef = useRef<number | null>(null);
  const authGenerationRef = useRef(0);
  const recoveryGenerationRef = useRef(0);
  const userId = user?.$id ?? null;

  useEffect(() => {
    markStartup("auth:resolved");
  }, []);

  useEffect(() => {
    scopeSyncStatusToUser(userId);
  }, [userId]);

  // The sharing command engine is only needed after session startup; loading
  // it lazily keeps the relatively large durable offline-queue code out of
  // the initial unauthenticated app shell.
  useEffect(() => {
    let active = true;
    void import("../lib/taskShareQueue").then(({ scopeSharedTaskQueue }) => {
      if (active) scopeSharedTaskQueue(userId);
    }).catch(error => console.warn("[AuthProvider] Shared queue scope failed:", error));
    return () => {
      active = false;
      void import("../lib/taskShareQueue").then(({ scopeSharedTaskQueue }) =>
        scopeSharedTaskQueue(null)
      ).catch(() => {});
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || connectivity.status !== "online") return;
    let active = true;
    void import("../lib/taskShareQueue").then(async queue => {
      if (!active) return;
      await queue.flushSharedMemberships(userId);
      if (active) await queue.flushSharedCompletions(userId);
    }).catch(error => {
      if (active) console.warn("[AuthProvider] Shared action retry failed:", error);
    });
    return () => { active = false; };
  }, [userId, connectivity.status]);

  useEffect(() => {
    let active = true;
    void import("../lib/pushNotifications")
      .then(({ setPushActiveUser }) => {
        if (active) return setPushActiveUser(userId);
      })
      .catch((pushError) => {
        console.warn(
          "[AuthProvider] Push account marker failed:",
          pushError,
        );
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    scopeAccountWork(userId);
    if (!userId) return;

    return () => {
      scopeAccountWork(null);
      void import("../db/sync")
        .then(({ suspendSyncOwner }) => suspendSyncOwner(userId))
        .catch((syncError) => {
          console.warn("[AuthProvider] Sync owner teardown failed:", syncError);
        });
    };
  }, [userId]);

  useEffect(() => {
    syncPostHogIdentity(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void preloadHomePage().catch((loadError) => {
      console.warn("[AuthProvider] Home preload failed:", loadError);
    });
  }, [userId]);

  // Sync waits for proven Appwrite reachability, not navigator.onLine.
  useEffect(() => {
    if (isLoading || connectivity.status !== "online" || !userId) {
      return;
    }
    let active = true;
    void waitForDatabaseReady()
      .then(() => import("../db/sync"))
      .then(({ initializeSync }) => {
        if (!active) return;
        return initializeSync(userId);
      })
      .catch((syncError) => {
        if (active) {
          console.error("[AuthProvider] Post-auth sync failed:", syncError);
        }
      });
    return () => {
      active = false;
    };
  }, [connectivity.status, isLoading, userId]);

  const purgePendingDeletionLocalData = useCallback(
    async (deletingUserId: string): Promise<void> => {
      scopeAccountWork(null);
      clearCachedUser();
      clearPendingSignup();
      setPendingSignup(null);
      setUser(null);
      try {
        const { clearDeletedAccountLocalData } = await import(
          "../lib/accountDeletionLocal"
        );
        await clearDeletedAccountLocalData(deletingUserId);
      } catch (cleanupError) {
        console.warn(
          "[AuthProvider] Pending-deletion local cleanup was incomplete:",
          cleanupError,
        );
      }
    },
    [],
  );

  const finalizeDeletedAccount = useCallback(
    async (deletingUserId: string): Promise<void> => {
      scopeAccountWork(null);
      clearCachedUser();
      clearPendingSignup();
      setPendingSignup(null);
      setUser(null);
      setIsLoading(false);
      broadcastAuth("deletion_accepted", deletingUserId);

      try {
        const { clearDeletedAccountLocalData } = await import(
          "../lib/accountDeletionLocal"
        );
        await clearDeletedAccountLocalData(deletingUserId);
        clearAccountDeletionIntent(deletingUserId);
        if (isMountedRef.current) setError(null);
      } catch (cleanupError) {
        console.warn(
          "[AuthProvider] Deleted-account local cleanup was incomplete:",
          cleanupError,
        );
        if (isMountedRef.current) {
          setError(
            "Your account deletion was accepted, but some local data could not be cleared yet.",
          );
        }
      }
    },
    [],
  );

  const submitPendingDeletion = useCallback(
    async (deletingUserId: string): Promise<boolean> => {
      await suspendAccountWorkForUser(deletingUserId);
      clearCachedUser();
      clearPendingSignup();
      setPendingSignup(null);
      setUser(null);
      setIsLoading(true);
      broadcastAuth("deletion_pending", deletingUserId);

      try {
        const { requestAccountDeletion } = await import(
          "../lib/accountDeletion"
        );
        const state = await requestAccountDeletion("DELETE");

        if (state.accepted) {
          await finalizeDeletedAccount(deletingUserId);
          return true;
        }

        // The server retained a pre-pivot deletion job but has not yet
        // confirmed the immutable DR marker. Keep the account locally frozen;
        // the server worker and future authenticated retries can safely finish.
        if (isMountedRef.current) {
          setIsLoading(false);
          setError(
            "Account deletion is pending and will continue when the privacy marker is available.",
          );
        }
        return true;
      } catch (deleteError: unknown) {
        // A lost/late HTTP response can happen after the server retained the
        // deletion request or crossed the privacy pivot. Never restart sync
        // based only on browser uncertainty.
        scopeAccountWork(null);
        clearCachedUser();
        setUser(null);
        if (isMountedRef.current) {
          setIsLoading(false);
          const detail =
            deleteError instanceof Error ? ` (${deleteError.message})` : "";
          setError(
            `Account deletion is still pending. Sign in to the same account to retry safely.${detail}`,
          );
        }
        return true;
      }
    },
    [finalizeDeletedAccount],
  );

  const verifyLiveSession = useCallback(async (sessionExpiredOn401 = false) => {
    const generation = authGenerationRef.current;
    if (resolveInFlightGenerationRef.current === generation) return;

    // Browser-offline is still a useful hard negative. The important change
    // is that browser-online is no longer treated as proof of reachability.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    resolveInFlightGenerationRef.current = generation;
    try {
      const resolved = await callAccount(() => account.get());
      if (!isMountedRef.current || generation !== authGenerationRef.current) {
        return;
      }
      const deletionIntent = readAccountDeletionIntent();
      if (deletionIntent?.userId === resolved.$id) {
        await submitPendingDeletion(resolved.$id);
        return;
      }

      const pending = readPendingSignup();
      // Only new username-bearing registration markers block workspace entry
      // until the remotely unique profile is saved. Old (name-only) markers
      // stay backward compatible with already authenticated accounts.
      if (pending?.username &&
          normalizeEmail(pending.email) === normalizeEmail(resolved.email) &&
          (!pending.userId || pending.userId === resolved.$id)) {
        clearCachedUser();
        scopeAccountWork(null);
        setPendingSignup({ email: pending.email, name: pending.name, username: pending.username });
        setUser(null);
        setError(null);
        return;
      }
      if (pending) {
        clearPendingSignup();
        setPendingSignup(null);
      }
      scopeAccountWork(resolved.$id);
      writeCachedUser(resolved);
      setUser(resolved);
      setError(null);
    } catch (resolveError) {
      if (!isMountedRef.current || generation !== authGenerationRef.current) {
        return;
      }
      if (isUnauthorizedError(resolveError)) {
        // Account deletion deliberately blocks the Auth user before removing
        // it. Other signed-in devices can use Appwrite's specific
        // `user_blocked` error to purge their local copy instead of leaving
        // deleted-account data stranded on that device.
        const blocked = isBlockedUserError(resolveError);
        const cached = readCachedUser();
        const deletionIntent = readAccountDeletionIntent();
        const activeDeletionIntent =
          deletionIntent &&
          (!cached || cached.$id === deletionIntent.userId)
            ? deletionIntent
            : null;

        authGenerationRef.current += 1;
        scopeAccountWork(null);
        clearCachedUser();
        if (blocked) {
          const deletingUserId = cached?.$id || activeDeletionIntent?.userId;
          clearPendingSignup();
          setPendingSignup(null);
          if (deletingUserId) {
            broadcastAuth("deletion_accepted", deletingUserId);
            void import("../lib/accountDeletionLocal")
              .then(async ({ clearDeletedAccountLocalData }) => {
                await clearDeletedAccountLocalData(deletingUserId);
                clearAccountDeletionIntent(deletingUserId);
              })
              .catch((cleanupError) => {
                console.warn(
                  "[AuthProvider] Peer-device deleted-account cleanup failed:",
                  cleanupError,
                );
              });
          }
        } else if (activeDeletionIntent) {
          // A lost delete response can be followed by an ordinary 401 after
          // the worker has already revoked/deleted Auth. The local deletion
          // intent is enough to evict that account's device data, but it stays
          // persisted so an unaccepted pre-pivot request can still be retried.
          void purgePendingDeletionLocalData(activeDeletionIntent.userId);
        }
        setUser(null);
        setError(
          blocked
            ? "This Mosaic account is being deleted."
            : activeDeletionIntent
              ? "Account deletion is still pending. Sign in to the same account to retry safely."
              : sessionExpiredOn401
                ? "Your session has expired. Please sign in again."
                : null,
        );
      } else {
        // Keep the cached identity/local app. Connectivity now communicates
        // reachability; a failed verification is not a rendering gate.
        setError(
          resolveError instanceof Error
            ? resolveError.message
            : "Could not reach server.",
        );
      }
    } finally {
      if (resolveInFlightGenerationRef.current === generation) {
        resolveInFlightGenerationRef.current = null;
      }
    }
  }, [purgePendingDeletionLocalData, submitPendingDeletion]);

  // "checking" means the browser thinks a path may exist but Mosaic has not
  // yet proven Appwrite reachability. Initial mount and reconnect both land
  // here. Verification is background-only.
  useEffect(() => {
    if (connectivity.status !== "checking") return;
    queueMicrotask(() => {
      if (isMountedRef.current) void verifyLiveSession();
    });
  }, [connectivity.status, verifyLiveSession]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_BROADCAST_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as AuthBroadcast;
        authGenerationRef.current += 1;
        scopeAccountWork(null);
        if (parsed.type === "logout") {
          clearCachedUser();
          setUser(null);
          setError(null);
          setIsLoading(false);
          return;
        }

        if (
          parsed.type === "deletion_pending" ||
          parsed.type === "deletion_accepted"
        ) {
          const deletingUserId = parsed.userId;
          clearCachedUser();
          clearPendingSignup();
          setPendingSignup(null);
          setUser(null);
          setIsLoading(false);
          setError(
            parsed.type === "deletion_pending"
              ? "Account deletion is pending."
              : null,
          );
          if (deletingUserId) {
            void suspendAccountWorkForUser(deletingUserId);
            if (parsed.type === "deletion_accepted") {
              void import("../lib/accountDeletionLocal")
                .then(async ({ clearDeletedAccountLocalData }) => {
                  await clearDeletedAccountLocalData(deletingUserId);
                  clearAccountDeletionIntent(deletingUserId);
                })
                .catch((cleanupError) => {
                  console.warn(
                    "[AuthProvider] Cross-tab deleted-account cleanup failed:",
                    cleanupError,
                  );
                });
            }
          }
          return;
        }

        // A completed login/signup clears pending onboarding before broadcast.
        const pending = readPendingSignup();
        setPendingSignup(
          pending ? { email: pending.email, name: pending.name } : null,
        );
        const cached = readCachedUser();
        const deletionIntent = readAccountDeletionIntent();
        if (cached && deletionIntent?.userId === cached.$id) {
          setUser(null);
          setError("Account deletion is pending.");
          setIsLoading(false);
          if (getConnectivitySnapshot().status !== "offline") {
            markConnectivityChecking("cross-tab-deletion-retry");
          }
          return;
        }
        // Another tab already wrote the authenticated identity. Use it
        // immediately, then reconcile the live session in the background.
        setUser(cached);
        setError(null);
        setIsLoading(false);
        if (getConnectivitySnapshot().status !== "offline") {
          markConnectivityChecking("cross-tab-login");
        }
      } catch {
        // Ignore malformed payloads.
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!isMountedRef.current) return;
      void verifyLiveSession(true);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [verifyLiveSession]);

  const suspendCurrentAccountWork = useCallback(async (): Promise<void> => {
    if (!userId) {
      scopeAccountWork(null);
      return;
    }
    await suspendAccountWorkForUser(userId);
  }, [userId]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const generation = ++authGenerationRef.current;
      const normalizedEmail = normalizeEmail(email);
      let authenticatedUserId: string | null = null;
      setError(null);
      setIsLoading(true);
      await suspendCurrentAccountWork();
      try {
        try {
          await callAccount(() => account.deleteSession("current"));
        } catch {
          // Session may not exist. The create-session call below is authoritative.
        }
        const reusedSession = await createSessionOrReuseMatching(
          normalizedEmail,
          password,
        );
        const resolved =
          reusedSession ?? (await callAccount(() => account.get()));
        authenticatedUserId = resolved.$id;
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }

        const deletionIntent = readAccountDeletionIntent();
        if (deletionIntent?.userId === resolved.$id) {
          await submitPendingDeletion(resolved.$id);
          return false;
        }

        scopeAccountWork(resolved.$id);
        // New signup requires a profile before first entry, but legacy accounts
        // that predate that requirement must remain usable. Social surfaces
        // already prompt for profile setup when a profile is actually needed.
        clearPendingSignup();
        setPendingSignup(null);
        writeCachedUser(resolved);
        setUser(resolved);
        setError(null);
        setIsLoading(false);
        broadcastAuth("login");
        return true;
      } catch (loginError: unknown) {
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }
        if (authenticatedUserId) {
          scopeAccountWork(null);
        }

        const deletionIntent = readAccountDeletionIntent();
        if (
          !authenticatedUserId &&
          deletionIntentMatchesEmail(deletionIntent, normalizedEmail) &&
          (isUnauthorizedError(loginError) || isBlockedUserError(loginError))
        ) {
          await purgePendingDeletionLocalData(deletionIntent.userId);
          if (isMountedRef.current) {
            setError(
              isBlockedUserError(loginError)
                ? "This Mosaic account is being deleted."
                : "Account deletion is still pending. Sign in to the same account to retry safely.",
            );
            setIsLoading(false);
          }
          return false;
        }

        const message =
          loginError instanceof Error ? loginError.message : "Login failed";
        setError(message);
        setIsLoading(false);
        if (
          !authenticatedUserId &&
          !isUnauthorizedError(loginError) &&
          !(loginError instanceof ActiveSessionAccountMismatchError)
        ) {
          // Only ambiguous/non-auth failures need a live-session probe.
          // Credential 401s and explicit account-mismatch failures are already
          // authoritative and must not adopt a different active account.
          void verifyLiveSession(true);
        }
        return false;
      }
    },
    [
      purgePendingDeletionLocalData,
      submitPendingDeletion,
      suspendCurrentAccountWork,
      verifyLiveSession,
    ],
  );

  const signup = useCallback(
    async (email: string, password: string, username: string): Promise<boolean> => {
      const normalizedEmail = normalizeEmail(email);
      const normalizedUsername = normalizeUsername(username);
      const passwordError = validatePassword(password);
      if (!isValidUsername(normalizedUsername)) {
        setError(USERNAME_REQUIREMENTS);
        return false;
      }
      if (!normalizedEmail || passwordError) {
        setError(passwordError || "Enter a valid email address.");
        return false;
      }
      const generation = ++authGenerationRef.current;
      let authenticatedUserId: string | null = null;
      let createdAccountId: string | null = null;
      // Keep only non-secret recovery metadata if account.create succeeds
      // remotely but its response, or the next session request, is lost.
      const pending = { email: normalizedEmail, name: "", username: normalizedUsername };
      writePendingSignup(pending);
      setPendingSignup(pending);
      setError(null);
      setIsLoading(true);
      await suspendCurrentAccountWork();

      try {
        try {
          const created = await callAccount(() =>
            account.create("unique()", normalizedEmail, password, normalizedUsername),
          );
          createdAccountId = created.$id;
        } catch (createError: unknown) {
          // A prior attempt might have committed before its response was lost.
          // A 409 is NOT proof of ownership: the session must still authenticate.
          if ((createError as { code?: number } | null)?.code !== 409) {
            throw createError;
          }
        }

        // Appwrite may have created a session alongside the account. Reuse it
        // only if account.get proves it belongs to this email; otherwise the
        // guarded helper switches sessions without adopting the wrong owner.
        const reusedSession = await createSessionOrReuseMatching(
          normalizedEmail,
          password,
        );
        const resolved =
          reusedSession ?? (await callAccount(() => account.get()));
        authenticatedUserId = resolved.$id;
        if (
          normalizeEmail(resolved.email) !== normalizedEmail ||
          (createdAccountId && createdAccountId !== resolved.$id)
        ) {
          throw new ActiveSessionAccountMismatchError();
        }
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }

        const deletionIntent = readAccountDeletionIntent();
        if (deletionIntent?.userId === resolved.$id) {
          await submitPendingDeletion(resolved.$id);
          return false;
        }

        const pendingWithOwner = { ...pending, userId: resolved.$id };
        writePendingSignup(pendingWithOwner);
        setPendingSignup(pending);
        scopeAccountWork(resolved.$id);

        // The username belongs to signup, not a later Explore prompt. Verify
        // the existing owner profile before writes (idempotent 409 recovery),
        // and preserve the server-side unique constraint as the final arbiter.
        const { fetchMyProfile, createOrUpdateProfile } = await import("../lib/social");
        const existingProfile = await fetchMyProfile(resolved.$id);
        let profile = existingProfile;
        if (profile && profile.user_id !== resolved.$id) {
          throw new ActiveSessionAccountMismatchError();
        }
        if (profile && profile.username !== normalizedUsername) {
          throw new Error("This account already has a username. Use Sign In.");
        }
        if (!profile) {
          profile = await createOrUpdateProfile({
            userId: resolved.$id,
            username: normalizedUsername,
            displayName: resolved.name || normalizedUsername,
            avatarFileId: "",
            bio: "",
          }, { queueOnTransient: false });
        }
        if (!isMountedRef.current || generation !== authGenerationRef.current) return false;
        const { writeCachedOwnProfile } = await import("../lib/profileCache");
        writeCachedOwnProfile(resolved.$id, profile);
        clearPendingSignup();
        setPendingSignup(null);
        writeCachedUser(resolved);
        setUser(resolved);
        setError(null);
        setIsLoading(false);
        broadcastAuth("login");
        return true;
      } catch (signupError: unknown) {
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }
        if (authenticatedUserId) scopeAccountWork(null);
        const code = (signupError as { code?: number } | null)?.code;
        setError(
          signupError instanceof ActiveSessionAccountMismatchError
            ? signupError.message
            : code === 409 && authenticatedUserId
              ? "That username is already taken. Choose another."
              : signupError instanceof Error && signupError.message === "This account already has a username. Use Sign In."
                ? signupError.message
                : code === 401 || code === 409
                ? "Could not sign in with these credentials. If you already have an account, use Sign In."
                : authenticatedUserId
                  ? "Your account exists, but username setup did not finish. Retry sign-up to continue."
                  : signupError instanceof Error
                    ? signupError.message
                    : "Could not create account. Try again.",
        );
        setIsLoading(false);
        return false;
      }
    },
    [submitPendingDeletion, suspendCurrentAccountWork],
  );

  const logout = useCallback(async (): Promise<boolean> => {
    const generation = ++authGenerationRef.current;
    setError(null);
    setIsLoading(true);
    await suspendCurrentAccountWork();
    try {
      await callAccount(() => account.deleteSession("current"));
      if (!isMountedRef.current || generation !== authGenerationRef.current) {
        return false;
      }
      scopeAccountWork(null);
      clearCachedUser();
      if (userId) {
        try {
          const [queue, shared, ownerPending] = await Promise.all([
            import("../lib/taskShareQueue"), import("./useSharedTasks"),
            import("../lib/ownerCompletionPending"),
          ]);
          queue.clearSharedCompletionQueue(userId);
          shared.clearSharedTaskCache(userId);
          ownerPending.clearOwnerCompletionPending(userId);
        } catch (error) {
          console.warn("[AuthProvider] Shared cache logout cleanup failed:", error);
        }
      }
      setUser(null);
      setIsLoading(false);
      broadcastAuth("logout");
      return true;
    } catch (logoutError: unknown) {
      if (!isMountedRef.current || generation !== authGenerationRef.current) {
        return false;
      }
      const message =
        logoutError instanceof Error ? logoutError.message : "Logout failed";
      setError(message);
      setIsLoading(false);
      void verifyLiveSession(true);
      return false;
    }
  }, [suspendCurrentAccountWork, verifyLiveSession, userId]);

  const deleteAccount = useCallback(
    async (confirmation: string): Promise<boolean> => {
      const deletingUser = user;
      if (!deletingUser) {
        setError("No signed-in account to delete.");
        return false;
      }
      if (confirmation !== "DELETE") {
        setError("Type DELETE to confirm account deletion.");
        return false;
      }

      ++authGenerationRef.current;
      setError(null);
      writeAccountDeletionIntent(deletingUser.$id, deletingUser.email);
      broadcastAuth("deletion_pending", deletingUser.$id);
      return submitPendingDeletion(deletingUser.$id);
    },
    [submitPendingDeletion, user],
  );

  const updateEmail = useCallback(
    async (newEmail: string, password: string): Promise<boolean> => {
      const generation = authGenerationRef.current;
      setError(null);
      try {
        await callAccount(() => account.updateEmail(newEmail, password));
        const resolved = await callAccount(() => account.get());
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        return true;
      } catch (updateError: unknown) {
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }
        const message =
          updateError instanceof Error
            ? updateError.message
            : "Failed to update email";
        setError(message);
        return false;
      }
    },
    [],
  );

  const updatePassword = useCallback(
    async (newPassword: string, oldPassword: string): Promise<boolean> => {
      setError(null);
      try {
        await callAccount(() =>
          account.updatePassword(newPassword, oldPassword),
        );
        return true;
      } catch (updateError: unknown) {
        if (!isMountedRef.current) return false;
        const message =
          updateError instanceof Error
            ? updateError.message
            : "Failed to update password";
        setError(message);
        return false;
      }
    },
    [],
  );

  const refreshEmailVerificationStatus = useCallback(async (): Promise<boolean> => {
    const expectedId = user?.$id;
    if (!expectedId) throw new Error("Sign in to manage email verification.");
    const generation = authGenerationRef.current;
    const live = await callAccount(() => account.get());
    if (live.$id !== expectedId || generation !== authGenerationRef.current ||
        !isMountedRef.current) {
      throw new Error("Account changed. Please sign in again.");
    }
    writeCachedUser(live);
    setUser(live);
    return live.emailVerification === true;
  }, [user?.$id]);

  const requestEmailVerification = useCallback(async (): Promise<void> => {
    const expectedId = user?.$id;
    if (!expectedId) throw new Error("Sign in to manage email verification.");
    const generation = authGenerationRef.current;
    const verified = await refreshEmailVerificationStatus();
    if (verified) return;
    // An account may change while checking verification; do not send to a
    // different live session just because the previous user was unverified.
    if (!isMountedRef.current || generation !== authGenerationRef.current) {
      throw new Error("Account changed. Please sign in again.");
    }
    const live = await callAccount(() => account.get());
    if (live.$id !== expectedId || generation !== authGenerationRef.current) {
      throw new Error("Account changed. Please sign in again.");
    }
    const redirect = new URL("/verify-email", window.location.origin).toString();
    await callAccount(() => account.createVerification(redirect));
  }, [refreshEmailVerificationStatus, user?.$id]);

  const ownerId = user?.$id;
  const completeEmailVerification = useCallback(async (
    targetUserId: string,
    secret: string,
  ): Promise<void> => {
    if (!targetUserId || !secret) throw new Error("Invalid verification link.");
    const generation = authGenerationRef.current;
    let currentId: string | null = null;
    try {
      const live = await callAccount(() => account.get());
      currentId = live.$id;
    } catch (error) {
      if (!isUnauthorizedError(error)) throw error;
    }
    if (!isMountedRef.current || generation !== authGenerationRef.current ||
        (ownerId && ownerId !== targetUserId) ||
        (currentId && currentId !== targetUserId) ||
        (currentId && ownerId && currentId !== ownerId)) {
      throw new Error("Verification belongs to another signed-in account.");
    }
    await callAccount(() => account.updateVerification(targetUserId, secret));
    // Never replace another user's local identity after an async callback.
    if (currentId === targetUserId && ownerId === targetUserId &&
        generation === authGenerationRef.current && isMountedRef.current) {
      const verified = await callAccount(() => account.get());
      if (verified.$id === targetUserId && generation === authGenerationRef.current &&
          isMountedRef.current) {
        writeCachedUser(verified);
        setUser(verified);
      }
    }
  }, [ownerId]);

  const requestPasswordRecovery = useCallback(
    async (email: string): Promise<boolean> => {
      const generation = ++recoveryGenerationRef.current;
      setRecoveryError(null);
      setRecoverySuccess(null);
      setRecoveryLoading(true);
      try {
        const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim();
        const origin = (configuredOrigin || window.location.origin).replace(
          /\/$/,
          "",
        );
        await callAccount(() =>
          account.createRecovery(email, `${origin}/reset-password`),
        );
        if (
          !isMountedRef.current ||
          generation !== recoveryGenerationRef.current
        ) {
          return false;
        }
        setRecoverySuccess("requested");
        setRecoveryLoading(false);
        return true;
      } catch (recoveryRequestError: unknown) {
        if (
          !isMountedRef.current ||
          generation !== recoveryGenerationRef.current
        ) {
          return false;
        }
        setRecoveryError(
          recoveryRequestError instanceof Error
            ? recoveryRequestError.message
            : "Could not request a password reset.",
        );
        setRecoveryLoading(false);
        return false;
      }
    },
    [],
  );

  const completePasswordRecovery = useCallback(
    async (
      userId: string,
      secret: string,
      password: string,
    ): Promise<boolean> => {
      const generation = ++recoveryGenerationRef.current;
      setRecoveryError(null);
      setRecoverySuccess(null);
      setRecoveryLoading(true);
      try {
        await callAccount(() =>
          account.updateRecovery(userId, secret, password),
        );
        if (
          !isMountedRef.current ||
          generation !== recoveryGenerationRef.current
        ) {
          return false;
        }
        setRecoverySuccess("completed");
        setRecoveryLoading(false);
        return true;
      } catch (recoveryCompletionError: unknown) {
        if (
          !isMountedRef.current ||
          generation !== recoveryGenerationRef.current
        ) {
          return false;
        }
        setRecoveryError(
          recoveryCompletionError instanceof Error
            ? recoveryCompletionError.message
            : "Could not reset the password.",
        );
        setRecoveryLoading(false);
        return false;
      }
    },
    [],
  );

  const retry = useCallback(async () => {
    if (getConnectivitySnapshot().status === "offline") {
      markConnectivityChecking("manual-retry");
    }
    await verifyLiveSession();
  }, [verifyLiveSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        recoveryLoading,
        recoveryError,
        recoverySuccess,
        isOffline,
        pendingSignup,
        login,
        signup,
        requestEmailVerification,
        refreshEmailVerificationStatus,
        completeEmailVerification,
        requestPasswordRecovery,
        completePasswordRecovery,
        logout,
        deleteAccount,
        updateEmail,
        updatePassword,
        retry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
