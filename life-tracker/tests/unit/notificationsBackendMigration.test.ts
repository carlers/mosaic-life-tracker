import { describe, expect, it, vi } from 'vitest';
import { migrateNotificationsBackend } from '../../scripts/migrate-notifications.mjs';
import { migrateNotificationRetentionIndex } from '../../scripts/migrate-notification-retention.mjs';

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
      { key: 'idx_notification_created', type: 'key', attributes: ['created_at'] }
    );
  });

});
