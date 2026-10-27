import React, { useEffect, useState } from 'react';
import { BellRing, ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SettingsRow } from '../components/ui/SettingsRow';
import { useSettingsTargetFocus } from '../lib/settingsSearch';
import { MosaicSelect } from '../components/ui/MosaicSelect';
import { ALERTS_CHANNELS_KEY, ALERTS_SOCIAL_PUSH_DETAILS_SETTING_KEY, NOTIFICATION_CHANNELS, resolveNotificationChannels, type NotificationChannels, type NotificationChannelType } from '../lib/notificationChannels';
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
    <div data-setting-label={label} className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="mosaic-settings-label text-sm font-medium">{label}</label>
        <p className="mosaic-settings-copy text-xs text-gray-400">{hint}</p>
      </div>
      <MosaicSelect
        id={id}
        label={label}
        value={String(value)}
        onChange={next => onChange(Number(next))}
        options={options.map(option => ({ value: String(option), label: format(option) }))}
        className="min-w-[7.5rem] max-w-[12rem] shrink-0"
      />
    </div>
  );
}

export const NotificationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useSettingsTargetFocus(location.pathname, location.search);
  const { user } = useAuth();
  const userId = user?.$id || '';
  const { getSetting, setSetting } = useSettings();
  const unreadDays = resolveUnreadRetentionDays(getSetting(ALERTS_UNREAD_RETENTION_SETTING_KEY));
  const readHours = resolveReadRetentionHours(getSetting(ALERTS_READ_RETENTION_SETTING_KEY));
  const syncedChannels = resolveNotificationChannels(getSetting(ALERTS_CHANNELS_KEY));
  const socialPushDetailsEnabled =
    getSetting(ALERTS_SOCIAL_PUSH_DETAILS_SETTING_KEY, false) === true;
  const [socialPushPending, setSocialPushPending] = useState(false);
  const [socialPushError, setSocialPushError] = useState('');
  const toggleSocialPushDetails = async () => {
    if (!userId || socialPushPending || pushState.detailsEnabled !== true) return;
    setSocialPushPending(true);
    setSocialPushError('');
    try {
      await setSetting(ALERTS_SOCIAL_PUSH_DETAILS_SETTING_KEY, !socialPushDetailsEnabled);
    } catch {
      setSocialPushError('Could not save social push detail preference.');
    } finally {
      setSocialPushPending(false);
    }
  };
  const [channelDraft, setChannelDraft] = useState<{
    userId: string;
    channels: NotificationChannels;
  } | null>(null);
  const [channelsSaving, setChannelsSaving] = useState(false);
  const [channelsError, setChannelsError] = useState('');
  const channelValues = channelDraft?.userId === userId
    ? channelDraft.channels : syncedChannels;

  const toggleChannel = async (type: NotificationChannelType, channel: 'feed' | 'push') => {
    if (!userId || channelsSaving) return;
    const next = {
      ...channelValues,
      [type]: { ...channelValues[type], [channel]: !channelValues[type][channel] },
    };
    setChannelDraft({ userId, channels: next });
    setChannelsSaving(true);
    setChannelsError('');
    try {
      await setSetting(ALERTS_CHANNELS_KEY, next);
    } catch {
      setChannelsError('Could not save notification preferences. Retry.');
    } finally {
      setChannelDraft(null);
      setChannelsSaving(false);
    }
  };
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
    <div className="mosaic-settings-page min-h-full bg-[#111111] text-white">
      <header className="flex items-center gap-3 border-b border-[#2A2A2A] px-4 py-3">
        <button type="button" onClick={back}
          className="mosaic-settings-icon rounded-lg p-1 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label={backParent === '/notifications' ? 'Back to Alerts' : 'Back to Settings'}><ChevronLeft size={22}/></button>
        <h1 data-setting-label="Notifications" className="text-lg font-bold">Notifications</h1>
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
        <p className="mosaic-settings-copy px-4 pt-2 text-xs leading-relaxed text-gray-400">
          These choices sync across your devices. Reading an alert starts its
          own timer; receipts are permanently cleared after at most 37 days.
          Alerts become read when viewed in the active feed.
        </p>
        {retentionError && <p className="px-4 pt-2 text-xs text-red-400" role="alert">{retentionError}</p>}
      </section>
      <section data-setting-label="Notification categories" className="py-3" aria-label="Notification categories">
        <h2 className="px-4 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Activity types
        </h2>
        <p className="mosaic-settings-copy px-4 pb-3 text-xs text-gray-400">
          Choose which events appear in Alerts and which send system push.
          These choices sync across devices. Push also requires permission on each device.
        </p>
        {NOTIFICATION_CHANNELS.map(({ type, label }) => (
          <div key={type} data-setting-label={label} className="border-b border-[#2A2A2A] px-4 py-3">
            <h3 className="mb-2 text-sm font-medium">{label}</h3>
            <div className="flex gap-4 text-xs text-gray-300">
              {(['feed', 'push'] as const).map(channel => (
                <label key={channel} className="mosaic-settings-copy inline-flex items-center gap-2">
                  <input type="checkbox"
                    aria-label={`${label} ${channel === 'feed' ? 'in-app Alerts' : 'push'}`}
                    checked={channelValues[type][channel]}
                    disabled={channelsSaving}
                    onChange={() => { void toggleChannel(type, channel); }}
                    className="h-4 w-4" style={{ accentColor: 'var(--mosaic-accent)' }} />
                  {channel === 'feed' ? 'In-app Alerts' : 'Push'}
                </label>
              ))}
            </div>
          </div>
        ))}
        {channelsError && (
          <p role="alert" className="px-4 pt-2 text-xs text-red-400">{channelsError}</p>
        )}
        <p className="px-4 pt-2 text-xs text-gray-500">
          Message content stays off lock screens unless you explicitly enable social previews below. Reactions default to in-app only.
        </p>
      </section>
      <section className="py-3">
        <h2 className="px-4 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          This device
        </h2>
        <SettingsRow
          icon={<BellRing size={18} className="text-gray-400" aria-hidden="true" />}
          label="Enable push notifications"
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
            <SettingsRow
              icon={<BellRing size={18} className="text-gray-400" aria-hidden="true" />}
              label="Show message and reaction previews in push"
              value={socialPushPending ? 'Saving…' :
                pushState.detailsEnabled !== true ? 'Enable task details on this device first' :
                socialPushDetailsEnabled ? 'Private previews may appear on lock screens' : 'Generic social push text'}
              showChevron={false}
              isToggle
              checked={socialPushDetailsEnabled}
              disabled={socialPushPending || pushState.detailsEnabled !== true}
              onClick={() => void toggleSocialPushDetails()}
            />
            <p className="px-5 pb-3 pt-2 text-xs text-gray-500">
              Separate opt-in for your account, off by default. Private message excerpts,
              reaction context, and shared-task titles can appear on devices where push
              details are also enabled. Your choice syncs across devices; delivered
              notifications cannot be recalled.
            </p>
            {socialPushError && <p className="px-5 pb-3 text-xs text-red-400" role="alert">{socialPushError}</p>}
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
