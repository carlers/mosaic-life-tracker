import { sendAppAction } from './appAction';
import type { ProfileCard } from './social';

export type DiscoveryControls = { allowBrowse: boolean; allowAppear: boolean; version: string };
export type FriendConnection = { profile: ProfileCard; relationship: 'none' | 'incoming' | 'outgoing' };

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
  viaFriendId: string, cursor = '', limit = 12
): Promise<{ items: FriendConnection[]; nextCursor: string }> {
  const result = await sendAppAction({ action: 'list_friend_connections', viaFriendId, cursor, limit });
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
    const relationship = item.relationship === 'incoming' || item.relationship === 'outgoing'
      ? item.relationship : 'none';
    items.push({ profile, relationship });
  }
  return { items, nextCursor: typeof result.nextCursor === 'string' ? result.nextCursor : '' };
}
