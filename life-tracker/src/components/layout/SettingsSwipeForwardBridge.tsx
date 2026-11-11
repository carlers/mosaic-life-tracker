import { useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import {
  SETTINGS_SWIPE_FORWARD_KEY,
  resolveSettingsSwipeForward,
  type SettingsSwipeForward,
} from '../../lib/settingsSwipeForward';

/** Settings-only subscriber; keep RxDB/settings hooks out of Home's startup graph. */
export default function SettingsSwipeForwardBridge({ onChange }: {
  onChange: (settings: SettingsSwipeForward) => void;
}) {
  const { getSetting } = useSettings();
  const { settings, preferences } = resolveSettingsSwipeForward(
    getSetting(SETTINGS_SWIPE_FORWARD_KEY)
  );
  useEffect(() => {
    onChange({ settings, preferences });
  }, [onChange, settings, preferences]);
  return null;
}
