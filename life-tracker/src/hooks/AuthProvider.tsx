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
import {
  isValidUsername,
  normalizeUsername,
  USERNAME_REQUIREMENTS,
} from "../lib/profileUsername";

const AUTH_BROADCAST_KEY = "mosaic_auth_broadcast";
const LAST_KNOWN_USER_KEY = "mosaic_last_known_user";
const PENDING_SIGNUP_KEY = "mosaic_pending_signup";

type AuthBroadcast = { type: "login" | "logout"; at: number };
interface PendingSignupRecord {
  email: string;
  name: string;
  userId?: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
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

function pendingSignupMatchesUser(
  pending: PendingSignupRecord | null,
  user: Models.User<Models.Preferences>,
): boolean {
  if (!pending) return false;
  if (pending.userId && pending.userId === user.$id) return true;
  return normalizeEmail(pending.email) === normalizeEmail(user.email);
}

function broadcastAuth(type: "login" | "logout") {
  try {
    const payload: AuthBroadcast = { type, at: Date.now() };
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
      if (initialUser && pendingSignupMatchesUser(readPendingSignup(), initialUser)) {
        clearCachedUser();
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
  } | null>(() => {
    const pending = readPendingSignup();
    return pending ? { email: pending.email, name: pending.name } : null;
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
      const pending = readPendingSignup();
      if (pendingSignupMatchesUser(pending, resolved)) {
        const nextPending = {
          email: normalizeEmail(resolved.email),
          name: pending?.name || resolved.name || "",
          userId: resolved.$id,
        };
        writePendingSignup(nextPending);
        clearCachedUser();
        scopeAccountWork(null);
        setPendingSignup({
          email: nextPending.email,
          name: nextPending.name,
        });
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
        // Only account.get() is authoritative evidence that the browser's
        // session has gone away. Invalidate every older auth operation before
        // publishing the signed-out state.
        authGenerationRef.current += 1;
        scopeAccountWork(null);
        clearCachedUser();
        setUser(null);
        setError(
          sessionExpiredOn401
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
  }, []);

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

        // A completed login/signup clears pending onboarding before broadcast.
        const pending = readPendingSignup();
        setPendingSignup(
          pending ? { email: pending.email, name: pending.name } : null,
        );
        // Another tab already wrote the authenticated identity. Use it
        // immediately, then reconcile the live session in the background.
        setUser(readCachedUser());
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
    scopeAccountWork(null);
    if (!userId) return;
    try {
      const { suspendSyncOwner } = await import("../db/sync");
      await suspendSyncOwner(userId);
    } catch (syncError) {
      console.warn("[AuthProvider] Sync suspension failed:", syncError);
    }
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
        await callAccount(() =>
          account.createEmailPasswordSession(normalizedEmail, password),
        );
        const resolved = await callAccount(() => account.get());
        authenticatedUserId = resolved.$id;
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }

        scopeAccountWork(resolved.$id);
        const { fetchMyProfile } = await import("../lib/social");
        const profile = await fetchMyProfile(resolved.$id);
        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }
        if (!profile) {
          const nextPending = {
            email: normalizeEmail(resolved.email),
            name: resolved.name || "",
            userId: resolved.$id,
          };
          writePendingSignup(nextPending);
          clearCachedUser();
          scopeAccountWork(null);
          setPendingSignup({
            email: nextPending.email,
            name: nextPending.name,
          });
          setUser(null);
          setError("Choose a username to finish setting up your account.");
          setIsLoading(false);
          return false;
        }

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
        const message =
          loginError instanceof Error ? loginError.message : "Login failed";
        setError(message);
        setIsLoading(false);
        if (!authenticatedUserId) {
          void verifyLiveSession(true);
        }
        return false;
      }
    },
    [suspendCurrentAccountWork, verifyLiveSession],
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      username: string,
    ): Promise<boolean> => {
      const generation = ++authGenerationRef.current;
      const normalizedEmail = normalizeEmail(email);
      const normalizedName = name.trim();
      const normalizedUsername = normalizeUsername(username);
      let authenticatedUserId: string | null = null;

      if (!isValidUsername(normalizedUsername)) {
        setError(USERNAME_REQUIREMENTS);
        return false;
      }

      const initialPending = {
        email: normalizedEmail,
        name: normalizedName,
      };
      writePendingSignup(initialPending);
      setPendingSignup(initialPending);
      setError(null);
      setIsLoading(true);
      await suspendCurrentAccountWork();

      try {
        try {
          await callAccount(() =>
            account.create("unique()", normalizedEmail, password, normalizedName),
          );
        } catch (createError: unknown) {
          const code = (createError as { code?: number } | null)?.code;
          if (code !== 409) {
            throw createError;
          }
          // A previous attempt may have created the account before its response
          // was lost. Prove ownership with the supplied password and resume.
        }

        try {
          await callAccount(() => account.deleteSession("current"));
        } catch {
          // No current session is the normal fresh-signup case.
        }

        await callAccount(() =>
          account.createEmailPasswordSession(normalizedEmail, password),
        );
        const resolved = await callAccount(() => account.get());
        authenticatedUserId = resolved.$id;

        if (
          normalizeEmail(resolved.email) !== normalizedEmail ||
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          if (normalizeEmail(resolved.email) !== normalizedEmail) {
            throw new Error("Signup session does not match the requested account.");
          }
          return false;
        }

        const pendingWithOwner = {
          email: normalizedEmail,
          name: normalizedName || resolved.name || "",
          userId: resolved.$id,
        };
        writePendingSignup(pendingWithOwner);
        setPendingSignup({
          email: pendingWithOwner.email,
          name: pendingWithOwner.name,
        });
        scopeAccountWork(resolved.$id);

        const { createOrUpdateProfile, fetchMyProfile } = await import(
          "../lib/social"
        );
        const existingProfile = await fetchMyProfile(resolved.$id);
        let profile = existingProfile;
        if (!profile) {
          profile = await createOrUpdateProfile(
            {
              userId: resolved.$id,
              username: normalizedUsername,
              displayName: normalizedName || resolved.name || normalizedUsername,
              avatarFileId: "",
              bio: "",
            },
            { queueOnTransient: false },
          );
        }

        if (!isMountedRef.current || generation !== authGenerationRef.current) {
          return false;
        }

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
        if (authenticatedUserId) {
          scopeAccountWork(null);
        }
        const code = (signupError as { code?: number } | null)?.code;
        const message =
          code === 409
            ? "That username is already taken."
            : authenticatedUserId
              ? "Your account is ready, but profile setup did not finish. Retry signup to continue."
              : signupError instanceof Error
                ? signupError.message
                : "Signup failed";
        setError(message);
        setIsLoading(false);
        return false;
      }
    },
    [suspendCurrentAccountWork],
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
  }, [suspendCurrentAccountWork, verifyLiveSession]);

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
        requestPasswordRecovery,
        completePasswordRecovery,
        logout,
        updateEmail,
        updatePassword,
        retry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
