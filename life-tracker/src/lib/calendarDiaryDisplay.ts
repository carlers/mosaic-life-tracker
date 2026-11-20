import { hashString } from './settingsRowId';

export const CALENDAR_DIARY_DEFAULT_STYLE_SETTING_KEY = 'calendarDiaryDefaultStyle';
export type CalendarDiaryBlockStyle = 'text' | 'icon';
export type CalendarDiaryEntryDisplay = 'default' | CalendarDiaryBlockStyle | 'hidden';

export function resolveCalendarDiaryDefaultStyle(value: unknown): CalendarDiaryBlockStyle {
  return value === 'icon' ? 'icon' : 'text';
}

export function resolveCalendarDiaryEntryDisplay(value: unknown): CalendarDiaryEntryDisplay {
  return value === 'text' || value === 'icon' || value === 'hidden' ? value : 'default';
}

/** Settings already sync privately per owner; avoid a remote Diary schema migration. */
export function calendarDiaryEntryDisplayKey(entryId: string): string {
  const suffix = entryId.length <= 68 ? entryId : 'hash_' + hashString(entryId);
  return 'calendarDiaryEntryDisplay:' + suffix;
}
