import { describe, expect, it } from 'vitest';
import {
  activeNotifications, notificationExpiresAt, retainRecoverableNotifications,
  resolveUnreadRetentionDays, resolveReadRetentionHours,
} from '../../src/lib/notificationRetention';
import { groupNotificationActivity } from '../../src/lib/notificationGrouping';
import type { NotificationItem } from '../../src/lib/notifications';

function item(id: string, completedAt: string, overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id, type: 'task_completed', actorId: 'alice',
    actorName: 'Alice', actorUsername: 'alice', actorAvatarFileId: '',
    occurredAt: completedAt, createdAt: completedAt, readAt: '',
    categoryColor: '#10B981',
    task: { id, title: id, completedAt, date: completedAt.slice(0, 10) } as NotificationItem['task'],
    ...overrides,
  };
}

describe('Alerts retention', () => {
  const arrived = '2026-10-08T10:00:00.000Z';
  it('keeps unread activity seven days from arrival', () => {
    const row = item('one', arrived);
    expect(notificationExpiresAt(row)).toBe(Date.parse('2026-10-15T10:00:00.000Z'));
    expect(activeNotifications([row], Date.parse('2026-10-15T09:59:59.000Z'))).toHaveLength(1);
    expect(activeNotifications([row], Date.parse('2026-10-15T10:00:00.000Z'))).toHaveLength(0);
  });
  it('hides read alerts after 24 hours independently of the unread deadline', () => {
    const row = item('one', arrived, { readAt: '2026-10-09T10:00:00.000Z' });
    expect(notificationExpiresAt(row)).toBe(Date.parse('2026-10-10T10:00:00.000Z'));
    expect(notificationExpiresAt({ ...row, readAt: '2026-10-15T09:00:00.000Z' }))
      .toBe(Date.parse('2026-10-16T09:00:00.000Z'));
  });
  it('allows read alerts to outlive the unread interval after first read', () => {
    const row = item('late', arrived, { readAt: '2026-10-15T09:00:00.000Z' });
    expect(notificationExpiresAt(row, { unreadDays: 7, readHours: 168 }))
      .toBe(Date.parse('2026-10-22T09:00:00.000Z'));
    expect(notificationExpiresAt(row, { unreadDays: 7, readHours: 24 }))
      .toBe(Date.parse('2026-10-16T09:00:00.000Z'));
  });
  it('supports 30-day unread and at most 37-day physical receipt lifetime', () => {
    const row = item('max', arrived);
    const policy = { unreadDays: 30, readHours: 168 };
    expect(notificationExpiresAt(row, policy)).toBe(Date.parse('2026-11-07T10:00:00.000Z'));
    const lateRead = { ...row, readAt: '2026-11-07T09:00:00.000Z' };
    expect(notificationExpiresAt(lateRead, policy)).toBe(Date.parse('2026-11-14T09:00:00.000Z'));
  });
  it('uses safe default choices for malformed persisted settings', () => {
    expect(resolveUnreadRetentionDays('30')).toBe(7);
    expect(resolveUnreadRetentionDays(Infinity)).toBe(7);
    expect(resolveUnreadRetentionDays(30)).toBe(30);
    expect(resolveReadRetentionHours('never')).toBe(24);
    expect(resolveReadRetentionHours(168)).toBe(168);
  });
  it('preserves locally recoverable alerts across shorter retention setting changes', () => {
    const row = item('old', arrived);
    const nineDaysLater = Date.parse('2026-10-17T10:00:00.000Z');
    expect(activeNotifications([row], nineDaysLater)).toHaveLength(0);
    expect(retainRecoverableNotifications([row], nineDaysLater)).toHaveLength(1);
    expect(activeNotifications([row], nineDaysLater, { unreadDays: 14, readHours: 24 })).toHaveLength(1);
  });
  it('uses arrival time rather than completion time for late sync', () => {
    const row = item('offline', '2026-10-05T10:00:00.000Z', { createdAt: arrived });
    expect(notificationExpiresAt(row)).toBe(Date.parse('2026-10-15T10:00:00.000Z'));
  });
  it('groups only the same actor and fixed half-hour local completion bucket', () => {
    const a = item('a', '2026-10-08T10:01:00');
    const b = item('b', '2026-10-08T10:25:00');
    const c = item('c', '2026-10-08T10:32:00');
    const d = item('d', '2026-10-08T10:15:00', { actorId: 'bob' });
    const groups = groupNotificationActivity([b, c, d, a]);
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.items.some((x) => x.id === 'a'))?.items.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
