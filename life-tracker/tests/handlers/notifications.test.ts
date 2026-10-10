import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleGetPushConfig,
  handleRegisterPushSubscription,
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

  it('rejects a push registration captured for a different authenticated account', async () => {
    const db = {
      getRow: vi.fn(),
      createRow: vi.fn(),
      updateRow: vi.fn(),
    };
    const result = await handleRegisterPushSubscription(
      db,
      'user_b',
      {
        expectedUserId: 'user_a',
        endpoint: 'https://push.example/subscription',
        p256dh: 'key',
        auth: 'auth',
      },
      vi.fn(),
      vi.fn()
    );
    expect(result).toEqual({
      status: 409,
      body: { error: 'Account changed' },
    });
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('ignores task completions from before the Alerts launch cutoff', async () => {
    const db = {
      getRow: vi.fn(),
      listRows: vi.fn(),
      createRow: vi.fn(),
    };
    const result = await handleTaskCompletionEvent(
      db,
      {
        $id: 'task_prelaunch',
        user_id: 'user_a',
        is_completed: true,
        completed_at: '2026-10-07T16:03:59.000Z',
        source: '',
      },
      'tablesdb.life_tracker.tables.tasks.rows.task_prelaunch.update',
      vi.fn(),
      vi.fn()
    );
    expect(result.body.ignored).toBe('prelaunch-completion');
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('keeps post-launch completions eligible during a six-day offline delay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
    try {
      const db = {
        getRow: vi.fn(async ({ tableId }: { tableId: string }) => {
          if (tableId === 'tasks') return {
            $id: 'task_offline', user_id: 'user_a', category_id: 'cat_1',
            visibility: '', is_completed: true,
            completed_at: '2026-10-08T12:00:00.000Z', date: '2026-10-08',
            deleted: false, source: '',
          };
          if (tableId === 'categories') {
            return {
              $id: 'cat_1',
              user_id: 'user_a',
              deleted: false,
              visibility: 'followers',
            };
          }
          throw Object.assign(new Error('not found'), { code: 404 });
        }),
        listRows: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [{
              $id: 'fr_a_b',
              user_id: 'user_a',
              friend_id: 'user_b',
              status: 'accepted',
              deleted: false,
            }],
          })
          .mockResolvedValueOnce({
            rows: [{
              $id: 'fr_b_a',
              user_id: 'user_b',
              friend_id: 'user_a',
              status: 'accepted',
              deleted: false,
            }],
          }),
        createRow: vi.fn(async () => ({})),
      };
      const result = await handleTaskCompletionEvent(
        db,
        {
          $id: 'task_offline',
          user_id: 'user_a',
          category_id: 'cat_1',
          visibility: '',
          is_completed: true,
          completed_at: '2026-10-08T12:00:00.000Z',
          deleted: false,
          source: '',
        },
        'tablesdb.life_tracker.tables.tasks.rows.task_offline.update',
        vi.fn(),
        vi.fn()
      );
      expect(result.body.created).toBe(1);
      expect(db.createRow).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
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
      'tablesdb.life_tracker.tables.tasks.rows.task_1.update',
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
        if (tableId === 'tasks') return {
          $id: 'task_1', user_id: 'user_a', category_id: 'cat_1',
          visibility: '', is_completed: true, completed_at: completedAt,
          date: '2026-10-10', deleted: false, source: '', title: 'Ship alerts',
        };
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
      'tablesdb.life_tracker.tables.tasks.rows.task_1.update',
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

  it.each([
    ['deleted', { deleted: true }],
    ['uncompleted', { is_completed: false }],
    ['completed-at-changed', { completed_at: '2026-10-08T12:00:00.000Z' }],
    ['different owner', { user_id: 'unrelated-user' }],
    ['imported live row', { source: 'todomate' }],
    ['private task', { visibility: 'private' }],
  ])('suppresses delayed completion events for a %s live task before any push or receipt', async (_reason, liveOverrides) => {
    const completedAt = new Date().toISOString();
    const live = {
      $id: 'task_1', user_id: 'user_a',
      is_completed: true, completed_at: completedAt,
      deleted: false, visibility: 'followers',
      category_id: '', source: '', title: 'Sensitive title',
      ...liveOverrides,
    };
    const db = {
      getRow: vi.fn(async () => live),
      listRows: vi.fn().mockResolvedValue({ rows: [] }),
      createRow: vi.fn(),
    };
    const result = await handleTaskCompletionEvent(
      db, {
        $id: 'task_1', user_id: 'user_a',
        is_completed: true, completed_at: completedAt,
        deleted: false, visibility: 'followers', source: '',
      },
      'tablesdb.life_tracker.tables.tasks.rows.task_1.update',
      vi.fn(), vi.fn()
    );
    expect(result.body.ignored).toMatch(/^(stale-completion|private-task)$/);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('suppresses missing live tasks instead of using a stale public event snapshot', async () => {
    const db = {
      getRow: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 404 })),
      listRows: vi.fn(),
      createRow: vi.fn(),
    };
    const completedAt = new Date().toISOString();
    const result = await handleTaskCompletionEvent(
      db, {
        $id: 'task_gone', user_id: 'user_a',
        is_completed: true, completed_at: completedAt,
        deleted: false, visibility: 'followers', source: '',
      },
      'tablesdb.life_tracker.tables.tasks.rows.task_gone.update', vi.fn(), vi.fn()
    );
    expect(result.body.ignored).toBe('stale-completion');
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('uses recipient-side friendship metadata for the actor in the feed', async () => {
    const { handleGetNotifications } = require('../../appwrite-functions/message-action/notifications.js');
    const completedAt = new Date().toISOString();
    const db = {
      listRows: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{
            $id: 'not_1',
            recipient_id: 'user_b',
            actor_id: 'user_a',
            type: 'task_completed',
            task_id: 'task_1',
            completed_at: completedAt,
            occurred_at: completedAt,
            read_at: '',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            $id: 'fr_b_a',
            user_id: 'user_b',
            friend_id: 'user_a',
            status: 'accepted',
            deleted: false,
            friend_display_name: 'Alice',
            friend_username: 'alice',
            friend_avatar_file_id: 'avatar_a',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            $id: 'fr_a_b',
            user_id: 'user_a',
            friend_id: 'user_b',
            status: 'accepted',
            deleted: false,
            friend_display_name: 'Bee',
          }],
        }),
      getRow: vi.fn(async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return {
            $id: 'task_1',
            user_id: 'user_a',
            title: 'Ship alerts',
            category_id: 'cat_1',
            visibility: 'followers',
            is_completed: true,
            completed_at: completedAt,
            deleted: false,
            date: '2026-10-07',
            reactions: '',
          };
        }
        if (tableId === 'categories') {
          return {
            $id: 'cat_1',
            user_id: 'user_a',
            deleted: false,
            visibility: 'followers',
            color: '#10B981',
          };
        }
        throw Object.assign(new Error('not found'), { code: 404 });
      }),
    };
    const result = await handleGetNotifications(
      db,
      'user_b',
      { limit: 30 },
      vi.fn(),
      vi.fn()
    );
    expect(result.body.items).toHaveLength(1);
    expect(result.body.items[0]).toMatchObject({
      actorId: 'user_a',
      actorName: 'Alice',
      actorUsername: 'alice',
      actorAvatarFileId: 'avatar_a',
    });
  });
  it('does not regenerate task completions older than seven days', async () => {
    const { handleTaskCompletionEvent } = require('../../appwrite-functions/message-action/notifications.js');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    try {
      const db = { getRow: vi.fn(), listRows: vi.fn(), createRow: vi.fn() };
      const result = await handleTaskCompletionEvent(db, {
        $id: 'late', user_id: 'alice',
        completed_at: '2026-10-12T12:00:00.000Z',
        is_completed: true,
      }, 'tablesdb.life_tracker.tables.tasks.rows.late.update', vi.fn(), vi.fn());
      expect(result.body.ignored).toBe('expired-completion');
      expect(db.createRow).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never resets the first-read timestamp on repeated marking', async () => {
    const { handleMarkNotificationsRead } = require('../../appwrite-functions/message-action/notifications.js');
    const db = {
      getRow: vi.fn().mockResolvedValue({
        $id: 'receipt1', recipient_id: 'alice', read_at: '2026-10-08T07:00:00.000Z',
      }),
      updateRow: vi.fn(),
    };
    const result = await handleMarkNotificationsRead(db, 'alice', { ids: ['receipt1'] }, vi.fn(), vi.fn());
    expect(result.body.marked).toBe(0);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('rejects malformed direct alert IDs before touching the database', async () => {
    const { handleGetNotification } = require('../../appwrite-functions/message-action/notifications.js');
    const db = { getRow: vi.fn() };
    expect((await handleGetNotification(db, 'user_b', { id: '../not_123' })).status).toBe(400);
    expect(db.getRow).not.toHaveBeenCalled();
  });

  it('resolves an older notification by exact ID with live recipient and task checks', async () => {
    const { handleGetNotification } = require('../../appwrite-functions/message-action/notifications.js');
    const id = 'not_' + 'a'.repeat(32);
    const completedAt = new Date().toISOString();
    const rows: Record<string, any> = {
      notifications: {
        $id: id, type: 'task_completed', recipient_id: 'user_b',
        actor_id: 'user_a', task_id: 'task_1', completed_at: completedAt,
        occurred_at: completedAt, created_at: completedAt, read_at: '',
      },
      tasks: {
        $id: 'task_1', user_id: 'user_a', title: 'Cleaned room',
        completed_at: completedAt, is_completed: true, deleted: false,
        visibility: 'followers', category_id: '', date: '2026-10-08',
      },
    };
    const db = {
      getRow: vi.fn(async ({ tableId }: { tableId: string }) => rows[tableId] || null),
      listRows: vi.fn()
        .mockResolvedValueOnce({ rows: [{
          user_id: 'user_b', friend_id: 'user_a', status: 'accepted',
          deleted: false, friend_display_name: 'Alex',
        }] })
        .mockResolvedValueOnce({ rows: [{
          user_id: 'user_a', friend_id: 'user_b', status: 'accepted', deleted: false,
        }] }),
    };
    const result = await handleGetNotification(db, 'user_b', { id });
    expect(result.status).toBe(200);
    expect(result.body.item).toMatchObject({
      id, actorName: 'Alex', task: { id: 'task_1', title: 'Cleaned room' },
    });
    expect((await handleGetNotification(db, 'user_c', { id })).status).toBe(404);
  });

  it('keeps per-device task details default-private and validates owner on updates', async () => {
    const { handleGetPushDetails, handleSetPushDetails, pushSubscriptionId } =
      require('../../appwrite-functions/message-action/notifications.js');
    const endpoint = 'https://push.example/device';
    const id = pushSubscriptionId('user_b', endpoint);
    const db = {
      getRow: vi.fn(async ({ rowId }: { rowId: string }) => ({
        $id: rowId, user_id: 'user_b', endpoint,
      })),
      updateRow: vi.fn().mockResolvedValue({}),
    };
    const initial = await handleGetPushDetails(db, 'user_b', {
      expectedUserId: 'user_b', endpoint,
    });
    expect(initial.body.includeTaskDetails).toBe(false);
    expect((await handleSetPushDetails(db, 'user_b', {
      expectedUserId: 'user_c', endpoint, includeTaskDetails: true,
    })).status).toBe(409);
    expect(db.updateRow).not.toHaveBeenCalled();
    const updated = await handleSetPushDetails(db, 'user_b', {
      expectedUserId: 'user_b', endpoint, includeTaskDetails: true,
    });
    expect(updated.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'push_subscriptions', rowId: id,
      data: expect.objectContaining({ include_task_details: true }),
    }));
  });

});
