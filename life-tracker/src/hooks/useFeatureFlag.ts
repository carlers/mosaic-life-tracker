import { useSyncExternalStore } from 'react';
import {
  getPostHogFeatureFlagState,
  subscribePostHogFeatureFlags,
} from '../lib/posthog';

export interface FeatureFlagState {
  enabled: boolean;
  isLoaded: boolean;
  hasError: boolean;
}

export function useFeatureFlag(flagKey: string): FeatureFlagState {
  return useSyncExternalStore(
    subscribePostHogFeatureFlags,
    () => getPostHogFeatureFlagState(flagKey),
    () => ({ enabled: false, isLoaded: false, hasError: false })
  );
}
