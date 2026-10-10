import type { SharedTaskItem } from './taskShareQueue';

export type SharedLabelMode = 'names' | 'count';
export type SharedFriendName = { friendId: string; friendDisplayName?: string; friendUsername?: string };

export function sharedByDate(items: readonly SharedTaskItem[]): Map<string, SharedTaskItem[]> {
  const result = new Map<string, SharedTaskItem[]>();
  for (const item of items) {
    if (item.status !== 'accepted' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) continue;
    const group = result.get(item.date);
    if (group) group.push(item);
    else result.set(item.date, [item]);
  }
  return result;
}

export function ownerShareLabels(
  items: readonly SharedTaskItem[], friends: readonly SharedFriendName[],
  mode: SharedLabelMode, showPending: boolean,
): Map<string, string> {
  const friendNames = new Map(friends.map(friend => [
    friend.friendId, friend.friendDisplayName || friend.friendUsername || 'Friend',
  ]));
  const grouped = new Map<string, { accepted: string[]; pending: number }>();
  for (const item of items) {
    if (item.status !== 'accepted' && item.status !== 'pending') continue;
    const group = grouped.get(item.taskId) || { accepted: [], pending: 0 };
    if (item.status === 'accepted') group.accepted.push(friendNames.get(item.inviteeId || '') || 'Friend');
    else group.pending += 1;
    grouped.set(item.taskId, group);
  }
  const result = new Map<string, string>();
  for (const [id, { accepted, pending }] of grouped) {
    const names = accepted.length <= 2
      ? accepted.join(', ')
      : accepted.slice(0, 2).join(', ') + ' +' + (accepted.length - 2);
    const primary = accepted.length
      ? mode === 'count' ? accepted.length + (accepted.length === 1 ? ' friend' : ' friends') : names : '';
    const extras = pending && (showPending || !accepted.length) ? pending + ' pending' : '';
    result.set(id, 'Shared · ' + [primary, extras].filter(Boolean).join(' · '));
  }
  return result;
}
