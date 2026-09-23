import { createContext } from 'react';
import type {
  AppearanceMode,
  ResolvedAppearanceTheme,
} from '../lib/appearance';

export interface AppearanceContextValue {
  mode: AppearanceMode;
  resolvedTheme: ResolvedAppearanceTheme;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
}

export const AppearanceContext =
  createContext<AppearanceContextValue | null>(null);
