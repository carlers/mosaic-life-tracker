import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleGetPushConfig,
  handleTaskCompletionEvent,
  notificationId,
  pushSubscriptionId,
} = require('../../appwrite-functions/message-action/notifications.js');

describe('notifications backend', () => {
  it('uses deterministic Appwrite-safe row IDs', () => {
    const notification = notificationId(
      'recipient_123',
      'task_456',
      '2026-10-07T10:00:00.000Z'
    );
    const subscription = pushSubscriptionId(
      'recipient_123',
      'https://push.example/subscription'
    );
    expect(notification).toMatch(/^not_[a-f0-9]{32}$/);
    expect(subscription).toMatch(/^ps_[a-f0-9]{32}$/);
    expect(notification.length).toBe(36);
    expect(subscription.length).toBe(35);
  });

  it('keeps Web Push disabled until all VAPID values are configured', () => {
    const prior = {
      publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
      privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
      subject: process.env.WEB_PUSH_VAPID_SUBJECT,
    };
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_VAPID_SUBJECT;
    expect(handleGetPushConfig()).toEqual({
      status: 200,
      body: { enabled: false, publicKey: '' },
    });
    if (prior.publicKey === undefined) delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    else process.env.WEB_PUSH_VAPID_PUBLIC_KEY = prior.publicKey;
    if (prior.privateKey === undefined) delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    else process.env.WEB_PUSH_VAPID_PRIVATE_KEY = prior.privateKey;
    if (prior.subject === undefined) delete process.env.WEB_PUSH_VAPID_SUBJECT;
    else process.env.WEB_PUSH_VAPID_SUBJECT = prior.subject;
  });

  it('does not create alerts for TodoMate-imported completions', async () => {
    const db = {
      getRow: vi.fn(),
      listRows: vi.fn(),
      createRow: vi.fn(),
    };
    const result = await handleTaskCompletionEvent(
      db,
      {
        $id: 'task_1',
        user_id: 'user_a',
        is_completed: true,
        completed_at: new Date().toISOString(),
        source: 'todomate',
      },
      'databases.life_tracker.tables.tasks.rows.task_1.update',
      vi.fn(),
      vi.fn()
    );
    expect(result.body.ignored).toBe('imported-task');
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('creates one idempotent recipient event for a visible mutual-friend completion', async () => {
    const category = {
      $id: 'cat_1',
      user_id: 'user_a',
      deleted: false,
      visibility: 'followers',
      color: '#10B981',
    };
    const db = {
      getRow: vi.fn(async ({ tableId }: { tableId: string }) => {
        if (tableId === 'categories') return category;
        throw Object.assign(new Error('not found'), { code: 404 });
      }),
      listRows: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              $id: 'fr_a_b',
              user_id: 'user_a',
              friend_id: 'user_b',
              status: 'accepted',
              deleted: false,
              friend_display_name: 'Bee',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              $id: 'fr_b_a',
              user_id: 'user_b',
              friend_id: 'user_a',
              status: 'accepted',
              deleted: false,
            },
          ],
        }),
      createRow: vi.fn(async () => ({})),
    };
    const completedAt = new Date().toISOString();
    const result = await handleTaskCompletionEvent(
      db,
      {
        $id: 'task_1',
        user_id: 'user_a',
        category_id: 'cat_1',
        visibility: '',
        is_completed: true,
        completed_at: completedAt,
        deleted: false,
        source: '',
      },
      'databases.life_tracker.tables.tasks.rows.task_1.update',
      vi.fn(),
      vi.fn()
    );
    expect(result.body.created).toBe(1);
    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(db.createRow.mock.calls[0][0]).toMatchObject({
      tableId: 'notifications',
      rowId: notificationId('user_b', 'task_1', completedAt),
      data: {
        recipient_id: 'user_b',
        actor_id: 'user_a',
        type: 'task_completed',
        task_id: 'task_1',
      },
      permissions: [],
    });
  });
});
