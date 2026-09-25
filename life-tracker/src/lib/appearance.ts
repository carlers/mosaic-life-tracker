export const APPEARANCE_STORAGE_KEY = 'mosaic_appearance_mode';
export const APPEARANCE_SETTING_KEY = 'appearanceMode';

export const APPEARANCE_MODES = ['system', 'dark', 'light', 'black'] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];
export type ResolvedAppearanceTheme = Exclude<AppearanceMode, 'system'>;

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return (
    typeof value === 'string' &&
    (APPEARANCE_MODES as readonly string[]).includes(value)
  );
}

export function resolveAppearanceMode(
  mode: AppearanceMode,
  prefersDark: boolean
): ResolvedAppearanceTheme {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
}

export function readCachedAppearanceMode(
  storage: Pick<Storage, 'getItem'> | null =
    typeof window !== 'undefined' ? window.localStorage : null
): AppearanceMode {
  if (!storage) return 'system';
  try {
    const value = storage.getItem(APPEARANCE_STORAGE_KEY);
    return isAppearanceMode(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function cacheAppearanceMode(
  mode: AppearanceMode,
  storage: Pick<Storage, 'setItem'> | null =
    typeof window !== 'undefined' ? window.localStorage : null
) {
  if (!storage) return;
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, mode);
  } catch {
    // Session theme still works when persistent storage is unavailable.
  }
}

export function getSystemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function applyAppearanceMode(
  mode: AppearanceMode,
  options: { root?: HTMLElement; prefersDark?: boolean } = {}
): ResolvedAppearanceTheme {
  const root =
    options.root ??
    (typeof document !== 'undefined' ? document.documentElement : undefined);
  const resolved = resolveAppearanceMode(
    mode,
    options.prefersDark ?? getSystemPrefersDark()
  );

  if (root) {
    root.dataset.appearanceMode = mode;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
  }
  return resolved;
}

export function initializeAppearance(): AppearanceMode {
  const mode = readCachedAppearanceMode();
  applyAppearanceMode(mode);
  return mode;
}
