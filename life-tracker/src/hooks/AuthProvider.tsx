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

/**
 * OFF-1: reads the persisted last-known identity. Returns null on any
 * parse failure or shape failure — the caller falls back to the retry
 * screen rather than hydrating a malformed object.
 */
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

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  );
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const isMountedRef = useRef(true);
  const resolveInFlightRef = useRef(false);

  /**
   * Runs the session check.
   *
   * @param hydrateOnNetworkError OFF-1: when true (mount only), a network
   *   failure falls back to the persisted last-known identity so the app
   *   tree renders with the offline banner instead of the retry screen.
   *   Retry / login-broadcast / online-event callers pass false so a
   *   transient failure preserves the current in-memory state — the cache
   *   is cleared only on explicit logout and on a confirmed 401, never on
   *   a network error.
   */
  const resolveInitialUser = useCallback(
    async (hydrateOnNetworkError: boolean) => {
      if (resolveInFlightRef.current) {
        if (import.meta.env.DEV) {
          console.log('[AuthProvider] resolve skipped (in flight)');
        }
        return;
      }
      resolveInFlightRef.current = true;
      try {
        const u = await account.get();
        if (!isMountedRef.current) return;
        writeCachedUser(u);
        setUser(u);
        setError(null);
        setIsOffline(false);
      } catch (err) {
        if (!isMountedRef.current) return;
        if (isUnauthorizedError(err)) {
          clearCachedUser();
          setUser(null);
          setError(null);
          setIsOffline(false);
        } else if (isNetworkError(err)) {
          const message =
            err instanceof Error ? err.message : 'Could not reach server.';
          if (hydrateOnNetworkError) {
            const cached = readCachedUser();
            setUser(cached);
            setError(message);
            setIsOffline(true);
          }
          // Retry / refresh callers: preserve current state, no change.
        } else {
          const message =
            err instanceof Error
              ? err.message
              : 'Could not verify session.';
          if (hydrateOnNetworkError) {
            setUser(null);
            setError(message);
            setIsOffline(true);
          }
        }
      } finally {
        resolveInFlightRef.current = false;
        if (isMountedRef.current) setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => {
      if (isMountedRef.current) {
        resolveInitialUser(true);
      }
    });
    return () => {
      isMountedRef.current = false;
    };
  }, [resolveInitialUser]);

  // Cross-tab auth broadcast listener.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== AUTH_BROADCAST_KEY) return;
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as AuthBroadcast;
        if (parsed.type === 'logout') {
          clearCachedUser();
          setUser(null);
          setError(null);
          setIsOffline(false);
        } else if (parsed.type === 'login') {
          const online =
            typeof navigator !== 'undefined' ? navigator.onLine : true;
          if (online) {
            resolveInitialUser(false);
          }
          // Offline: keep current state (OFF-1 spec).
        }
      } catch {
        // Ignore malformed payloads.
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [resolveInitialUser]);

  // Global 401 handler.
  useEffect(() => {
    const handleUnauthorized = () => {
      if (!isMountedRef.current) return;
      clearCachedUser();
      setUser(null);
      setError('Your session has expired. Please sign in again.');
      setIsOffline(false);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  // When the network returns, re-resolve if we were in an offline state
  // (retry screen with no cached user OR hydrated cached user). Success
  // refreshes the identity and clears isOffline; a transient failure
  // leaves the current state untouched.
  useEffect(() => {
    const handleOnline = () => {
      if (!isMountedRef.current) return;
      if (isOffline) {
        resolveInitialUser(false);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOffline, resolveInitialUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);
      try {
        try {
          await account.deleteSession('current');
        } catch {
          // Silent — session may not exist. Required per §10.
        }
        await account.createEmailPasswordSession(email, password);
        const u = await account.get();
        if (!isMountedRef.current) return true;
        writeCachedUser(u);
        setUser(u);
        setIsLoading(false);
        setIsOffline(false);
        broadcastAuth('login');
        return true;
      } catch (err: unknown) {
        if (!isMountedRef.current) return false;
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        setIsLoading(false);
        return false;
      }
    },
    []
  );

  const signup = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);
      try {
        await account.create('unique()', email, password, name);
        try {
          await account.createEmailPasswordSession(email, password);
        } catch (sessionError: unknown) {
          const msg =
            sessionError instanceof Error ? sessionError.message : '';
          if (!msg.includes('already active') && !msg.includes('prohibited')) {
            throw sessionError;
          }
        }
        const u = await account.get();
        if (!isMountedRef.current) return true;
        writeCachedUser(u);
        setUser(u);
        setIsLoading(false);
        setIsOffline(false);
        broadcastAuth('login');
        return true;
      } catch (err: unknown) {
        if (!isMountedRef.current) return false;
        const message = err instanceof Error ? err.message : 'Signup failed';
        setError(message);
        setIsLoading(false);
        return false;
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    try {
      await account.deleteSession('current');
      if (!isMountedRef.current) return true;
      clearCachedUser();
      setUser(null);
      setIsLoading(false);
      setIsOffline(false);
      broadcastAuth('logout');
      return true;
    } catch (err: unknown) {
      if (!isMountedRef.current) return false;
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const updateEmail = useCallback(
    async (newEmail: string, password: string): Promise<boolean> => {
      setError(null);
      try {
        await account.updateEmail(newEmail, password);
        const u = await account.get();
        if (!isMountedRef.current) return true;
        writeCachedUser(u);
        setUser(u);
        return true;
      } catch (err: unknown) {
        if (!isMountedRef.current) return false;
        const message =
          err instanceof Error ? err.message : 'Failed to update email';
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
        await account.updatePassword(newPassword, oldPassword);
        return true;
      } catch (err: unknown) {
        if (!isMountedRef.current) return false;
        const message =
          err instanceof Error ? err.message : 'Failed to update password';
        setError(message);
        return false;
      }
    },
    []
  );

  // Retry preserves the current error message on failure — the resolve
  // path itself decides whether to clear or replace it.
  const retry = useCallback(async () => {
    setIsLoading(true);
    await resolveInitialUser(false);
  }, [resolveInitialUser]);

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
