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

type AuthBroadcast = { type: 'login' | 'logout'; at: number };

function broadcastAuth(type: 'login' | 'logout') {
  try {
    const payload: AuthBroadcast = { type, at: Date.now() };
    localStorage.setItem(AUTH_BROADCAST_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
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

  const resolveInitialUser = useCallback(async () => {
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
      setUser(u);
      setError(null);
      setIsOffline(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (isUnauthorizedError(err)) {
        setUser(null);
        setError(null);
        setIsOffline(false);
      } else if (isNetworkError(err)) {
        setUser(null);
        setError(
          err instanceof Error ? err.message : 'Could not reach server.'
        );
        setIsOffline(true);
      } else {
        setUser(null);
        setError(
          err instanceof Error ? err.message : 'Could not verify session.'
        );
        setIsOffline(true);
      }
    } finally {
      resolveInFlightRef.current = false;
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => {
      if (isMountedRef.current) {
        resolveInitialUser();
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
          setUser(null);
          setError(null);
          setIsOffline(false);
        } else if (parsed.type === 'login') {
          // Another tab logged in — re-resolve to pick up the new session.
          // The in-flight guard makes this idempotent against an ongoing
          // mount resolution.
          resolveInitialUser();
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
      setUser(null);
      setError('Your session has expired. Please sign in again.');
      setIsOffline(false);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  // Retry the initial check when the network comes back and we have no user.
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (!user && isMountedRef.current) {
        resolveInitialUser();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, resolveInitialUser]);

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

  const retry = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await resolveInitialUser();
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