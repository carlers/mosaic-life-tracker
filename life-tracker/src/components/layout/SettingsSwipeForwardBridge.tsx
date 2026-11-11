import { useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import {
  SETTINGS_SWIPE_FORWARD_KEY,
  resolveSettingsSwipeForward,
  settingsSwipeDefaultDestination,
} from '../../lib/settingsSwipeForward';

/** Settings-only subscriber; keep RxDB/settings hooks out of Home's startup graph. */
export default function SettingsSwipeForwardBridge({ ownerId, pathname, onChange }: {
  ownerId: string;
  pathname: string;
  onChange: (target: { ownerId: string; pathname: string; destination: string | null }) => void;
}) {
  const { getSetting } = useSettings();
  const { settings, preferences } = resolveSettingsSwipeForward(
    getSetting(SETTINGS_SWIPE_FORWARD_KEY)
  );
  const destination = settingsSwipeDefaultDestination(pathname, { settings, preferences });
  useEffect(() => {
    onChange({ ownerId, pathname, destination });
  }, [onChange, ownerId, pathname, destination]);
  return null;
}
