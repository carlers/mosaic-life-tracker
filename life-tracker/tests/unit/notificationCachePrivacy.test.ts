import { describe, expect, it } from 'vitest';
import { redactCachedNotificationDetails } from '../../src/lib/notificationCache';
import type { NotificationEntry } from '../../src/lib/notifications';

describe('social notification offline privacy', () => {
  it('persists generic metadata but not server-authorized snippets or reaction emoji', () => {
    const item: NotificationEntry = {
      id: 'not_' + 'a'.repeat(32), type: 'message_reaction',
      actorId: 'user_a', actorName: 'A', actorUsername: '',
      actorAvatarFileId: '', targetId: 'msg_1', destination: '/messages/user_a',
      occurredAt: '2026-10-15T00:00:00.000Z',
      createdAt: '2026-10-15T00:00:00.000Z', readAt: '',
      detail: 'Private message body', replyExcerpt: 'Private quote', emoji: '🔥',
    };
    const [cached] = redactCachedNotificationDetails([item]);
    expect(cached).toMatchObject({
      id: item.id, type: 'message_reaction', actorId: 'user_a',
      actorName: 'A', targetId: 'msg_1',
    });
    expect(cached).not.toHaveProperty('detail');
    expect(cached).not.toHaveProperty('replyExcerpt');
    expect(cached).not.toHaveProperty('emoji');
    expect(item).toHaveProperty('detail', 'Private message body');
  });

  it('does not strip existing friend completion content as part of a social-only change', () => {
    const item = {
      id: 'not_' + 'b'.repeat(32), type: 'task_completed',
      actorId: 'user_a', actorName: 'A', actorUsername: '',
      actorAvatarFileId: '', categoryColor: '#123456',
      occurredAt: '2026-10-15T00:00:00.000Z',
      createdAt: '2026-10-15T00:00:00.000Z', readAt: '',
      task: { id: 'task_1', title: 'Existing behavior' },
    } as NotificationEntry;
    expect(redactCachedNotificationDetails([item])[0]).toEqual(item);
  });
});
