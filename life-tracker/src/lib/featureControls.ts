import { getPostHogFeatureFlagState } from './posthog';

/**
 * Operational kill switches. The enabled product behavior is the default, even
 * without a PostHog configuration or network connection. A flag evaluating
 * true disables only the named optional capability.
 *
 * These are not permissions, privacy enforcement or backend capabilities.
 * Configure each PostHog flag as a global boolean rollout (100% when active).
 */
export const FEATURE_DISABLE_FLAGS = {
  settingsSearch: 'mosaic_disable_settings_search',
  taskSearch: 'mosaic_disable_task_search',
  chatSearch: 'mosaic_disable_chat_search',
  taskPhotoUpload: 'mosaic_disable_task_photo_upload',
  diaryPhotoUpload: 'mosaic_disable_diary_photo_upload',
  giphySearch: 'mosaic_disable_giphy_search',
  todoMateImport: 'mosaic_disable_todomate_import',
} as const;

export type FeatureControl = keyof typeof FEATURE_DISABLE_FLAGS;

/** Non-React command boundary; use the hook for UI rendering. */
export function isFeatureEnabled(feature: FeatureControl): boolean {
  return !getPostHogFeatureFlagState(FEATURE_DISABLE_FLAGS[feature]).enabled;
}
