import React, { useEffect, useState } from 'react';
import { BellRing, ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SettingsRow } from '../components/ui/SettingsRow';
import { useSettings } from '../hooks/useSettings';
import {
  ALERTS_READ_RETENTION_SETTING_KEY, ALERTS_UNREAD_RETENTION_SETTING_KEY,
  READ_RETENTION_HOURS, UNREAD_RETENTION_DAYS,
  resolveReadRetentionHours, resolveUnreadRetentionDays,
} from '../lib/notificationRetention';
import { useAuth } from '../hooks/useAuth';
import { hasExpectedRouteParent, resolveRouteParent } from '../lib/primarySwipeNavigation';
import {
  disablePushNotifications, enablePushNotifications, getPushNotificationState, setPushDetails,
  getPushWhileOpen, setPushWhileOpen, canDisableForegroundPush,
  type PushNotificationState,
} from '../lib/pushNotifications';

interface RetentionChoiceProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  options: readonly number[];
  format: (option: number) => string;
  onChange: (value: number) => void;
}

function RetentionChoice({ id, label, hint, value, options, format, onChange }: RetentionChoiceProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={(event) => event.stopPropagation()}
        className="min-w-[7.5rem] shrink-0 rounded-lg border border-[#444444] bg-[#1E1E1E] px-2 py-2 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        {options.map((option) => (
          <option key={option} value={option}>{format(option)}</option>
        ))}
      </select>
    </div>
  );
}

export const NotificationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.$id || '';
  const { getSetting, setSetting } = useSettings();
  const unreadDays = resolveUnreadRetentionDays(getSetting(ALERTS_UNREAD_RETENTION_SETTING_KEY));
  const readHours = resolveReadRetentionHours(getSetting(ALERTS_READ_RETENTION_SETTING_KEY));
  const [retentionError, setRetentionError] = useState('');
  const saveRetention = (key: string, value: number) => {
    setRetentionError('');
    void setSetting(key, value).catch(() => {
      setRetentionError('Could not save Alerts history preference. Please retry.');
    });
  };
  const [pushState, setPushState] = useState<PushNotificationState>({
    status: 'checking', enabled: false, detailsEnabled: null, label: 'Checking this device…',
  });
  const [pending, setPending] = useState(false);
  const [pushWhileOpen, setPushWhileOpenState] = useState<boolean | null>(null);
  const [foregroundPending, setForegroundPending] = useState(false);
  const [foregroundError, setForegroundError] = useState('');
  const foregroundSupported = canDisableForegroundPush();

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

  useEffect(() => {
    let active = true;
    void getPushWhileOpen().then((enabled) => {
      if (active) setPushWhileOpenState(enabled);
    }).catch(() => {
      if (active) setForegroundError('Could not read this device preference.');
    });
    return () => { active = false; };
  }, []);

  const toggleForeground = async () => {
    if (!pushState.enabled || !foregroundSupported || pushWhileOpen === null || foregroundPending) return;
    setForegroundPending(true);
    setForegroundError('');
    try {
      const next = !pushWhileOpen;
      await setPushWhileOpen(next);
      setPushWhileOpenState(next);
    } catch {
      setForegroundError('Could not save this device preference.');
    } finally {
      setForegroundPending(false);
    }
  };

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
      <section className="border-b border-[#333333] py-4">
        <h2 className="px-4 pb-2 font-semibold">Activity history</h2>
        <RetentionChoice
          id="alerts-unread-retention"
          label="Unread alerts"
          hint="Time after an alert arrives"
          value={unreadDays}
          options={UNREAD_RETENTION_DAYS}
          format={(days) => `${days} ${days === 1 ? 'day' : 'days'}`}
          onChange={(days) => saveRetention(ALERTS_UNREAD_RETENTION_SETTING_KEY, days)}
        />
        <RetentionChoice
          id="alerts-read-retention"
          label="Read alerts"
          hint="Time after first being read"
          value={readHours}
          options={READ_RETENTION_HOURS}
          format={(hours) => hours >= 72
            ? `${hours / 24} days`
            : `${hours} ${hours === 1 ? 'hour' : 'hours'}`}
          onChange={(hours) => saveRetention(ALERTS_READ_RETENTION_SETTING_KEY, hours)}
        />
        <p className="px-4 pt-2 text-xs leading-relaxed text-gray-400">
          These choices sync across your devices. Reading an alert starts its
          own timer; receipts are permanently cleared after at most 37 days.
          Alerts become read when viewed in the active feed.
        </p>
        {retentionError && <p className="px-4 pt-2 text-xs text-red-400" role="alert">{retentionError}</p>}
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
                ? pushState.detailsError || 'Unable to verify device preference'
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
        <SettingsRow
          icon={<BellRing size={18} className="text-gray-400" aria-hidden="true" />}
          label="Notify while Mosaic is open"
          value={!foregroundSupported ? 'Not supported in this browser' :
            !pushState.enabled ? 'Enable push first' :
            foregroundPending ? 'Saving…' : pushWhileOpen === null
              ? 'Checking this device…' : pushWhileOpen ? 'On' : 'Off'}
          showChevron={false}
          isToggle
          checked={pushWhileOpen === true}
          disabled={!pushState.enabled || !foregroundSupported || pushWhileOpen === null || foregroundPending}
          onClick={() => void toggleForeground()}
        />
        <p className="px-5 pb-3 pt-2 text-xs text-gray-500">
          On supported Chromium browsers, turning this off hides system push alerts
          while Mosaic is visible. Other browsers, including iOS Safari, require
          visible push alerts and do not support this option. Background delivery
          and the Alerts history are unaffected.
        </p>
        {foregroundError && (
          <p role="alert" className="px-5 pb-3 text-xs text-red-400">{foregroundError}</p>
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
