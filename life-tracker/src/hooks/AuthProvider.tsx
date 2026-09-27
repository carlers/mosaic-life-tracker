import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { account } from '../lib/appwrite';
import {
  AUTH_UNAUTHORIZED_EVENT,
  isUnauthorizedError,
} from '../lib/authEvents';
import { AuthContext } from './authContext';
import type { Models } from 'appwrite';
import { syncPostHogIdentity } from '../lib/posthog';
import { waitForDatabaseReady } from '../lib/databaseBootstrap';
import { markStartup } from '../lib/startupMetrics';
import { scopeSyncStatusToUser } from '../lib/syncStatus';
import {
  getConnectivitySnapshot,
  markConnectivityChecking,
  reportConnectivityResult,
} from '../lib/connectivity';
import { useConnectivity } from './useConnectivity';

const AUTH_BROADCAST_KEY = 'mosaic_auth_broadcast';
const LAST_KNOWN_USER_KEY = 'mosaic_last_known_user';

type AuthBroadcast = { type: 'login' | 'logout'; at: number };

function broadcastAuth(type: 'login' | 'logout') {
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
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<Models.User<Models.Preferences>>;
    if (typeof candidate.$id !== 'string' || candidate.$id.length === 0) {
      return null;
    }
    if (typeof candidate.email !== 'string') return null;
    if (!candidate.prefs || typeof candidate.prefs !== 'object') return null;
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
    readCachedUser
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectivity = useConnectivity();
  const isOffline = connectivity.status === 'offline';
  const isMountedRef = useRef(true);
  const resolveInFlightGenerationRef = useRef<number | null>(null);
  const authGenerationRef = useRef(0);
  const userId = user?.$id ?? null;

  useEffect(() => {
    markStartup('auth:resolved');
  }, []);

  useEffect(() => {
    scopeSyncStatusToUser(userId);
  }, [userId]);

  useEffect(() => {
    syncPostHogIdentity(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void import('../pages/HomePage').catch((loadError) => {
      console.warn('[AuthProvider] Home preload failed:', loadError);
    });
  }, [userId]);

  // Sync waits for proven Appwrite reachability, not navigator.onLine.
  useEffect(() => {
    if (
      isLoading ||
      connectivity.status !== 'online' ||
      !userId
    ) {
      return;
    }
    let active = true;
    void waitForDatabaseReady()
      .then(() => import('../db/sync'))
      .then(({ initializeSync }) => {
        if (!active) return;
        return initializeSync(userId);
      })
      .catch((syncError) => {
        if (active) {
          console.error('[AuthProvider] Post-auth sync failed:', syncError);
        }
      });
    return () => {
      active = false;
    };
  }, [connectivity.status, isLoading, userId]);

  const verifyLiveSession = useCallback(async () => {
    const generation = authGenerationRef.current;
    if (resolveInFlightGenerationRef.current === generation) return;

    // Browser-offline is still a useful hard negative. The important change
    // is that browser-online is no longer treated as proof of reachability.
    if (
      typeof navigator !== 'undefined' &&
      navigator.onLine === false
    ) {
      return;
    }

    resolveInFlightGenerationRef.current = generation;
    try {
      const resolved = await callAccount(() => account.get());
      if (
        !isMountedRef.current ||
        generation !== authGenerationRef.current
      ) {
        return;
      }
      writeCachedUser(resolved);
      setUser(resolved);
      setError(null);
    } catch (resolveError) {
      if (
        !isMountedRef.current ||
        generation !== authGenerationRef.current
      ) {
        return;
      }
      if (isUnauthorizedError(resolveError)) {
        clearCachedUser();
        setUser(null);
        setError(null);
      } else {
        // Keep the cached identity/local app. Connectivity now communicates
        // reachability; a failed verification is not a rendering gate.
        setError(
          resolveError instanceof Error
            ? resolveError.message
            : 'Could not reach server.'
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
    if (connectivity.status !== 'checking') return;
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
        if (parsed.type === 'logout') {
          clearCachedUser();
          setUser(null);
          setError(null);
          setIsLoading(false);
          return;
        }

        // Another tab already wrote the authenticated identity. Use it
        // immediately, then reconcile the live session in the background.
        setUser(readCachedUser());
        setError(null);
        setIsLoading(false);
        if (getConnectivitySnapshot().status !== 'offline') {
          markConnectivityChecking('cross-tab-login');
        }
      } catch {
        // Ignore malformed payloads.
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!isMountedRef.current) return;
      authGenerationRef.current += 1;
      clearCachedUser();
      setUser(null);
      setError('Your session has expired. Please sign in again.');
      setIsLoading(false);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const generation = ++authGenerationRef.current;
      setError(null);
      setIsLoading(true);
      try {
        try {
          await callAccount(() => account.deleteSession('current'));
        } catch {
          // Session may not exist or the network may be unavailable. The
          // create-session call below remains the authoritative login action.
        }
        await callAccount(() =>
          account.createEmailPasswordSession(email, password)
        );
        const resolved = await callAccount(() => account.get());
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        setError(null);
        setIsLoading(false);
        broadcastAuth('login');
        return true;
      } catch (loginError: unknown) {
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        const message =
          loginError instanceof Error ? loginError.message : 'Login failed';
        setError(message);
        setIsLoading(false);
        return false;
      }
    },
    []
  );

  const signup = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      const generation = ++authGenerationRef.current;
      setError(null);
      setIsLoading(true);
      try {
        await callAccount(() => account.create('unique()', email, password, name));
        try {
          await callAccount(() =>
            account.createEmailPasswordSession(email, password)
          );
        } catch (sessionError: unknown) {
          const msg =
            sessionError instanceof Error ? sessionError.message : '';
          if (!msg.includes('already active') && !msg.includes('prohibited')) {
            throw sessionError;
          }
        }
        const resolved = await callAccount(() => account.get());
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        setError(null);
        setIsLoading(false);
        broadcastAuth('login');
        return true;
      } catch (signupError: unknown) {
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        const message =
          signupError instanceof Error ? signupError.message : 'Signup failed';
        setError(message);
        setIsLoading(false);
        return false;
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<boolean> => {
    const generation = ++authGenerationRef.current;
    setError(null);
    setIsLoading(true);
    try {
      await callAccount(() => account.deleteSession('current'));
      if (
        !isMountedRef.current ||
        generation !== authGenerationRef.current
      ) {
        return false;
      }
      clearCachedUser();
      setUser(null);
      setIsLoading(false);
      broadcastAuth('logout');
      return true;
    } catch (logoutError: unknown) {
      if (
        !isMountedRef.current ||
        generation !== authGenerationRef.current
      ) {
        return false;
      }
      const message =
        logoutError instanceof Error ? logoutError.message : 'Logout failed';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const updateEmail = useCallback(
    async (newEmail: string, password: string): Promise<boolean> => {
      const generation = authGenerationRef.current;
      setError(null);
      try {
        await callAccount(() => account.updateEmail(newEmail, password));
        const resolved = await callAccount(() => account.get());
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        return true;
      } catch (updateError: unknown) {
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        const message =
          updateError instanceof Error
            ? updateError.message
            : 'Failed to update email';
        setError(message);
        return false;
      }
    },
    []
  );

  const updatePassword = useCallback(
    async (newPassword: string, oldPassword: string): Promise<boolean> => {
      setError(null);
      try {
        await callAccount(() =>
          account.updatePassword(newPassword, oldPassword)
        );
        return true;
      } catch (updateError: unknown) {
        if (!isMountedRef.current) return false;
        const message =
          updateError instanceof Error
            ? updateError.message
            : 'Failed to update password';
        setError(message);
        return false;
      }
    },
    []
  );

  const retry = useCallback(async () => {
    if (getConnectivitySnapshot().status === 'offline') {
      markConnectivityChecking('manual-retry');
    }
    await verifyLiveSession();
  }, [verifyLiveSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isOffline,
        login,
        signup,
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
