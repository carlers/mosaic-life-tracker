import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSettings } from './useSettings';
import { AppearanceContext } from './appearanceContext';
import {
  APPEARANCE_SETTING_KEY,
  applyAppearanceMode,
  cacheAppearanceMode,
  getSystemPrefersDark,
  isAppearanceMode,
  readCachedAppearanceMode,
  resolveAppearanceMode,
  type AppearanceMode,
} from '../lib/appearance';

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { getSetting, setSetting, isLoading } = useSettings();
  const cachedMode = useMemo(() => readCachedAppearanceMode(), []);
  const [overrideMode, setOverrideMode] = useState<AppearanceMode | null>(null);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    getSystemPrefersDark()
  );

  const syncedValue = isLoading
    ? undefined
    : getSetting(APPEARANCE_SETTING_KEY, undefined);
  const syncedMode = isAppearanceMode(syncedValue) ? syncedValue : null;
  const mode = overrideMode ?? syncedMode ?? cachedMode;

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) =>
      setSystemPrefersDark(event.matches);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    query.addListener?.(handleChange);
    return () => query.removeListener?.(handleChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveAppearanceMode(mode, systemPrefersDark),
    [mode, systemPrefersDark]
  );

  useEffect(() => {
    cacheAppearanceMode(mode);
    applyAppearanceMode(mode, { prefersDark: systemPrefersDark });
  }, [mode, systemPrefersDark]);

  const setAppearanceMode = useCallback(
    async (nextMode: AppearanceMode) => {
      setOverrideMode(nextMode);
      cacheAppearanceMode(nextMode);
      applyAppearanceMode(nextMode, { prefersDark: systemPrefersDark });
      await setSetting(APPEARANCE_SETTING_KEY, nextMode);
    },
    [setSetting, systemPrefersDark]
  );

  const value = useMemo(
    () => ({ mode, resolvedTheme, setAppearanceMode }),
    [mode, resolvedTheme, setAppearanceMode]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
};
