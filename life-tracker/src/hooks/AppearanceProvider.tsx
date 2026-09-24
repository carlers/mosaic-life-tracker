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
import {
  CONTENT_WIDTH_SETTING_KEY,
  SHEET_WIDTH_SETTING_KEY,
  applyScreenLayoutModes,
  cacheContentWidthMode,
  cacheSheetWidthMode,
  isContentWidthMode,
  isSheetWidthMode,
  readCachedContentWidthMode,
  readCachedSheetWidthMode,
  type ContentWidthMode,
  type SheetWidthMode,
} from '../lib/screenLayout';

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { getSetting, setSetting, isLoading } = useSettings();
  const cachedMode = useMemo(() => readCachedAppearanceMode(), []);
  const cachedContentWidthMode = useMemo(() => readCachedContentWidthMode(), []);
  const cachedSheetWidthMode = useMemo(() => readCachedSheetWidthMode(), []);
  const [overrideMode, setOverrideMode] = useState<AppearanceMode | null>(null);
  const [overrideContentWidthMode, setOverrideContentWidthMode] =
    useState<ContentWidthMode | null>(null);
  const [overrideSheetWidthMode, setOverrideSheetWidthMode] =
    useState<SheetWidthMode | null>(null);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    getSystemPrefersDark()
  );

  const syncedValue = isLoading
    ? undefined
    : getSetting(APPEARANCE_SETTING_KEY, undefined);
  const syncedMode = isAppearanceMode(syncedValue) ? syncedValue : null;
  const syncedContentWidthValue = isLoading
    ? undefined
    : getSetting(CONTENT_WIDTH_SETTING_KEY, undefined);
  const syncedSheetWidthValue = isLoading
    ? undefined
    : getSetting(SHEET_WIDTH_SETTING_KEY, undefined);
  const syncedContentWidthMode = isContentWidthMode(syncedContentWidthValue)
    ? syncedContentWidthValue
    : null;
  const syncedSheetWidthMode = isSheetWidthMode(syncedSheetWidthValue)
    ? syncedSheetWidthValue
    : null;
  const mode = overrideMode ?? syncedMode ?? cachedMode;
  const contentWidthMode =
    overrideContentWidthMode ?? syncedContentWidthMode ?? cachedContentWidthMode;
  const sheetWidthMode =
    overrideSheetWidthMode ?? syncedSheetWidthMode ?? cachedSheetWidthMode;

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

  useEffect(() => {
    cacheContentWidthMode(contentWidthMode);
    cacheSheetWidthMode(sheetWidthMode);
    applyScreenLayoutModes(contentWidthMode, sheetWidthMode);
  }, [contentWidthMode, sheetWidthMode]);

  const setAppearanceMode = useCallback(
    async (nextMode: AppearanceMode) => {
      setOverrideMode(nextMode);
      cacheAppearanceMode(nextMode);
      applyAppearanceMode(nextMode, { prefersDark: systemPrefersDark });
      await setSetting(APPEARANCE_SETTING_KEY, nextMode);
    },
    [setSetting, systemPrefersDark]
  );

  const setContentWidthMode = useCallback(
    async (nextMode: ContentWidthMode) => {
      setOverrideContentWidthMode(nextMode);
      cacheContentWidthMode(nextMode);
      applyScreenLayoutModes(nextMode, sheetWidthMode);
      await setSetting(CONTENT_WIDTH_SETTING_KEY, nextMode);
    },
    [setSetting, sheetWidthMode]
  );

  const setSheetWidthMode = useCallback(
    async (nextMode: SheetWidthMode) => {
      setOverrideSheetWidthMode(nextMode);
      cacheSheetWidthMode(nextMode);
      applyScreenLayoutModes(contentWidthMode, nextMode);
      await setSetting(SHEET_WIDTH_SETTING_KEY, nextMode);
    },
    [contentWidthMode, setSetting]
  );

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setAppearanceMode,
      contentWidthMode,
      sheetWidthMode,
      setContentWidthMode,
      setSheetWidthMode,
    }),
    [
      contentWidthMode,
      mode,
      resolvedTheme,
      setAppearanceMode,
      setContentWidthMode,
      setSheetWidthMode,
      sheetWidthMode,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
};
