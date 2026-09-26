export const CONTINUE_ADDING_TASKS_SETTING_KEY = 'continueAddingTasks';
export const WEEK_STARTS_ON_SUNDAY_SETTING_KEY = 'weekStartsOnSunday';
export const SHOW_CATEGORY_COLLAPSE_SETTING_KEY = 'showCategoryCollapseButton';
export const SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY = 'showDayViewTodayTag';
export const TAP_CALENDAR_DATE_TO_TODAY_SETTING_KEY = 'tapCalendarDateToToday';

export type WeekStartsOn = 0 | 1;

export function resolveWeekStartsOn(weekStartsOnSunday: boolean): WeekStartsOn {
  return weekStartsOnSunday ? 0 : 1;
}
