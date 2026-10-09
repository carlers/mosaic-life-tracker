import { createContext } from 'react';
import type {
  AppearanceMode,
  ResolvedAppearanceTheme,
} from '../lib/appearance';
import type { ContentWidthMode, SheetWidthMode } from '../lib/screenLayout';

export interface AppearanceContextValue {
  mode: AppearanceMode;
  resolvedTheme: ResolvedAppearanceTheme;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
  reduceAnimations: boolean;
  setReduceAnimations: (enabled: boolean) => Promise<void>;
  accentColor: string;
  setAccentColor: (color: string) => Promise<void>;
  contentWidthMode: ContentWidthMode;
  sheetWidthMode: SheetWidthMode;
  setContentWidthMode: (mode: ContentWidthMode) => Promise<void>;
  setSheetWidthMode: (mode: SheetWidthMode) => Promise<void>;
}

export const AppearanceContext =
  createContext<AppearanceContextValue | null>(null);
