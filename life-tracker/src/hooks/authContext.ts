import { createContext } from 'react';
import type { Models } from 'appwrite';

export interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updateEmail: (newEmail: string, password: string) => Promise<boolean>;
  updatePassword: (newPassword: string, oldPassword: string) => Promise<boolean>;
  retry: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);