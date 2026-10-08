import type { NotificationItem } from './notifications';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const UNREAD_RETENTION_DAYS = [1, 3, 7, 14, 30] as const;
export const READ_RETENTION_HOURS = [1, 12, 24, 72, 168] as const;
export const DEFAULT_UNREAD_RETENTION_DAYS = 7;
export const DEFAULT_READ_RETENTION_HOURS = 24;
export const MAX_RECEIPT_RETENTION_MS = 37 * DAY_MS;
export const UNREAD_RETENTION_MS = DEFAULT_UNREAD_RETENTION_DAYS * DAY_MS;
export const READ_RETENTION_MS = DEFAULT_READ_RETENTION_HOURS * HOUR_MS;

export const ALERTS_UNREAD_RETENTION_SETTING_KEY = 'alertsUnreadRetentionDays';
export const ALERTS_READ_RETENTION_SETTING_KEY = 'alertsReadRetentionHours';

export interface AlertRetentionPolicy {
  unreadDays: number;
  readHours: number;
}

export const DEFAULT_ALERT_RETENTION: Readonly<AlertRetentionPolicy> = {
  unreadDays: DEFAULT_UNREAD_RETENTION_DAYS,
  readHours: DEFAULT_READ_RETENTION_HOURS,
};

export function resolveUnreadRetentionDays(value: unknown): number {
  return typeof value === 'number' &&
    UNREAD_RETENTION_DAYS.some((option) => option === value)
    ? value : DEFAULT_UNREAD_RETENTION_DAYS;
}

export function resolveReadRetentionHours(value: unknown): number {
  return typeof value === 'number' &&
    READ_RETENTION_HOURS.some((option) => option === value)
    ? value : DEFAULT_READ_RETENTION_HOURS;
}

// Server-authored readAt and createdAt remain authoritative across devices.
// Once read, the chosen read timer is independent of the unread timer.
// A 37-day physical server limit caps every valid combination.
export function notificationExpiresAt(
  item: Pick<NotificationItem, 'createdAt' | 'occurredAt' | 'readAt'>,
  policy: AlertRetentionPolicy = DEFAULT_ALERT_RETENTION
): number {
  const arrived = Date.parse(item.createdAt || item.occurredAt);
  if (!Number.isFinite(arrived)) return 0;
  const read = Date.parse(item.readAt || '');
  const expires = Number.isFinite(read)
    ? read + resolveReadRetentionHours(policy.readHours) * HOUR_MS
    : arrived + resolveUnreadRetentionDays(policy.unreadDays) * DAY_MS;
  return Math.min(arrived + MAX_RECEIPT_RETENTION_MS, expires);
}

export function activeNotifications<
  T extends Pick<NotificationItem, 'createdAt' | 'occurredAt' | 'readAt'>
>(
  items: T[],
  now = Date.now(),
  policy: AlertRetentionPolicy = DEFAULT_ALERT_RETENTION
): T[] {
  return items.filter((item) => notificationExpiresAt(item, policy) > now);
}

// The cache retains receipts that may be made visible by a later settings
// change, even if they are hidden by the current user's shorter policy.
export function retainRecoverableNotifications<
  T extends Pick<NotificationItem, 'createdAt' | 'occurredAt' | 'readAt'>
>(items: T[], now = Date.now()): T[] {
  return activeNotifications(items, now, { unreadDays: 30, readHours: 168 });
}
