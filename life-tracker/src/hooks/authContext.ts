import { createContext } from "react";
import type { Models } from "appwrite";

export interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  error: string | null;
  recoveryLoading: boolean;
  recoveryError: string | null;
  recoverySuccess: "requested" | "completed" | null;
  /**
   * True when the mount-time session check failed with a network error,
   * timeout, or offline state. This is deliberately distinct from
   * "definitely not logged in." Consumers MUST render a retry/offline
   * screen when `isOffline` is true rather than redirecting to /login.
   */
  isOffline: boolean;
  pendingSignup: { email: string; name: string } | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    name: string,
    username: string,
  ) => Promise<boolean>;
  requestPasswordRecovery: (email: string) => Promise<boolean>;
  completePasswordRecovery: (
    userId: string,
    secret: string,
    password: string,
  ) => Promise<boolean>;
  /**
   * Deletes the current Appwrite session.
   *
   * @returns `true` if the session was successfully deleted and the user
   *          is now unauthenticated. `false` if the session deletion failed
   *          (network error, already deleted, etc.) — in that case the
   *          local `user` state is preserved and the caller must NOT
   *          navigate away.
   *
   * Callers MUST gate navigation on the return value:
   *   const ok = await logout();
   *   if (ok) navigate('/login', { replace: true });
   */
  logout: () => Promise<boolean>;
  updateEmail: (newEmail: string, password: string) => Promise<boolean>;
  updatePassword: (
    newPassword: string,
    oldPassword: string,
  ) => Promise<boolean>;
  /**
   * Re-runs the mount-time session check. Safe to call from the retry
   * screen; the provider holds an in-flight guard so concurrent calls
   * are idempotent.
   */
  retry: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
