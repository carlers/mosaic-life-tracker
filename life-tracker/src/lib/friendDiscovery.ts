import { sendAppAction } from './appAction';
import type { ProfileCard } from './social';

export type DiscoveryControls = { allowBrowse: boolean; allowAppear: boolean; version: string };
export type FriendConnection = { profile: ProfileCard; relationship: 'none' | 'incoming' | 'outgoing' | 'friends' };

/**
 * Only the server's explicit discovery kill-switch response is a disabled
 * feature. Other 503s may be transient backend failures; don't mislabel them.
 */
export function isDiscoveryNotEnabledError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const error = cause as { code?: unknown; result?: unknown };
  if (error.code !== 503 || !error.result || typeof error.result !== 'object') return false;
  return (error.result as { error?: unknown }).error === 'Discovery unavailable';
}

/** Generic privacy denial for a private, blocked, deleted or unauthorized via-friend.
 * Never reveal which privacy condition failed, and don't suggest retrying a 404.
 */
export function isDiscoveryPrivateError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const error = cause as { code?: unknown; result?: unknown };
  if (error.code !== 404 || !error.result || typeof error.result !== 'object') return false;
  return (error.result as { error?: unknown }).error === 'Unavailable';
}

function parseControls(result: Record<string, unknown>): DiscoveryControls {
  return {
    allowBrowse: result.allowBrowse === true,
    allowAppear: result.allowAppear === true,
    version: typeof result.version === 'string' ? result.version : '',
  };
}
export async function getDiscoveryControls(): Promise<DiscoveryControls> {
  return parseControls(await sendAppAction({ action: 'get_social_discovery_controls' }));
}
export async function setDiscoveryControls(field: 'allowBrowse' | 'allowAppear',
  value: boolean, expectedVersion: string): Promise<DiscoveryControls> {
  return parseControls(await sendAppAction({
    action: 'set_social_discovery_controls', field, value, expectedVersion,
  }));
}
export async function listFriendConnections(
  viaFriendId: string, cursor = '', limit = 12, suggestionsOnly = false
): Promise<{ items: FriendConnection[]; nextCursor: string }> {
  const result = await sendAppAction({ action: 'list_friend_connections', viaFriendId, cursor, limit, suggestionsOnly });
  const raw = Array.isArray(result.items) ? result.items : [];
  const items: FriendConnection[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    if (typeof item.user_id !== 'string' || typeof item.username !== 'string') continue;
    const profile: ProfileCard = {
      $id: 'profile_' + item.user_id,
      user_id: item.user_id,
      username: item.username,
      display_name: typeof item.display_name === 'string' ? item.display_name : item.username,
      avatar_file_id: typeof item.avatar_file_id === 'string' ? item.avatar_file_id : '',
      bio: typeof item.bio === 'string' ? item.bio : '',
      is_searchable: true,
    };
    const relationship = item.relationship === 'incoming' || item.relationship === 'outgoing' || item.relationship === 'friends'
      ? item.relationship : 'none';
    items.push({ profile, relationship });
  }
  return { items, nextCursor: typeof result.nextCursor === 'string' ? result.nextCursor : '' };
}
