import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

const requireCjs = createRequire(import.meta.url);
const tombstoneGc: any = requireCjs(
  '../../appwrite-functions/message-action/tombstone-gc.js'
);

const fixedNow = new Date('2026-09-22T00:00:00.000Z');

describe('message-action / scheduled tombstone GC', () => {
  const originalRetention = process.env.TOMBSTONE_RETENTION_DAYS;

  beforeEach(() => {
    process.env.TOMBSTONE_RETENTION_DAYS = '90';
  });

  afterEach(() => {
    if (originalRetention === undefined) {
      delete process.env.TOMBSTONE_RETENTION_DAYS;
    } else {
      process.env.TOMBSTONE_RETENTION_DAYS = originalRetention;
    }
  });

  it('uses a 90-day retention cutoff by default', () => {
    const cutoff = tombstoneGc.cutoffIso(fixedNow);
    expect(cutoff).toBe('2026-06-24T00:00:00.000Z');
  });

  it('purges only rows selected as deleted and older than the cutoff', async () => {
    const listRows = vi.fn().mockResolvedValue({
      rows: [{ $id: 'old_deleted' }],
    });
    const deleteRow = vi.fn().mockResolvedValue(undefined);

    const result = await tombstoneGc.purgeTable(
      { listRows, deleteRow },
      'tasks',
      '2026-06-24T00:00:00.000Z',
      vi.fn()
    );

    expect(result).toEqual({ scanned: 1, purged: 1 });
    expect(deleteRow).toHaveBeenCalledWith({
      databaseId: 'life_tracker',
      tableId: 'tasks',
      rowId: 'old_deleted',
    });

    const request = listRows.mock.calls[0][0];
    expect(request.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'equal', key: 'deleted', value: true }),
        expect.objectContaining({
          op: 'lessThan',
          key: 'updated_at',
          value: '2026-06-24T00:00:00.000Z',
        }),
      ])
    );
  });

  it('applies the GC to every synced collection', async () => {
    const listRows = vi.fn().mockResolvedValue({ rows: [] });

    const results = await tombstoneGc.runGc(
      { listRows, deleteRow: vi.fn() },
      '2026-06-24T00:00:00.000Z',
      vi.fn()
    );

    expect(Object.keys(results)).toEqual([
      'tasks',
      'categories',
      'diary',
      'settings',
      'friendships',
      'messages',
    ]);
    expect(listRows).toHaveBeenCalledTimes(6);
  });

  // Regression: docs/TOMBSTONE_RETENTION.md — Garbage collection.
  it('re-queries after deleting a full page instead of using a deleted cursor', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      $id: `old_${String(index).padStart(3, '0')}`,
    }));
    const listRows = vi
      .fn()
      .mockResolvedValueOnce({ rows: firstPage })
      .mockResolvedValueOnce({ rows: [{ $id: 'old_100' }] });
    const deleteRow = vi.fn().mockResolvedValue(undefined);

    const result = await tombstoneGc.purgeTable(
      { listRows, deleteRow },
      'tasks',
      '2026-06-24T00:00:00.000Z',
      vi.fn()
    );

    expect(result).toEqual({ scanned: 101, purged: 101 });
    expect(listRows).toHaveBeenCalledTimes(2);
    expect(deleteRow).toHaveBeenCalledTimes(101);
    for (const call of listRows.mock.calls) {
      expect(
        call[0].queries.some(
          (query: { op?: string }) => query.op === 'cursorAfter'
        )
      ).toBe(false);
    }
  });

  // Regression: docs/TOMBSTONE_RETENTION.md — Garbage collection.
  it('runs GC for a schedule trigger without requiring a user session', async () => {
    const mockDb = makeMockDb();
    mockDb.listRows.mockResolvedValue({ rows: [] });

    const response = await invoke({
      mockDb,
      body: {},
      trigger: 'schedule',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      retentionDays: 90,
      totals: { scanned: 0, purged: 0 },
    });
    expect(response.body.cutoff).toEqual(expect.any(String));
    expect(Object.keys(response.body.results)).toEqual([
      'tasks',
      'categories',
      'diary',
      'settings',
      'friendships',
      'messages',
    ]);
    // One server-only read checks durable account-deletion jobs before the
    // six ordinary tombstone-GC table scans.
    expect(mockDb.listRows).toHaveBeenCalledTimes(8);
    expect(response.logs).toContain(
      'account-deletion: scheduled processed=0 failed=0'
    );
    expect(response.logs).toContain(
      'tombstone-gc: complete scanned=0 purged=0'
    );
    expect(response.logs.at(-1)).toMatch(/^notifications-gc: purged=0/);
    expect(response.errors).toEqual([]);
  });

  // Regression: docs/TOMBSTONE_RETENTION.md — GC is not browser-callable.
  it('keeps non-scheduled unauthenticated executions behind normal auth', async () => {
    const mockDb = makeMockDb();

    const response = await invoke({
      mockDb,
      body: { action: 'tombstone_gc' },
      trigger: 'http',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(mockDb.listRows).not.toHaveBeenCalled();
    expect(mockDb.deleteRow).not.toHaveBeenCalled();
  });
  it('purges expired notification receipts in bounded batches without cursoring deleted rows', async () => {
    const oldRows = [{ $id: 'old1' }, { $id: 'old2' }];
    const db = {
      listRows: vi.fn().mockResolvedValueOnce({ rows: oldRows }),
      deleteRow: vi.fn().mockResolvedValue(undefined),
    };
    const result = await tombstoneGc.purgeExpiredNotifications(
      db, new Date('2026-10-08T12:00:00.000Z'), vi.fn()
    );
    expect(result).toEqual({
      purged: 2,
      cutoff: '2026-09-01T12:00:00.000Z',
    });
    expect(db.deleteRow).toHaveBeenCalledTimes(2);
    expect(db.listRows.mock.calls[0][0].queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'lessThan', key: 'created_at',
          value: '2026-09-01T12:00:00.000Z',
        }),
      ])
    );
  });

});
