import type { FriendshipDocument, MessageDocument } from '../db/schema';

export type FriendSortMode = 'latest' | 'closest';
export type FriendInteraction = { count: number; lastAt: number };
const WINDOW_MS = 90 * 86400_000;
export function resolveFriendSortMode(value: unknown): FriendSortMode {
  return value === 'closest' ? 'closest' : 'latest';
}
function timeOf(value?: string): number {
  const n = Date.parse(value || '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function compareLatest(a: FriendshipDocument, b: FriendshipDocument): number {
  const aa = timeOf(a.acceptedAt), bb = timeOf(b.acceptedAt);
  if (!!aa !== !!bb) return aa ? -1 : 1;
  const aDate = aa || timeOf(a.createdAt), bDate = bb || timeOf(b.createdAt);
  if (aDate !== bDate) return bDate - aDate;
  return (a.friendDisplayName || a.friendUsername).toLowerCase().localeCompare(
    (b.friendDisplayName || b.friendUsername).toLowerCase()) ||
    a.friendId.localeCompare(b.friendId);
}
export function rankFriendInteractions(messages: readonly MessageDocument[], userId: string,
  friends: readonly FriendshipDocument[], now = Date.now()): ReadonlyMap<string, FriendInteraction> {
  const accepted = new Map(friends.filter(f => f.userId === userId && !f.isDeleted &&
    f.status === 'accepted').map(f => [f.friendId, f] as const));
  const counts = new Map<string, FriendInteraction>();
  const seen = new Set<string>();
  for (const message of messages) {
    if (message.userId !== userId || message.isDeleted || message.isUnsent ||
        message.deliveryStatus !== 'delivered') continue;
    const other = message.senderId === userId ? message.recipientId :
      message.recipientId === userId ? message.senderId : '';
    const friend = accepted.get(other);
    if (!friend) continue;
    const t = timeOf(message.createdAt), acceptedAt = timeOf(friend.acceptedAt);
    if (!t || t < now - WINDOW_MS || t > now + 60_000 ||
        (acceptedAt > 0 && t < acceptedAt)) continue;
    const uniqueId = message.direction === 'incoming'
      ? message.originalMessageId || message.id : message.id;
    if (seen.has(uniqueId)) continue;
    seen.add(uniqueId);
    const prior = counts.get(other);
    counts.set(other, { count: (prior?.count || 0) + 1, lastAt: Math.max(prior?.lastAt || 0, t) });
  }
  return counts;
}
export function sortFriendRows(rows: readonly FriendshipDocument[], mode: FriendSortMode,
  scores: ReadonlyMap<string, FriendInteraction> = new Map()): FriendshipDocument[] {
  return rows.filter(f => f.status === 'accepted' && !f.isDeleted).slice().sort((a, b) => {
    if (mode === 'closest') {
      const x = scores.get(a.friendId), y = scores.get(b.friendId);
      if ((x?.count || 0) !== (y?.count || 0)) return (y?.count || 0) - (x?.count || 0);
      if ((x?.lastAt || 0) !== (y?.lastAt || 0)) return (y?.lastAt || 0) - (x?.lastAt || 0);
    }
    return compareLatest(a, b);
  });
}
