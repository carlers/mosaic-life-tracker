import type { UiColorRole } from './uiColors';

/** Settings-only display strings: never load with first-paint color initialization. */
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
