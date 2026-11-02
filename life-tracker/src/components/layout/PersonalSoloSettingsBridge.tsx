import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { PERSONAL_SOLO_SETTING_KEY, setPersonalSoloMode } from '../../lib/personalSolo';

/** Lazy hydration keeps the database module outside the critical startup bundle. */
export function PersonalSoloSettingsBridge() {
  const { user } = useAuth();
  const { settings, isLoading } = useSettings();
  const owner = user?.$id;
  const saved = settings[PERSONAL_SOLO_SETTING_KEY];
  useEffect(() => {
    if (owner && !isLoading && typeof saved === 'boolean') {
      setPersonalSoloMode(owner, saved);
    }
  }, [owner, saved, isLoading]);
  return null;
}
