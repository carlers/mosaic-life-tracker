import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';

/**
 * Public auth hook. Consumers keep importing `useAuth` from this file
 * exactly as before — the return shape is unchanged for the seven
 * original fields ({ user, isLoading, error, login, signup, logout,
 * updateEmail, updatePassword }).
 *
 * Two new fields are exposed for AppLayout's offline/retry handling:
 *   - `isOffline`: true when the mount-time session check failed with a
 *     network/unknown error (i.e. "couldn't check", not "definitely out").
 *   - `retry()`: re-run the session check.
 *
 * MUST be called inside <AuthProvider>, which is wired in main.tsx.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useAuth must be used within an <AuthProvider>. ' +
        'Check that <AuthProvider> wraps <App /> in main.tsx.'
    );
  }
  return ctx;
}