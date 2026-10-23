export const KEYBOARD_SHORTCUTS_SETTING_KEY = 'keyboardShortcutsEnabled';
export { REDUCE_ANIMATIONS_SETTING_KEY } from './motionPreferences';
export const GIPHY_AUTOPLAY_SETTING_KEY = 'giphyStickerAutoplay';
export const ESCAPE_AS_BACK_SETTING_KEY = 'escapeAsBack';
export const CONTINUE_ADDING_TASKS_SETTING_KEY = 'continueAddingTasks';
export const ADD_TASKS_TO_TOP_SETTING_KEY = 'addTasksToTop';
export const CONFIRM_TASK_DELETE_SETTING_KEY = 'confirmTaskDelete';

/** Only an explicit false opts out of individual task-deletion confirmation. */
export function shouldConfirmTaskDelete(value: unknown): boolean {
  return value !== false;
}
export const TASK_COMPLETION_SORT_SETTING_KEY = 'taskCompletionSort';
export const INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY = 'incompleteTaskBlockColor';

export type IncompleteTaskBlockColorMode = 'default' | 'text' | 'border';

export function resolveIncompleteTaskBlockColorMode(value: unknown): IncompleteTaskBlockColorMode {
  return value === 'text' || value === 'border' ? value : 'default';
}
export const STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY = 'stickyCalendarWeekdayHeader';
export const CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY = 'calendarTaskPreviewLimit';
export const CALENDAR_TASK_PREVIEW_LIMITS = [3, 5, 8, 10, 15, 20] as const;
export type CalendarTaskPreviewLimit = (typeof CALENDAR_TASK_PREVIEW_LIMITS)[number] | 'unlimited';
/** Invalid, legacy or absent preferences retain the full Calendar preview. */
export function resolveCalendarTaskPreviewLimit(value: unknown): CalendarTaskPreviewLimit {
  switch (value) {
    case 3: case '3': return 3;
    case 5: case '5': return 5;
    case 8: case '8': return 8;
    case 10: case '10': return 10;
    case 15: case '15': return 15;
    case 20: case '20': return 20;
    default: return 'unlimited';
  }
}
export const CALENDAR_ZOOM_DAYS_SETTING_KEY = 'calendarZoomDays';
export const CALENDAR_PINCH_ZOOM_SETTING_KEY = 'calendarPinchZoom';
export type CalendarZoomDays = 3 | 4 | 7;
export function resolveCalendarZoomDays(value: unknown): CalendarZoomDays {
  return value === 3 || value === '3' ? 3 : value === 4 || value === '4' ? 4 : 7;
}
export const DAY_DETAIL_PRESENTATION_SETTING_KEY = 'dayDetailPresentation';
export type DayDetailPresentation = 'sheet' | 'panel';
export function resolveDayDetailPresentation(value: unknown): DayDetailPresentation { return value === 'panel' ? 'panel' : 'sheet'; }
export const DAY_PANEL_SIDE_SETTING_KEY = 'dayPanelSide';
export const DAY_PANEL_HEIGHT_SETTING_KEY = 'dayPanelHeight';
export type DayPanelHeight = 'grid' | 'screen';
export function resolveDayPanelHeight(value: unknown): DayPanelHeight {
  return value === 'screen' ? 'screen' : 'grid';
}
export const WEEK_STARTS_ON_SUNDAY_SETTING_KEY = 'weekStartsOnSunday';
export const SHOW_CATEGORY_COLLAPSE_SETTING_KEY = 'showCategoryCollapseButton';
export const SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY = 'showAddCategoryInDayView';
export const SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY = 'showDayViewTodayTag';
export const SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY = 'showDiaryInDayView';
export const SHOW_DIARY_TODAY_SHORTCUT_SETTING_KEY = 'showDiaryTodayShortcut';
export const DIARY_DAY_VIEW_HEIGHT_SETTING_KEY = 'diaryDayViewHeight';
export const DIARY_DAY_VIEW_POSITION_SETTING_KEY = 'diaryDayViewDefaultPosition';
export type DiaryDayViewHeight = 'compact' | 'expanded';
export type DiaryDayViewPosition = 'top' | 'bottom';
export function resolveDiaryDayViewHeight(value: unknown): DiaryDayViewHeight { return value === 'expanded' ? 'expanded' : 'compact'; }
export function resolveDiaryDayViewPosition(value: unknown): DiaryDayViewPosition { return value === 'bottom' ? 'bottom' : 'top'; }
export const SHARED_LABEL_MODE_SETTING_KEY = 'sharedTaskLabelMode';
export const SHOW_PENDING_SHARES_SETTING_KEY = 'showPendingSharedTaskInvites';
export const SHOW_HOLIDAYS_SETTING_KEY = 'showHolidays';
export const HOLIDAY_REGION_SETTING_KEY = 'holidayRegion';
export const HOLIDAY_TYPES_SETTING_KEY = 'holidayTypes';

export type WeekStartsOn = 0 | 1;

export function resolveWeekStartsOn(weekStartsOnSunday: boolean): WeekStartsOn {
  return weekStartsOnSunday ? 0 : 1;
}

export const SHOW_TASK_CREATED_TIME_SETTING_KEY = 'showTaskCreatedTime';
export const SHOW_TASK_COMPLETED_TIME_SETTING_KEY = 'showTaskCompletedTime';
export const TASK_TIMESTAMP_LABEL_STYLE_SETTING_KEY = 'taskTimestampLabelStyle';
export const DAY_VIEW_MODE_SETTING_KEY = 'dayViewMode';
export const TIMELINE_DIRECTION_SETTING_KEY = 'dayTimelineDirection';
export const TIMELINE_SORT_BASIS_SETTING_KEY = 'dayTimelineSortBasis';
