export { REDUCE_ANIMATIONS_SETTING_KEY } from './motionPreferences';
export const ESCAPE_AS_BACK_SETTING_KEY = 'escapeAsBack';
export const CONTINUE_ADDING_TASKS_SETTING_KEY = 'continueAddingTasks';
export const ADD_TASKS_TO_TOP_SETTING_KEY = 'addTasksToTop';
export const TASK_COMPLETION_SORT_SETTING_KEY = 'taskCompletionSort';
export const WEEK_STARTS_ON_SUNDAY_SETTING_KEY = 'weekStartsOnSunday';
export const SHOW_CATEGORY_COLLAPSE_SETTING_KEY = 'showCategoryCollapseButton';
export const SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY = 'showDayViewTodayTag';
export const SHOW_HOLIDAYS_SETTING_KEY = 'showHolidays';
export const HOLIDAY_REGION_SETTING_KEY = 'holidayRegion';
export const HOLIDAY_TYPES_SETTING_KEY = 'holidayTypes';

export type WeekStartsOn = 0 | 1;

export function resolveWeekStartsOn(weekStartsOnSunday: boolean): WeekStartsOn {
  return weekStartsOnSunday ? 0 : 1;
}
