import { describe, expect, it, vi } from 'vitest';
import { migrateNotificationsBackend } from '../../scripts/migrate-notifications.mjs';
import { migrateNotificationRetentionIndex } from '../../scripts/migrate-notification-retention.mjs';
import { migratePushDetails } from '../../scripts/migrate-push-details.mjs';

describe('notifications backend migration', () => {
  it('creates both server-owned tables when they are absent', async () => {
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      if (method === 'GET') {
        throw Object.assign(new Error('missing'), { status: 404 });
      }
      if (method === 'POST') return { ...body, $id: body.tableId };
      throw new Error(`unexpected ${method} ${path}`);
    });

    await expect(
      migrateNotificationsBackend({ request, log: () => {} })
    ).resolves.toEqual([
      { tableId: 'notifications', created: true },
      { tableId: 'push_subscriptions', created: true },
    ]);

    const creates = request.mock.calls.filter(([method]) => method === 'POST');
    expect(creates).toHaveLength(2);
    expect(creates.map(([, , body]) => body.tableId)).toEqual([
      'notifications',
      'push_subscriptions',
    ]);
    for (const [, , body] of creates) {
      expect(body.permissions).toEqual([]);
      expect(body.rowSecurity).toBe(true);
    }
  });
  it('adds the index idempotently to an existing notifications table', async () => {
    const request = vi.fn(async (method: string, path: string, body?: unknown) => {
      if (method === 'GET' && path.endsWith('/notifications')) return { $id: 'notifications' };
      if (method === 'GET' && path.endsWith('/idx_notification_created')) {
        throw Object.assign(new Error('missing'), { status: 404 });
      }
      if (method === 'POST') return body;
      throw new Error(`unexpected ${method} ${path}`);
    });
    await expect(migrateNotificationRetentionIndex({ request })).resolves.toEqual({ created: true });
    expect(request).toHaveBeenCalledWith(
      'POST', '/tablesdb/life_tracker/tables/notifications/indexes',
      { key: 'idx_notification_created', type: 'key', columns: ['created_at'] }
    );
  });

  it('adds default-private subscription details without touching existing subscriptions', async () => {
    let created = false;
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      if (method === 'GET' && path.endsWith('/push_subscriptions')) {
        return { $id: 'push_subscriptions' };
      }
      if (method === 'GET' && path.endsWith('/include_task_details')) {
        if (!created) throw Object.assign(new Error('missing'), { status: 404 });
        return { key: 'include_task_details', type: 'boolean', required: false,
          default: false, status: 'available' };
      }
      if (method === 'POST' && path.endsWith('/columns/boolean')) {
        created = true;
        return body;
      }
      throw new Error(`Unexpected ${method} ${path}`);
    });
    expect(await migratePushDetails({ request })).toEqual({ created: true });
    expect(request).toHaveBeenCalledWith(
      'POST', '/tablesdb/life_tracker/tables/push_subscriptions/columns/boolean',
      { key: 'include_task_details', required: false, default: false, array: false },
    );
    expect(await migratePushDetails({ request })).toEqual({ created: false });
  });
});
