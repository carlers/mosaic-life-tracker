import { DEFAULT_ACCENT_COLOR, getContrastRatio, isValidAccentColor, normalizeAccentColor } from '../constants/colors';
import { getAccentColorTokens } from './accentColor';

/** Independent, owner-synced visual roles; category/task colors remain data. */
export const UI_COLOR_ROLES = [
  'calendarGrid', 'profileRing', 'navigationBar', 'navigationActive',
  'icons', 'text', 'controls', 'holidays',
] as const;
export type UiColorRole = typeof UI_COLOR_ROLES[number];
export type UiColorChoice = 'default' | 'app' | string;
export type UiColorChoices = Record<UiColorRole, UiColorChoice>;

export const UI_COLOR_LABELS: Record<UiColorRole, string> = {
  calendarGrid: 'Calendar grid',
  profileRing: 'Profile picture border',
  navigationBar: 'Navigation bar',
  navigationActive: 'Active navigation',
  icons: 'Action icons',
  text: 'Accent text',
  controls: 'Buttons and controls',
  holidays: 'Holidays',
};
export const uiColorSettingKey = (role: UiColorRole): string => `uiColor:${role}`;
export const uiColorCacheKey = (userId: string): string => `mosaic_ui_colors:${userId}`;

export function resolveUiColorChoice(value: unknown): UiColorChoice {
  if (value === 'default' || value === 'app') return value;
  return isValidAccentColor(value) ? normalizeAccentColor(value) : 'default';
}
export function defaultUiColors(): UiColorChoices {
  return Object.fromEntries(UI_COLOR_ROLES.map(role => [role, 'default'])) as UiColorChoices;
}

export function readCachedUiColors(
  userId: string,
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): UiColorChoices {
  const defaults = defaultUiColors();
  if (!userId || !storage) return defaults;
  try {
    const raw = storage.getItem(uiColorCacheKey(userId));
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    for (const role of UI_COLOR_ROLES)
      defaults[role] = resolveUiColorChoice((parsed as Record<string, unknown>)[role]);
  } catch { /* invalid or disabled storage: retain defaults */ }
  return defaults;
}

export function cacheUiColors(
  userId: string, values: UiColorChoices,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): void {
  if (!userId || !storage) return;
  try {
    const normalized = defaultUiColors();
    for (const role of UI_COLOR_ROLES) normalized[role] = resolveUiColorChoice(values[role]);
    storage.setItem(uiColorCacheKey(userId), JSON.stringify(normalized));
  } catch { /* keep the in-memory appearance if storage is unavailable */ }
}

function readableAccentOn(color: string, background: string): string {
  if (getContrastRatio(color, background) >= 4.5) return color;
  const target = getContrastRatio('#FFFFFF', background) >= getContrastRatio('#000000', background)
    ? '#FFFFFF' : '#000000';
  const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  const start = rgb(color);
  const end = rgb(target);
  for (let step = 1; step <= 20; step++) {
    const candidate = '#' + start.map((channel, i) =>
      Math.round(channel + (end[i] - channel) * step / 20).toString(16).padStart(2, '0')
    ).join('').toUpperCase();
    if (getContrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return target;
}

/** Resolve label text against the actual 15%-tinted surface, not bare app chrome. */
function tintBackground(base: string, accent: string, opacity: number): string {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  return '#' + [1, 3, 5].map(offset =>
    Math.round(channel(base, offset) * (1 - opacity) + channel(accent, offset) * opacity)
      .toString(16).padStart(2, '0')
  ).join('').toUpperCase();
}

export function getHolidayLabelTextColors(value: string): { dark: string; light: string } {
  const color = normalizeAccentColor(value);
  // Choose conservative surfaces for all three themes: Dark/Black and Light.
  return {
    dark: readableAccentOn(color, tintBackground('#1E1E1E', color, 0.15)),
    light: readableAccentOn(color, tintBackground('#F7F7F8', color, 0.15)),
  };
}

export function applyUiColors(
  values: UiColorChoices,
  appAccent: string = DEFAULT_ACCENT_COLOR,
  root: HTMLElement | undefined = typeof document === 'undefined' ? undefined : document.documentElement
): void {
  if (!root) return;
  const resolved = {} as Partial<Record<UiColorRole, string>>;
  for (const role of UI_COLOR_ROLES) {
    const choice = resolveUiColorChoice(values[role]);
    const color = choice === 'default' ? null : choice === 'app' ? normalizeAccentColor(appAccent) : choice;
    const prefix = `--mosaic-ui-${role}`;
    const vars = [prefix, `${prefix}-foreground`, `${prefix}-hover`, `${prefix}-soft`,
      `${prefix}-text-dark`, `${prefix}-text-light`,
      `${prefix}-border-dark`, `${prefix}-border-light`,
      `${prefix}-ring-dark`, `${prefix}-ring-light`];
    if (!color) {
      root.removeAttribute(`data-ui-${role}`);
      for (const variable of vars) root.style.removeProperty(variable);
      continue;
    }
    resolved[role] = color;
    const tokens = getAccentColorTokens(color);
    root.setAttribute(`data-ui-${role}`, 'true');
    root.style.setProperty(prefix, tokens.base);
    root.style.setProperty(`${prefix}-foreground`, tokens.foreground);
    root.style.setProperty(`${prefix}-hover`, tokens.hover);
    root.style.setProperty(`${prefix}-soft`, tokens.soft);
    root.style.setProperty(`${prefix}-text-dark`, tokens.textDark);
    root.style.setProperty(`${prefix}-text-light`, tokens.textLight);
    root.style.setProperty(`${prefix}-border-dark`, tokens.borderDark);
    root.style.setProperty(`${prefix}-border-light`, tokens.borderLight);
    root.style.setProperty(`${prefix}-ring-dark`, tokens.ringDark);
    root.style.setProperty(`${prefix}-ring-light`, tokens.ringLight);
    if (role === 'holidays') {
      const { dark, light } = getHolidayLabelTextColors(tokens.base);
      root.style.setProperty(`${prefix}-text-dark`, dark);
      root.style.setProperty(`${prefix}-text-light`, light);
    }
  }
  // Active navigation text is legible on both default palettes or the user's custom bar.
  const selected = resolved.navigationActive;
  if (selected) {
    const customBar = resolved.navigationBar;
    root.style.setProperty('--mosaic-ui-nav-active-dark', readableAccentOn(selected, customBar ?? '#1E1E1E'));
    root.style.setProperty('--mosaic-ui-nav-active-light', readableAccentOn(selected, customBar ?? '#FFFFFF'));
  } else {
    root.style.removeProperty('--mosaic-ui-nav-active-dark');
    root.style.removeProperty('--mosaic-ui-nav-active-light');
  }
}

export function initializeUiColors(): void {
  let userId = '';
  try {
    const raw = window.localStorage.getItem('mosaic_last_known_user');
    if (raw) {
      const hint: unknown = JSON.parse(raw);
      if (hint && typeof hint === 'object' && '$id' in hint && typeof hint.$id === 'string')
        userId = hint.$id;
    }
  } catch { /* signed out or storage unavailable */ }
  applyUiColors(readCachedUiColors(userId), document.documentElement.dataset.accentColor || DEFAULT_ACCENT_COLOR);
}
