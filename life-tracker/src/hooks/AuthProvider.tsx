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

function browserIsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isNetworkError(err: unknown): boolean {
  if (browserIsOffline()) return true;
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

interface InitialAuthState {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
}

function getInitialAuthState(): InitialAuthState {
  if (!browserIsOffline()) {
    return { user: null, isLoading: true, isOffline: false, error: null };
  }
  const cached = readCachedUser();
  return {
    user: cached,
    isLoading: false,
    isOffline: true,
    error: cached ? null : 'Could not reach server.',
  };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const initialStateRef = useRef<InitialAuthState | null>(null);
  initialStateRef.current ??= getInitialAuthState();
  const initial = initialStateRef.current;

  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    initial.user
  );
  const [isLoading, setIsLoading] = useState(initial.isLoading);
  const [error, setError] = useState<string | null>(initial.error);
  const [isOffline, setIsOffline] = useState(initial.isOffline);
  const isMountedRef = useRef(true);
  const resolveInFlightGenerationRef = useRef<number | null>(null);
  const authGenerationRef = useRef(0);
  const userId = user?.$id ?? null;

  useEffect(() => {
    if (!isLoading) syncPostHogIdentity(userId);
  }, [isLoading, userId]);

  // Preload Home as soon as we have a usable identity. The production
  // service worker precaches the chunk, so this is also cheap on offline
  // relaunch and overlaps local database opening.
  useEffect(() => {
    if (!userId) return;
    void import('../pages/HomePage').catch((loadError) => {
      console.warn('[AuthProvider] Home preload failed:', loadError);
    });
  }, [userId]);

  // AuthProvider owns identity. Sync starts only after a live online identity
  // and the local DB are both ready, and receives the owner id explicitly.
  useEffect(() => {
    if (isLoading || isOffline || !userId) return;
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
  }, [isLoading, isOffline, userId]);

  const resolveInitialUser = useCallback(
    async (hydrateOnNetworkError: boolean) => {
      const generation = authGenerationRef.current;
      if (resolveInFlightGenerationRef.current === generation) return;
      resolveInFlightGenerationRef.current = generation;
      try {
        if (browserIsOffline()) {
          if (!isMountedRef.current || generation !== authGenerationRef.current) {
            return;
          }
          if (hydrateOnNetworkError) {
            const cached = readCachedUser();
            setUser(cached);
            setError(cached ? null : 'Could not reach server.');
          }
          setIsOffline(true);
          return;
        }

        const resolved = await account.get();
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        setError(null);
        setIsOffline(false);
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
          setIsOffline(false);
        } else if (isNetworkError(resolveError)) {
          const message =
            resolveError instanceof Error
              ? resolveError.message
              : 'Could not reach server.';
          if (hydrateOnNetworkError) {
            setUser(readCachedUser());
          }
          setError(message);
          setIsOffline(true);
        } else {
          const message =
            resolveError instanceof Error
              ? resolveError.message
              : 'Could not verify session.';
          if (hydrateOnNetworkError) setUser(null);
          setError(message);
          setIsOffline(true);
        }
      } finally {
        if (resolveInFlightGenerationRef.current === generation) {
          resolveInFlightGenerationRef.current = null;
        }
        if (
          isMountedRef.current &&
          generation === authGenerationRef.current
        ) {
          setIsLoading(false);
          markStartup('auth:resolved');
        }
      }
    },
    []
  );

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => {
      if (isMountedRef.current) void resolveInitialUser(true);
    });
    return () => {
      isMountedRef.current = false;
    };
  }, [resolveInitialUser]);

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
          setIsOffline(false);
          setIsLoading(false);
          return;
        }
        if (browserIsOffline()) {
          const cached = readCachedUser();
          setUser(cached);
          setIsOffline(true);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        void resolveInitialUser(false);
      } catch {
        // Ignore malformed payloads.
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [resolveInitialUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!isMountedRef.current) return;
      authGenerationRef.current += 1;
      clearCachedUser();
      setUser(null);
      setError('Your session has expired. Please sign in again.');
      setIsOffline(false);
      setIsLoading(false);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (!isMountedRef.current || !isOffline) return;
      authGenerationRef.current += 1;
      setIsLoading(false);
      void resolveInitialUser(false);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOffline, resolveInitialUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const generation = ++authGenerationRef.current;
      setError(null);
      setIsLoading(true);
      try {
        try {
          await account.deleteSession('current');
        } catch {
          // Session may not exist.
        }
        await account.createEmailPasswordSession(email, password);
        const resolved = await account.get();
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        setIsLoading(false);
        setIsOffline(false);
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
        const resolved = await account.get();
        if (
          !isMountedRef.current ||
          generation !== authGenerationRef.current
        ) {
          return false;
        }
        writeCachedUser(resolved);
        setUser(resolved);
        setIsLoading(false);
        setIsOffline(false);
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
      await account.deleteSession('current');
      if (
        !isMountedRef.current ||
        generation !== authGenerationRef.current
      ) {
        return false;
      }
      clearCachedUser();
      setUser(null);
      setIsLoading(false);
      setIsOffline(false);
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
        await account.updateEmail(newEmail, password);
        const resolved = await account.get();
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
        await account.updatePassword(newPassword, oldPassword);
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
    setIsLoading(true);
    authGenerationRef.current += 1;
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
