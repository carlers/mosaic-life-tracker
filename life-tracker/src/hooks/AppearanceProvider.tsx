import { MotionConfig } from 'framer-motion';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSettings } from './useSettings';
import { useAuth } from './useAuth';
import { AppearanceContext } from './appearanceContext';
import { REDUCE_ANIMATIONS_SETTING_KEY, readCachedReduceAnimations, cacheReduceAnimations, applyReducedMotionPreference, systemRequestsReducedMotion } from '../lib/motionPreferences';
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
  ACCENT_COLOR_SETTING_KEY,
  applyAccentColor,
  cacheAccentColor,
  readCachedAccentColor,
} from '../lib/accentColor';
import {
  isValidAccentColor,
  normalizeAccentColor,
} from '../constants/colors';
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
  const { user } = useAuth();
  const userId = user?.$id ?? '';
  const { getSetting, setSetting, isLoading } = useSettings();
  const cachedMode = useMemo(() => readCachedAppearanceMode(), []);
  const cachedReduceAnimations = useMemo(() => readCachedReduceAnimations(userId), [userId]);
  const [reduceOverride, setReduceOverride] = useState<{ userId: string; enabled: boolean } | null>(null);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => systemRequestsReducedMotion());
  const cachedAccentColor = useMemo(
    () => readCachedAccentColor(userId),
    [userId]
  );
  const cachedContentWidthMode = useMemo(() => readCachedContentWidthMode(), []);
  const cachedSheetWidthMode = useMemo(() => readCachedSheetWidthMode(), []);
  const [overrideMode, setOverrideMode] = useState<AppearanceMode | null>(null);
  const [overrideAccentColor, setOverrideAccentColor] = useState<{
    userId: string;
    color: string;
  } | null>(null);
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
  const syncedReduceValue = isLoading ? undefined : getSetting(REDUCE_ANIMATIONS_SETTING_KEY, undefined);
  const syncedReduceAnimations = typeof syncedReduceValue === 'boolean' ? syncedReduceValue : null;
  if (reduceOverride && (reduceOverride.userId !== userId || syncedReduceAnimations === reduceOverride.enabled)) {
    setReduceOverride(null);
  }
  const reduceAnimations = reduceOverride?.userId === userId
    ? reduceOverride.enabled
    : syncedReduceAnimations ?? cachedReduceAnimations;
  const effectiveReducedMotion = reduceAnimations || systemReducedMotion;
  const syncedAccentValue = isLoading
    ? undefined
    : getSetting(ACCENT_COLOR_SETTING_KEY, undefined);
  const syncedAccentColor = isValidAccentColor(syncedAccentValue)
    ? normalizeAccentColor(syncedAccentValue)
    : null;
  if (
    overrideAccentColor &&
    (overrideAccentColor.userId !== userId ||
      syncedAccentColor === overrideAccentColor.color)
  ) {
    setOverrideAccentColor(null);
  }
  const accentColor =
    overrideAccentColor?.userId === userId
      ? overrideAccentColor.color
      : syncedAccentColor ?? cachedAccentColor;
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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    cacheReduceAnimations(userId, reduceAnimations);
    applyReducedMotionPreference(effectiveReducedMotion);
  }, [userId, reduceAnimations, effectiveReducedMotion]);

  const resolvedTheme = useMemo(
    () => resolveAppearanceMode(mode, systemPrefersDark),
    [mode, systemPrefersDark]
  );

  useEffect(() => {
    cacheAppearanceMode(mode);
    applyAppearanceMode(mode, { prefersDark: systemPrefersDark });
  }, [mode, systemPrefersDark]);

  useEffect(() => {
    applyAccentColor(accentColor);
    if (userId) cacheAccentColor(accentColor, userId);
  }, [accentColor, userId]);

  useEffect(() => {
    cacheContentWidthMode(contentWidthMode);
    cacheSheetWidthMode(sheetWidthMode);
    applyScreenLayoutModes(contentWidthMode, sheetWidthMode);
  }, [contentWidthMode, sheetWidthMode]);

  const setReduceAnimations = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    setReduceOverride({ userId, enabled });
    cacheReduceAnimations(userId, enabled);
    applyReducedMotionPreference(enabled || systemRequestsReducedMotion());
    await setSetting(REDUCE_ANIMATIONS_SETTING_KEY, enabled);
  }, [setSetting, userId]);

  const setAppearanceMode = useCallback(
    async (nextMode: AppearanceMode) => {
      setOverrideMode(nextMode);
      cacheAppearanceMode(nextMode);
      applyAppearanceMode(nextMode, { prefersDark: systemPrefersDark });
      await setSetting(APPEARANCE_SETTING_KEY, nextMode);
    },
    [setSetting, systemPrefersDark]
  );

  const setAccentColor = useCallback(
    async (nextColor: string) => {
      if (!userId || !isValidAccentColor(nextColor)) return;
      const normalizedColor = normalizeAccentColor(nextColor);
      setOverrideAccentColor({ userId, color: normalizedColor });
      cacheAccentColor(normalizedColor, userId);
      applyAccentColor(normalizedColor);
      await setSetting(ACCENT_COLOR_SETTING_KEY, normalizedColor);
    },
    [setSetting, userId]
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
      reduceAnimations,
      setReduceAnimations,
      accentColor,
      setAccentColor,
      contentWidthMode,
      sheetWidthMode,
      setContentWidthMode,
      setSheetWidthMode,
    }),
    [
      accentColor,
      contentWidthMode,
      mode,
      resolvedTheme,
      reduceAnimations,
      setReduceAnimations,
      setAccentColor,
      setAppearanceMode,
      setContentWidthMode,
      setSheetWidthMode,
      sheetWidthMode,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      <MotionConfig reducedMotion={effectiveReducedMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </AppearanceContext.Provider>
  );
};
