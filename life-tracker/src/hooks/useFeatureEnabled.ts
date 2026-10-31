import { useFeatureFlag } from './useFeatureFlag';
import { FEATURE_DISABLE_FLAGS, type FeatureControl } from '../lib/featureControls';

/** Optional capabilities are on unless their specific remote kill switch is active. */
export function useFeatureEnabled(feature: FeatureControl): boolean {
  return !useFeatureFlag(FEATURE_DISABLE_FLAGS[feature]).enabled;
}
