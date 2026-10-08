import React, { useEffect, useState } from 'react';
import { BellRing, ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SettingsRow } from '../components/ui/SettingsRow';
import { useAuth } from '../hooks/useAuth';
import { hasExpectedRouteParent, resolveRouteParent } from '../lib/primarySwipeNavigation';
import {
  disablePushNotifications, enablePushNotifications, getPushNotificationState, setPushDetails,
  type PushNotificationState,
} from '../lib/pushNotifications';

export const NotificationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.$id || '';
  const [pushState, setPushState] = useState<PushNotificationState>({
    status: 'checking', enabled: false, detailsEnabled: null, label: 'Checking this device…',
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushNotificationState(userId).then((next) => {
      if (active) setPushState(next);
    }).catch(() => {
      if (active) setPushState({
        status: 'unconfigured', enabled: false, detailsEnabled: null,
        label: 'Could not check push availability',
      });
    });
    return () => { active = false; };
  }, [userId]);

  const unavailable = !pushState.enabled && pushState.status !== 'available';
  const toggle = async () => {
    if (!userId || pending || unavailable) return;
    setPending(true);
    try {
      setPushState(pushState.enabled
        ? await disablePushNotifications(userId)
        : await enablePushNotifications(userId));
    } catch (cause) {
      console.warn('[NotificationSettings] push toggle failed:', cause);
      try {
        setPushState(await getPushNotificationState(userId));
      } catch {
        setPushState({ status: 'unconfigured', enabled: false, detailsEnabled: null, label: 'Could not check push availability' });
      }
    } finally {
      setPending(false);
    }
  };

  const toggleDetails = async () => {
    if (!userId || pending || !pushState.enabled ||
        pushState.detailsEnabled === null) return;
    setPending(true);
    try {
      setPushState(await setPushDetails(userId, !pushState.detailsEnabled));
    } catch (cause) {
      console.warn('[NotificationSettings] details preference failed:', cause);
      setPushState(await getPushNotificationState(userId).catch(() => ({
        ...pushState, detailsEnabled: null,
      })));
    } finally {
      setPending(false);
    }
  };

  const backParent = resolveRouteParent(location.pathname, location.state) || '/settings';
  const back = () => {
    const parent = backParent;
    if (hasExpectedRouteParent(location.key, location.state, parent)) navigate(-1);
    else navigate(parent, { replace: true });
  };

  return (
    <div className="min-h-full bg-[#111111] text-white">
      <header className="flex items-center gap-3 border-b border-[#2A2A2A] px-4 py-3">
        <button type="button" onClick={back}
          className="rounded-lg p-1 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label={backParent === '/notifications' ? 'Back to Alerts' : 'Back to Settings'}><ChevronLeft size={22}/></button>
        <h1 className="text-lg font-bold">Notifications</h1>
      </header>
      <section className="border-b border-[#333333] px-4 py-5">
        <h2 className="font-semibold">Activity history</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          Unread alerts stay for 7 days after arriving. Read alerts
          disappear after 24 hours, or at 7 days if sooner.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          An alert becomes read after you view it in Alerts.
        </p>
      </section>
      <section className="py-3">
        <h2 className="px-4 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          This device
        </h2>
        <SettingsRow
          icon={<BellRing size={18} className="text-gray-400" aria-hidden="true" />}
          label="Push friend completions"
          value={pending ? 'Updating…' : pushState.label}
          showChevron={false}
          isToggle
          checked={pushState.enabled}
          disabled={pending || unavailable}
          onClick={() => void toggle()}
        />
        <p className="px-5 pb-3 pt-2 text-xs text-gray-500">
          Push is enabled separately on each device. Permission is requested
          only when you turn it on. In-app Alerts work without push.
        </p>
        {pushState.enabled && (
          <>
            <SettingsRow
              icon={<BellRing size={18} className="text-gray-400" aria-hidden="true" />}
              label="Show task details in notifications"
              value={pushState.detailsEnabled === null
                ? 'Connect to verify this device’s preference'
                : pushState.detailsEnabled ? 'Friend names and task titles shown' : 'Generic notification text'}
              showChevron={false}
              isToggle
              checked={pushState.detailsEnabled === true}
              disabled={pending || pushState.detailsEnabled === null}
              onClick={() => void toggleDetails()}
            />
            <p className="px-5 pb-3 pt-2 text-xs text-gray-500">
              Off by default on each device. When enabled, names and task titles
              may appear on your lock screen. Disabling cannot erase notifications
              already delivered.
            </p>
          </>
        )}
        {pushState.status === 'install-required' && (
          <p className="px-5 pb-3 text-xs text-gray-400">
            On iPhone or iPad, open Mosaic in Safari, tap Share, choose
            Add to Home Screen, then open Mosaic from its new icon.
          </p>
        )}
        {pushState.status === 'blocked' && (
          <p className="px-5 pb-3 text-xs text-gray-400">
            Notifications are blocked. Allow notifications for Mosaic in
            your device or browser settings, then return here.
          </p>
        )}
      </section>
    </div>
  );
};
