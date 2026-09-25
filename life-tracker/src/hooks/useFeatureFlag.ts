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

const SERVER_SNAPSHOT = '0:0:0';

function serializeState(flagKey: string): string {
  const state = getPostHogFeatureFlagState(flagKey);
  return `${state.enabled ? 1 : 0}:${state.isLoaded ? 1 : 0}:${state.hasError ? 1 : 0}`;
}

function deserializeState(snapshot: string): FeatureFlagState {
  const [enabled, isLoaded, hasError] = snapshot.split(':');
  return {
    enabled: enabled === '1',
    isLoaded: isLoaded === '1',
    hasError: hasError === '1',
  };
}

export function useFeatureFlag(flagKey: string): FeatureFlagState {
  const snapshot = useSyncExternalStore(
    subscribePostHogFeatureFlags,
    () => serializeState(flagKey),
    () => SERVER_SNAPSHOT
  );
  return deserializeState(snapshot);
}
