import { useState, useEffect, useCallback } from 'react';
import { account } from '../lib/appwrite';
import type { Models } from 'appwrite';

export interface AuthState {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    let isMounted = true;
    account.get().then(
      (user) => {
        if (!isMounted) return;
        setState({ user, isLoading: false, error: null });
      },
      () => {
        if (!isMounted) return;
        setState({ user: null, isLoading: false, error: null });
      }
    );
    return () => { isMounted = false; };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      try {
        await account.deleteSession('current');
      } catch {
        // Silent session cleanup: swallowing error is intentional and required per §6
      }
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      setState({ user, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState(s => ({ ...s, isLoading: false, error: message }));
      return false;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      await account.create('unique()', email, password, name);
      try {
        await account.createEmailPasswordSession(email, password);
      } catch (sessionError: unknown) {
        const msg = sessionError instanceof Error ? sessionError.message : '';
        if (!msg.includes('already active') && !msg.includes('prohibited')) {
          throw sessionError;
        }
      }
      const user = await account.get();
      setState({ user, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setState(s => ({ ...s, isLoading: false, error: message }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      await account.deleteSession('current');
      setState({ user: null, isLoading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setState(s => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  const updateEmail = useCallback(async (newEmail: string, password: string): Promise<boolean> => {
    setState(s => ({ ...s, error: null }));
    try {
      await account.updateEmail(newEmail, password);
      const user = await account.get();
      setState({ user, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update email';
      setState(s => ({ ...s, error: message }));
      return false;
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string, oldPassword: string): Promise<boolean> => {
    setState(s => ({ ...s, error: null }));
    try {
      await account.updatePassword(newPassword, oldPassword);
      setState(s => ({ ...s, error: null }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setState(s => ({ ...s, error: message }));
      return false;
    }
  }, []);

  return { ...state, login, signup, logout, updateEmail, updatePassword };
}