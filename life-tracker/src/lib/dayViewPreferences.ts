export const SHOW_CATEGORY_COLLAPSE_SETTING_KEY = 'showCategoryCollapseButton';
export const SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY = 'showAddCategoryInDayView';
export const SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY = 'showDayViewTodayTag';
export const DAY_VIEW_MODE_SETTING_KEY = 'dayViewMode';
export const TIMELINE_DIRECTION_SETTING_KEY = 'dayTimelineDirection';
export const TIMELINE_SORT_BASIS_SETTING_KEY = 'dayTimelineSortBasis';
export const FULL_WIDTH_CATEGORY_PILLS_SETTING_KEY = 'fullWidthCategoryPills';

export const FULL_WIDTH_CATEGORY_PILL_TEXT_ALIGNMENT_SETTING_KEY = 'fullWidthCategoryPillTextAlignment';
export type FullWidthCategoryPillTextAlignment = 'left' | 'center';
/** Unknown or unset stored values preserve the original left alignment. */
export function resolveFullWidthCategoryPillTextAlignment(value: unknown): FullWidthCategoryPillTextAlignment {
  return value === 'center' ? 'center' : 'left';
}
