import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);
const appwritePath = requireCjs.resolve('node-appwrite');
let mockTablesDb: {
  listRows: ReturnType<typeof vi.fn>;
  deleteRow: ReturnType<typeof vi.fn>;
} | null = null;
(requireCjs as unknown as { cache: Record<string, unknown> }).cache[appwritePath] = {
  id: appwritePath,
  path: appwritePath,
  filename: appwritePath,
  loaded: true,
  parent: null,
  children: [],
  paths: [],
  exports: {
    Client: class Client {
      setEndpoint() { return this; }
      setProject() { return this; }
      setKey() { return this; }
    },
    TablesDB: class TablesDB {
      constructor() {
        if (!mockTablesDb) throw new Error('Missing TablesDB mock');
        return mockTablesDb;
      }
    },
    Query: {
      equal: (key: string, value: unknown) => ({ op: 'equal', key, value }),
      lessThan: (key: string, value: unknown) => ({ op: 'lessThan', key, value }),
      limit: (n: number) => ({ op: 'limit', n }),
      orderAsc: (field: string) => ({ op: 'orderAsc', field }),
      cursorAfter: (id: string) => ({ op: 'cursorAfter', id }),
    },
  },
};
const handler: any = requireCjs('../../appwrite-functions/tombstone-gc/main.js');

const fixedNow = new Date('2026-09-22T00:00:00.000Z');

describe('tombstone-gc', () => {
  const originalRetention = process.env.TOMBSTONE_RETENTION_DAYS;

  beforeEach(() => {
    process.env.TOMBSTONE_RETENTION_DAYS = '90';
  });

  afterEach(() => {
    mockTablesDb = null;
    if (originalRetention === undefined) {
      delete process.env.TOMBSTONE_RETENTION_DAYS;
    } else {
      process.env.TOMBSTONE_RETENTION_DAYS = originalRetention;
    }
  });

  it('uses a 90-day retention cutoff by default', async () => {
    const cutoff = handler.__test.cutoffIso(fixedNow);
    expect(cutoff).toBe('2026-06-24T00:00:00.000Z');
  });

  it('purges only rows selected as deleted and older than the cutoff', async () => {
    const listRows = vi.fn().mockResolvedValue({
      rows: [{ $id: 'old_deleted' }],
    });
    const deleteRow = vi.fn().mockResolvedValue(undefined);
    const tablesDB = { listRows, deleteRow };

    const result = await handler.__test.purgeTable(
      tablesDB,
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
    const tablesDB = { listRows, deleteRow: vi.fn() };

    const results = await handler.__test.runGc(
      tablesDB,
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

  // Regression: AGENTS.md — Non-negotiable data and sync rules.
  it('runs the deployed handler path and reports an empty manual execution', async () => {
    const listRows = vi.fn().mockResolvedValue({ rows: [] });
    mockTablesDb = { listRows, deleteRow: vi.fn() };
    const json = vi.fn().mockImplementation((body, status = 200) => ({ body, status }));
    const log = vi.fn();
    const error = vi.fn();

    const response = await handler({
      req: { headers: { 'x-appwrite-key': 'test-service-key' } },
      res: { json },
      log,
      error,
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        ok: true,
        retentionDays: 90,
        totals: { scanned: 0, purged: 0 },
      },
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
    expect(listRows).toHaveBeenCalledTimes(6);
    expect(log).toHaveBeenLastCalledWith('tombstone-gc: complete scanned=0 purged=0');
    expect(error).not.toHaveBeenCalled();
  });
});
