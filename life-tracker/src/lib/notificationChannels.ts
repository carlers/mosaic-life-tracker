/** Synced user-level preferences; browser/OS subscription controls stay device-local. */
export const ALERTS_CHANNELS_KEY = 'alertsChannels';
/** Explicit, account-synced consent for sensitive social push previews. */
export const ALERTS_SOCIAL_PUSH_DETAILS_SETTING_KEY = 'alertsSocialPushDetails';

// Channel names and default push consent share one authoritative registry.
// Public values retain the historical {type,label} and {feed,push} shapes.
const CHANNEL_DEFINITIONS = [
  ['friend_request', 'Friend requests', true],
  ['friend_accepted', 'Accepted requests', true],
  ['direct_message', 'Messages', true],
  ['message_reaction', 'Message reactions', false],
  ['task_reaction', 'Task reactions', false],
  ['shared_task_invite', 'Shared-task invitations', true],
  ['task_request_received', 'Task requests', true],
  ['task_request_status', 'Task request updates', false],
  ['task_completed', 'Friend completions', true],
] as const;
export type NotificationChannelType = typeof CHANNEL_DEFINITIONS[number][0];
export type SocialNotificationType = Exclude<NotificationChannelType, 'task_completed'>;
export interface ChannelPreference { feed: boolean; push: boolean; }
export type NotificationChannels = Record<NotificationChannelType, ChannelPreference>;

export const NOTIFICATION_CHANNELS = CHANNEL_DEFINITIONS.map(([type, label]) => ({ type, label }));
export const DEFAULT_NOTIFICATION_CHANNELS: Readonly<NotificationChannels> =
  Object.fromEntries(CHANNEL_DEFINITIONS.map(([type, , push]) => [type, { feed: true, push }]))
  as NotificationChannels;

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