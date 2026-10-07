import { describe, expect, it, vi } from 'vitest';
import { migrateNotificationsBackend } from '../../scripts/migrate-notifications.mjs';

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
});
