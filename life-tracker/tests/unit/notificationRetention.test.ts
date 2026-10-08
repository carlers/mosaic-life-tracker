import { describe, expect, it } from 'vitest';
import { activeNotifications, notificationExpiresAt } from '../../src/lib/notificationRetention';
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
  it('hides read alerts after 24 hours but never extends the seven-day deadline', () => {
    const row = item('one', arrived, { readAt: '2026-10-09T10:00:00.000Z' });
    expect(notificationExpiresAt(row)).toBe(Date.parse('2026-10-10T10:00:00.000Z'));
    expect(notificationExpiresAt({ ...row, readAt: '2026-10-15T09:00:00.000Z' }))
      .toBe(Date.parse('2026-10-15T10:00:00.000Z'));
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
