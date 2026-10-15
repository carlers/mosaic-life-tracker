/** Synced user-level preferences; browser/OS subscription controls stay device-local. */
export const ALERTS_CHANNELS_KEY = 'alertsChannels';
/** Explicit, account-synced consent for sensitive social push previews. */
export const ALERTS_SOCIAL_PUSH_DETAILS_SETTING_KEY = 'alertsSocialPushDetails';

export const NOTIFICATION_CHANNELS = [
  { type: 'friend_request', label: 'Friend requests' },
  { type: 'friend_accepted', label: 'Accepted requests' },
  { type: 'direct_message', label: 'Messages' },
  { type: 'message_reaction', label: 'Message reactions' },
  { type: 'task_reaction', label: 'Task reactions' },
  { type: 'shared_task_invite', label: 'Shared-task invitations' },
  { type: 'task_completed', label: 'Friend completions' },
] as const;

export type NotificationChannelType = typeof NOTIFICATION_CHANNELS[number]['type'];
export type SocialNotificationType = Exclude<NotificationChannelType, 'task_completed'>;
export interface ChannelPreference { feed: boolean; push: boolean; }
export type NotificationChannels = Record<NotificationChannelType, ChannelPreference>;

export const DEFAULT_NOTIFICATION_CHANNELS: Readonly<NotificationChannels> = {
  friend_request: { feed: true, push: true },
  friend_accepted: { feed: true, push: true },
  direct_message: { feed: true, push: true },
  message_reaction: { feed: true, push: false },
  task_reaction: { feed: true, push: false },
  shared_task_invite: { feed: true, push: true },
  task_completed: { feed: true, push: true },
};

export function resolveNotificationChannels(value: unknown): NotificationChannels {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return Object.fromEntries(NOTIFICATION_CHANNELS.map(({ type }) => {
    const entry = source[type];
    const settings = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Partial<ChannelPreference> : {};
    return [type, {
      feed: typeof settings.feed === 'boolean'
        ? settings.feed : DEFAULT_NOTIFICATION_CHANNELS[type].feed,
      push: typeof settings.push === 'boolean'
        ? settings.push : DEFAULT_NOTIFICATION_CHANNELS[type].push,
    }];
  })) as NotificationChannels;
}