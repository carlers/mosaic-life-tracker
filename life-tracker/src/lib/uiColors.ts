import { DEFAULT_ACCENT_COLOR, getContrastRatio, isValidAccentColor, normalizeAccentColor } from '../constants/colors';
import { getAccentColorTokens } from './accentColor';

/** One account accent, with independently enabled surfaces and text roles. */
export const UI_COLOR_ROLES = [
  'calendarGrid', 'profileRing', 'navigationBar', 'navigationActive',
  'icons', 'text', 'controls', 'holidays', 'dateHeaders', 'dayHeaders',
  'settingsText', 'settingsIcons', 'generalText', 'friendCarousel', 'bottomSheetText',
] as const;
export type UiColorRole = typeof UI_COLOR_ROLES[number];
export type UiColorChoices = Record<UiColorRole, boolean>;
export const UI_COLOR_LABELS: Record<UiColorRole, string> = {
  calendarGrid: 'Calendar grid',
  profileRing: 'Profile picture border',
  navigationBar: 'Navigation icons and labels',
  navigationActive: 'Active navigation',
  icons: 'Action icons',
  text: 'Accent labels and links',
  controls: 'Buttons and switches',
  holidays: 'Holiday labels and dates',
  dateHeaders: 'Date and month headers',
  dayHeaders: 'Weekday headers and day numbers',
  settingsText: 'Settings and subpage text',
  settingsIcons: 'Settings and subpage icons',
  generalText: 'General page text',
  friendCarousel: 'Friend carousel selection and labels',
  bottomSheetText: 'Bottom sheet headings and labels',
};
export const UI_COLOR_GROUPS: readonly { title: string; roles: readonly UiColorRole[] }[] = [
  { title: 'Calendar', roles: ['calendarGrid', 'dateHeaders', 'dayHeaders', 'holidays'] },
  { title: 'Navigation and profile', roles: ['navigationBar', 'navigationActive', 'profileRing', 'friendCarousel'] },
  { title: 'Settings', roles: ['settingsText', 'settingsIcons'] },
  { title: 'Text across the app', roles: ['generalText', 'bottomSheetText', 'text', 'icons', 'controls'] },
];
// Preserve the existing global-accent styling without requiring a user migration.
export const DEFAULT_ACCENT_ROLES: readonly UiColorRole[] = ['icons', 'text', 'controls'];
export const uiColorSettingKey = (role: UiColorRole): string => `uiColor:${role}`;
export const uiColorCacheKey = (userId: string): string => `mosaic_ui_colors:${userId}`;
export const defaultUiColors = (): UiColorChoices =>
  Object.fromEntries(UI_COLOR_ROLES.map(role => [role, DEFAULT_ACCENT_ROLES.includes(role)])) as UiColorChoices;

/** Reads both previous Preview's default/app/palette values and new booleans. */
export function resolveUiColorChoice(value: unknown, role: UiColorRole): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'app' || isValidAccentColor(value)) return true;
  return DEFAULT_ACCENT_ROLES.includes(role);
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
      defaults[role] = resolveUiColorChoice((parsed as Record<string, unknown>)[role], role);
  } catch { /* unavailable storage: keep theme defaults */ }
  return defaults;
}

export function cacheUiColors(
  userId: string, values: UiColorChoices,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): void {
  if (!userId || !storage) return;
  try {
    const normalized = defaultUiColors();
    for (const role of UI_COLOR_ROLES) normalized[role] = resolveUiColorChoice(values[role], role);
    storage.setItem(uiColorCacheKey(userId), JSON.stringify(normalized));
  } catch { /* local storage can be disabled; synced settings stay authoritative */ }
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

function tintBackground(base: string, accent: string, opacity: number): string {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  return '#' + [1, 3, 5].map(offset =>
    Math.round(channel(base, offset) * (1 - opacity) + channel(accent, offset) * opacity)
      .toString(16).padStart(2, '0')
  ).join('').toUpperCase();
}
export function getHolidayLabelTextColors(value: string): { dark: string; light: string } {
  const color = normalizeAccentColor(value);
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
  const color = normalizeAccentColor(appAccent);
  const tokens = getAccentColorTokens(color);
  for (const role of UI_COLOR_ROLES) {
    const enabled = resolveUiColorChoice(values[role], role);
    // Explicit false on original accent consumers disables the original global
    // class remaps for that group. Optional roles keep their original appearance.
    const attribute = `data-ui-${role}`;
    if (enabled) root.setAttribute(attribute, 'true');
    else if (DEFAULT_ACCENT_ROLES.includes(role)) root.setAttribute(attribute, 'false');
    else root.removeAttribute(attribute);
    const prefix = `--mosaic-ui-${role}`;
    const suffixes = ['', '-foreground', '-hover', '-soft', '-text-dark', '-text-light',
      '-border-dark', '-border-light', '-ring-dark', '-ring-light'];
    if (!enabled) {
      for (const suffix of suffixes) root.style.removeProperty(prefix + suffix);
      continue;
    }
    const entries: Record<string, string> = {
      '': tokens.base,
      '-foreground': tokens.foreground,
      '-hover': tokens.hover,
      '-soft': tokens.soft,
      '-text-dark': tokens.textDark,
      '-text-light': tokens.textLight,
      '-border-dark': tokens.borderDark,
      '-border-light': tokens.borderLight,
      '-ring-dark': tokens.ringDark,
      '-ring-light': tokens.ringLight,
    };
    if (role === 'holidays') {
      const label = getHolidayLabelTextColors(color);
      entries['-text-dark'] = label.dark;
      entries['-text-light'] = label.light;
    }
    for (const suffix of suffixes) root.style.setProperty(prefix + suffix, entries[suffix]);
  }
  // Bottom sheets use surface/highlight paints that differ from the page
  // background. Contrast against the hardest composited dark/light variants.
  if (values.bottomSheetText) {
    root.style.setProperty('--mosaic-ui-sheet-label-dark', readableAccentOn(color, '#2A2A2A'));
    root.style.setProperty('--mosaic-ui-sheet-label-light', readableAccentOn(color, '#F0F1F3'));
  } else {
    root.style.removeProperty('--mosaic-ui-sheet-label-dark');
    root.style.removeProperty('--mosaic-ui-sheet-label-light');
  }
  // The navbar background remains unchanged; foregrounds depend on that surface.
  if (values.navigationBar) {
    root.style.setProperty('--mosaic-ui-nav-label-dark', readableAccentOn(color, '#1E1E1E'));
    root.style.setProperty('--mosaic-ui-nav-label-light', readableAccentOn(color, '#FFFFFF'));
  } else {
    root.style.removeProperty('--mosaic-ui-nav-label-dark');
    root.style.removeProperty('--mosaic-ui-nav-label-light');
  }
  // Selected friend pills use the single accent as a fill with an accessible
  // foreground; inactive pills keep their neutral surface and readable text.
  if (values.friendCarousel) {
    root.style.setProperty('--mosaic-ui-carousel-inactive-dark', readableAccentOn(color, '#1E1E1E'));
    root.style.setProperty('--mosaic-ui-carousel-inactive-light', readableAccentOn(color, '#F7F7F8'));
  } else {
    root.style.removeProperty('--mosaic-ui-carousel-inactive-dark');
    root.style.removeProperty('--mosaic-ui-carousel-inactive-light');
  }
  if (values.navigationActive) {
    root.style.setProperty('--mosaic-ui-nav-active-dark', readableAccentOn(color, '#1E1E1E'));
    root.style.setProperty('--mosaic-ui-nav-active-light', readableAccentOn(color, '#FFFFFF'));
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
  } catch { /* no cached user */ }
  applyUiColors(readCachedUiColors(userId), document.documentElement.dataset.accentColor || DEFAULT_ACCENT_COLOR);
}
