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
    expect(mockDb.listRows).toHaveBeenCalledTimes(6);
    expect(response.logs.at(-1)).toBe(
      'tombstone-gc: complete scanned=0 purged=0'
    );
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
});
