import {
  DEFAULT_ACCENT_COLOR,
  getContrastRatio,
  getReadableTextColor,
  isValidAccentColor,
  normalizeAccentColor,
} from '../constants/colors';

export const ACCENT_COLOR_SETTING_KEY = 'accentColor';
export const ACCENT_COLOR_STORAGE_KEY_PREFIX = 'mosaic_accent_color:';
const LAST_KNOWN_USER_KEY = 'mosaic_last_known_user';

interface AccentCssTokens {
  base: string;
  hover: string;
  soft: string;
  foreground: '#000000' | '#FFFFFF';
  textDark: string;
  textLight: string;
  ringDark: string;
  ringLight: string;
  borderDark: string;
  borderLight: string;
}

function normalizeHex(hex: string): string {
  const normalized = hex.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized)
    ? normalized
    : DEFAULT_ACCENT_COLOR;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16)
  ) as [number, number, number];
}

function rgbToHex(channels: readonly number[]): string {
  return `#${channels
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`;
}

function mixHex(from: string, to: string, ratio: number): string {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  return rgbToHex(
    fromRgb.map(
      (channel, index) =>
        channel + (toRgb[index] - channel) * Math.max(0, Math.min(1, ratio))
    )
  );
}

function ensureContrast(
  color: string,
  background: string,
  toward: '#000000' | '#FFFFFF',
  target = 4.5
): string {
  const normalized = normalizeAccentColor(color);
  if (getContrastRatio(normalized, background) >= target) return normalized;

  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHex(normalized, toward, step / 20);
    if (getContrastRatio(candidate, background) >= target) return candidate;
  }

  return toward;
}

function toRgba(hex: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getAccentColorTokens(value: unknown): AccentCssTokens {
  const base = normalizeAccentColor(value);
  const foreground = getReadableTextColor(base);
  const hover = mixHex(
    base,
    foreground === '#000000' ? '#000000' : '#FFFFFF',
    0.12
  );
  const textDark = ensureContrast(base, '#111111', '#FFFFFF');
  const textLight = ensureContrast(base, '#FFFFFF', '#000000');

  return {
    base,
    hover,
    soft: toRgba(base, 0.15),
    foreground,
    textDark,
    textLight,
    ringDark: toRgba(textDark, 0.7),
    ringLight: toRgba(textLight, 0.7),
    borderDark: toRgba(textDark, 0.55),
    borderLight: toRgba(textLight, 0.55),
  };
}

export function getAccentColorStorageKey(userId: string): string {
  return `${ACCENT_COLOR_STORAGE_KEY_PREFIX}${userId}`;
}

function readLastKnownUserId(
  storage: Pick<Storage, 'getItem'> | null
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_KNOWN_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { $id?: unknown };
    return typeof parsed.$id === 'string' && parsed.$id ? parsed.$id : null;
  } catch {
    return null;
  }
}

export function readCachedAccentColor(
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null =
    typeof window !== 'undefined' ? window.localStorage : null
): string {
  if (!storage) return DEFAULT_ACCENT_COLOR;
  const resolvedUserId = userId || readLastKnownUserId(storage);
  if (!resolvedUserId) return DEFAULT_ACCENT_COLOR;

  try {
    const value = storage.getItem(getAccentColorStorageKey(resolvedUserId));
    return isValidAccentColor(value)
      ? normalizeAccentColor(value)
      : DEFAULT_ACCENT_COLOR;
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

export function cacheAccentColor(
  value: unknown,
  userId: string,
  storage: Pick<Storage, 'setItem'> | null =
    typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!storage || !userId) return;
  try {
    storage.setItem(
      getAccentColorStorageKey(userId),
      normalizeAccentColor(value)
    );
  } catch {
    // The in-memory accent still works when persistent storage is unavailable.
  }
}

export function applyAccentColor(
  value: unknown,
  root: HTMLElement | undefined =
    typeof document !== 'undefined' ? document.documentElement : undefined
): string {
  const tokens = getAccentColorTokens(value);
  if (!root) return tokens.base;

  root.dataset.accentColor = tokens.base;
  root.style.setProperty('--mosaic-accent', tokens.base);
  root.style.setProperty('--mosaic-accent-hover', tokens.hover);
  root.style.setProperty('--mosaic-accent-soft', tokens.soft);
  root.style.setProperty('--mosaic-accent-foreground', tokens.foreground);
  root.style.setProperty('--mosaic-accent-text-dark', tokens.textDark);
  root.style.setProperty('--mosaic-accent-text-light', tokens.textLight);
  root.style.setProperty('--mosaic-accent-ring-dark', tokens.ringDark);
  root.style.setProperty('--mosaic-accent-ring-light', tokens.ringLight);
  root.style.setProperty('--mosaic-accent-border-dark', tokens.borderDark);
  root.style.setProperty('--mosaic-accent-border-light', tokens.borderLight);
  return tokens.base;
}

export function initializeAccentColor(): string {
  const storage =
    typeof window !== 'undefined' ? window.localStorage : null;
  const userId = readLastKnownUserId(storage);
  return applyAccentColor(readCachedAccentColor(userId, storage));
}
