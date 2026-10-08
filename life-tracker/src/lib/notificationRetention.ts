import type { NotificationItem } from './notifications';

export const UNREAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const READ_RETENTION_MS = 24 * 60 * 60 * 1000;

// Server-authored readAt and createdAt remain authoritative across devices.
// Legacy cache entries predate createdAt and use occurredAt conservatively.
export function notificationExpiresAt(
  item: Pick<NotificationItem, 'createdAt' | 'occurredAt' | 'readAt'>
): number {
  const arrived = Date.parse(item.createdAt || item.occurredAt);
  if (!Number.isFinite(arrived)) return 0;
  const unreadExpires = arrived + UNREAD_RETENTION_MS;
  const read = Date.parse(item.readAt || '');
  return Number.isFinite(read)
    ? Math.min(unreadExpires, read + READ_RETENTION_MS)
    : unreadExpires;
}

export function activeNotifications<T extends Pick<NotificationItem, 'createdAt' | 'occurredAt' | 'readAt'>>(
  items: T[],
  now = Date.now()
): T[] {
  return items.filter((item) => notificationExpiresAt(item) > now);
}
