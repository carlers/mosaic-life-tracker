export const CONTENT_WIDTH_STORAGE_KEY = 'mosaic_content_width_mode';
export const SHEET_WIDTH_STORAGE_KEY = 'mosaic_sheet_width_mode';
export const CONTENT_WIDTH_SETTING_KEY = 'contentWidthMode';
export const SHEET_WIDTH_SETTING_KEY = 'sheetWidthMode';

export const CONTENT_WIDTH_MODES = ['full', 'comfortable'] as const;
export const SHEET_WIDTH_MODES = ['full', 'compact'] as const;

export type ContentWidthMode = (typeof CONTENT_WIDTH_MODES)[number];
export type SheetWidthMode = (typeof SHEET_WIDTH_MODES)[number];

export function isContentWidthMode(value: unknown): value is ContentWidthMode {
  return (
    typeof value === 'string' &&
    (CONTENT_WIDTH_MODES as readonly string[]).includes(value)
  );
}

export function isSheetWidthMode(value: unknown): value is SheetWidthMode {
  return (
    typeof value === 'string' &&
    (SHEET_WIDTH_MODES as readonly string[]).includes(value)
  );
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export function readCachedContentWidthMode(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage()
): ContentWidthMode {
  if (!storage) return 'full';
  try {
    const value = storage.getItem(CONTENT_WIDTH_STORAGE_KEY);
    return isContentWidthMode(value) ? value : 'full';
  } catch {
    return 'full';
  }
}

export function readCachedSheetWidthMode(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage()
): SheetWidthMode {
  if (!storage) return 'full';
  try {
    const value = storage.getItem(SHEET_WIDTH_STORAGE_KEY);
    return isSheetWidthMode(value) ? value : 'full';
  } catch {
    return 'full';
  }
}

export function cacheContentWidthMode(
  mode: ContentWidthMode,
  storage: Pick<Storage, 'setItem'> | null = defaultStorage()
) {
  if (!storage) return;
  try {
    storage.setItem(CONTENT_WIDTH_STORAGE_KEY, mode);
  } catch {
    // Synced settings still apply when persistent browser storage is unavailable.
  }
}

export function cacheSheetWidthMode(
  mode: SheetWidthMode,
  storage: Pick<Storage, 'setItem'> | null = defaultStorage()
) {
  if (!storage) return;
  try {
    storage.setItem(SHEET_WIDTH_STORAGE_KEY, mode);
  } catch {
    // Synced settings still apply when persistent browser storage is unavailable.
  }
}

export function applyScreenLayoutModes(
  contentWidthMode: ContentWidthMode,
  sheetWidthMode: SheetWidthMode,
  root: HTMLElement | undefined =
    typeof document !== 'undefined' ? document.documentElement : undefined
) {
  if (!root) return;
  root.dataset.contentWidthMode = contentWidthMode;
  root.dataset.sheetWidthMode = sheetWidthMode;
}

export function initializeScreenLayout() {
  const contentWidthMode = readCachedContentWidthMode();
  const sheetWidthMode = readCachedSheetWidthMode();
  applyScreenLayoutModes(contentWidthMode, sheetWidthMode);
  return { contentWidthMode, sheetWidthMode };
}
