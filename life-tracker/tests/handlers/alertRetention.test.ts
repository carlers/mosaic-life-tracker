import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeSettingsRowId as frontendSettingsId } from '../../src/lib/settingsRowId';

const require = createRequire(import.meta.url);
const {
  DEFAULT_POLICY,
  MAX_RECEIPT_RETENTION_MS,
  makeSettingsRowId,
  notificationExpiresAt,
  loadAlertRetention,
} = require('../../appwrite-functions/message-action/alert-retention.js');
const {
  handleGetNotifications,
  handleGetNotification,
  handleMarkNotificationsRead,
} = require('../../appwrite-functions/message-action/notifications.js');

const NOW = '2026-10-20T12:00:00.000Z';
const OLD = '2026-10-10T12:00:00.000Z';
const READ_AT = '2026-10-15T12:00:00.000Z';
const alertId = 'not_' + 'a'.repeat(32);
const caller = 'user_b';

function setting(userId: string, key: string, value: unknown, overrides: Record<string, unknown> = {}) {
  return { user_id: userId, key, value: JSON.stringify(value), deleted: false, ...overrides };
}
const settings = {
  unread: setting(caller, 'alertsUnreadRetentionDays', 14),
  read: setting(caller, 'alertsReadRetentionHours', 168),
};

function fixtureDb(readAt = '', useSettings = true) {
  let friendshipReads = 0;
  const row = {
    $id: alertId,
    recipient_id: caller,
    actor_id: 'user_a',
    task_id: 'task_a',
    type: 'task_completed',
    occurred_at: OLD,
    created_at: OLD,
    completed_at: OLD,
    read_at: readAt,
  };
  const task = {
    $id: 'task_a',
    user_id: 'user_a',
    title: 'Earlier friend activity',
    category_id: 'cat_a',
    date: '2026-10-10',
    is_completed: true,
    completed_at: OLD,
    visibility: 'followers',
    deleted: false,
  };
  return {
    getRow: vi.fn(async ({ tableId, rowId }: { tableId: string; rowId: string }) => {
      if (tableId === 'settings' && useSettings) {
        if (rowId === makeSettingsRowId(caller, settings.unread.key)) return settings.unread;
        if (rowId === makeSettingsRowId(caller, settings.read.key)) return settings.read;
      }
      if (tableId === 'notifications') return row;
      if (tableId === 'tasks') return task;
      if (tableId === 'categories') return {
        $id: 'cat_a', user_id: 'user_a', visibility: 'followers', color: '#10B981', deleted: false,
      };
      throw Object.assign(new Error('not found'), { code: 404 });
    }),
    listRows: vi.fn(async ({ tableId }: { tableId: string }) => {
      if (tableId === 'notifications') return { rows: [row] };
      if (tableId === 'friendships') {
        // Forward and reverse ownership lookups are issued in that order.
        // Appwrite Query serializes its predicates, so do not inspect a
        // fake internal query shape to determine the user's direction.
        const isRecipient = friendshipReads++ === 0;
        return { rows: [isRecipient
          ? { user_id: caller, friend_id: 'user_a', status: 'accepted', deleted: false, friend_display_name: 'Alex' }
          : { user_id: 'user_a', friend_id: caller, status: 'accepted', deleted: false }] };
      }
      return { rows: [] };
    }),
    updateRow: vi.fn().mockResolvedValue({}),
  };
}

afterEach(() => vi.useRealTimers());

describe('account-scoped Alerts retention backend', () => {
  it('shares exact settings row IDs with the client including long owner IDs', () => {
    const ids = ['user_b', 'very_long_user_id_value_exceeding_maximum_length'];
    for (const id of ids) {
      for (const key of ['alertsUnreadRetentionDays', 'alertsReadRetentionHours']) {
        expect(makeSettingsRowId(id, key)).toBe(frontendSettingsId(id, key));
      }
    }
  });

  it('loads only trusted recipient settings and defaults missing or malformed rows', async () => {
    const db = fixtureDb();
    expect(await loadAlertRetention(db, caller)).toEqual({ unreadDays: 14, readHours: 168 });
    const malformed = {
      getRow: vi.fn(async ({ rowId }: { rowId: string }) =>
        rowId === makeSettingsRowId(caller, settings.unread.key)
          ? setting('other_user', settings.unread.key, 30)
          : setting(caller, settings.read.key, 999)),
    };
    expect(await loadAlertRetention(malformed, caller)).toEqual(DEFAULT_POLICY);
    expect(await loadAlertRetention(fixtureDb('', false), caller)).toEqual(DEFAULT_POLICY);
    expect(malformed.getRow).toHaveBeenCalledTimes(2);
  });

  it('uses independent read and unread clocks capped by the 37-day physical lifetime', () => {
    const policy = { unreadDays: 14, readHours: 168 };
    expect(notificationExpiresAt({ created_at: OLD, occurred_at: OLD, read_at: '' }, policy))
      .toBe(Date.parse('2026-10-24T12:00:00.000Z'));
    expect(notificationExpiresAt({ created_at: OLD, occurred_at: OLD, read_at: READ_AT }, policy))
      .toBe(Date.parse('2026-10-22T12:00:00.000Z'));
    const lateRead = new Date(Date.parse(OLD) + 30 * 86_400_000 - 60_000).toISOString();
    expect(notificationExpiresAt({ created_at: OLD, read_at: lateRead }, { unreadDays: 30, readHours: 168 }))
      .toBe(Date.parse(lateRead) + 168 * 3_600_000);
    expect(MAX_RECEIPT_RETENTION_MS).toBe(37 * 86_400_000);
  });

  it('exposes old but retained unread activity only when the authenticated account permits it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const longer = fixtureDb();
    const output = await handleGetNotifications(longer, caller, { limit: 30, unreadDays: 30 }, vi.fn(), vi.fn());
    expect(output.status).toBe(200);
    expect(output.body.items).toHaveLength(1);
    expect(output.body.items[0].id).toBe(alertId);
    expect(longer.getRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'settings', rowId: makeSettingsRowId(caller, 'alertsUnreadRetentionDays'),
    }));

    const defaults = fixtureDb('', false);
    const defaultOutput = await handleGetNotifications(defaults, caller, { limit: 30, unreadDays: 30 }, vi.fn(), vi.fn());
    expect(defaultOutput.body.items).toHaveLength(0);
  });

  it('applies the same read timer to exact push taps and cannot reset the first read timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const db = fixtureDb(READ_AT);
    const direct = await handleGetNotification(db, caller, { id: alertId, readHours: 1 });
    expect(direct.status).toBe(200);
    const fallbackDb = fixtureDb(READ_AT, false);
    expect((await handleGetNotification(fallbackDb, caller, { id: alertId })).status).toBe(404);
    expect((await handleGetNotification(db, 'other_user', { id: alertId })).status).toBe(404);

    const marked = await handleMarkNotificationsRead(db, caller, { ids: [alertId] }, vi.fn(), vi.fn());
    expect(marked.body.marked).toBe(0);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('accepts a still-active older unread alert for first read, but not an expired one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const db = fixtureDb();
    const result = await handleMarkNotificationsRead(db, caller, { ids: [alertId] }, vi.fn(), vi.fn());
    expect(result.body.marked).toBe(1);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'notifications', rowId: alertId, data: { read_at: NOW },
    }));
    const fallbackDb = fixtureDb('', false);
    expect((await handleMarkNotificationsRead(fallbackDb, caller, { ids: [alertId] }, vi.fn(), vi.fn())).body.marked).toBe(0);
    expect(fallbackDb.updateRow).not.toHaveBeenCalled();
  });
});
