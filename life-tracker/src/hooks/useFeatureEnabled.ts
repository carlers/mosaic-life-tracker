import { useFeatureFlag } from './useFeatureFlag';
import type { FeatureDisableFlag } from '../lib/featureControls';

/** Optional capabilities are on unless their specific remote kill switch is active. */
export function useFeatureEnabled(flag: FeatureDisableFlag): boolean {
  return !useFeatureFlag(flag).enabled;
}
