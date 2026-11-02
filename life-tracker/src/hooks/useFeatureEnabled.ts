import { useSyncExternalStore } from 'react';
import { useFeatureFlag } from './useFeatureFlag';
import { FEATURE_DISABLE_FLAGS } from '../lib/featureControls';
import { isBuildCapabilityAvailable } from '../lib/capabilityProfile';
import { getAccountWorkScope } from '../lib/accountWorkScope';
import { getPersonalSoloMode, getPersonalSoloRevision, subscribePersonalSolo } from '../lib/personalSolo';
import type { FeatureDisableFlag } from '../lib/featureControls';

/** Optional capabilities are on unless their specific remote kill switch is active. */
export function useFeatureEnabled(flag: FeatureDisableFlag): boolean {
  const enabled = !useFeatureFlag(flag).enabled;
  useSyncExternalStore(subscribePersonalSolo, getPersonalSoloRevision, () => 0);
  return flag === FEATURE_DISABLE_FLAGS.allSocial
    ? enabled && isBuildCapabilityAvailable('social.friends') &&
      !getPersonalSoloMode(getAccountWorkScope().userId)
    : enabled;
}
