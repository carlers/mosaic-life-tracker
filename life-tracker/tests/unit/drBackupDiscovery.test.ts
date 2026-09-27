import { describe, expect, it, vi } from 'vitest';
import { runBackup } from '../../appwrite-functions/dr-backup/backup.mjs';
import { decryptBuffer } from '../../appwrite-functions/dr-backup/crypto.mjs';

function makeR2() {
  const objects = new Map<string, { body: Buffer; metadata: Record<string, string> }>();
  return {
    objects,
    putObject: vi.fn(async (key: string, body: Uint8Array, options: any = {}) => {
      objects.set(key, {
        body: Buffer.from(body),
        metadata: options.metadata || {},
      });
      return { etag: 'etag' };
    }),
    headObject: vi.fn(async (key: string) => {
      const value = objects.get(key);
      return value
        ? { size: value.body.length, etag: 'etag', metadata: value.metadata }
        : null;
    }),
    listObjects: vi.fn(async (prefix: string) =>
      [...objects.keys()].filter((key) => key.startsWith(prefix))
    ),
    deletePrefix: vi.fn(async () => 0),
  };
}

describe('DR dynamic Appwrite discovery', () => {
  it('backs up resources discovered at runtime and offset-paginates schema metadata', async () => {
    const columns = Array.from({ length: 101 }, (_, index) => ({
      key: `future_${index}`,
      type: 'varchar',
      size: 255,
      required: false,
      array: false,
      default: null,
      futureOption: index === 100 ? 'preserved' : undefined,
      status: 'available',
    }));
    const tablesDB = {
      list: vi.fn().mockResolvedValue({
        databases: [{ $id: 'future_db', name: 'Future DB', enabled: true }],
      }),
      listTables: vi.fn().mockResolvedValue({
        tables: [
          {
            $id: 'future_table',
            name: 'Future table',
            $permissions: [],
            rowSecurity: true,
            enabled: true,
          },
        ],
      }),
      listColumns: vi
        .fn()
        .mockResolvedValueOnce({ columns: columns.slice(0, 100) })
        .mockResolvedValueOnce({ columns: columns.slice(100) }),
      listIndexes: vi.fn().mockResolvedValue({ indexes: [] }),
      listRows: vi.fn().mockResolvedValue({
        rows: [
          {
            $id: 'future_row',
            $permissions: ['read("user:user_1")'],
            $databaseId: 'future_db',
            $tableId: 'future_table',
            value: 'kept',
          },
        ],
      }),
    };
    const users = {
      list: vi.fn().mockResolvedValue({ users: [{ $id: 'user_1' }] }),
      get: vi.fn().mockResolvedValue({
        $id: 'user_1',
        name: 'User',
        email: 'user@example.com',
        password: '$argon2id$hash',
        hash: 'argon2',
        hashOptions: {},
        status: true,
        labels: [],
        prefs: {},
      }),
    };
    const storage = {
      listBuckets: vi.fn().mockResolvedValue({ buckets: [] }),
    };
    const r2 = makeR2();
    const encryptionKey = Buffer.alloc(32, 4);

    const result = await runBackup({
      appwriteKey: 'test',
      clients: { tablesDB, users, storage },
      r2,
      now: new Date('2026-09-27T10:00:00.000Z'),
      config: {
        endpoint: 'https://example.test/v1',
        projectId: 'source-project',
        r2: {},
        encryptionKey,
        keyVersion: 'v1',
        prefix: 'mosaic-dr/v1',
        retention: { daily: 7, weekly: 4, monthly: 6, lockDays: 30 },
      },
    });

    expect(result.counts).toMatchObject({
      databases: 1,
      tables: 1,
      rows: 1,
      users: 1,
    });
    expect(tablesDB.listColumns).toHaveBeenCalledTimes(2);

    const schemaKey = [...r2.objects.keys()].find((key) =>
      key.endsWith('/future_db/future_table/schema.json.enc')
    );
    expect(schemaKey).toBeTruthy();
    const schemaEnvelope = r2.objects.get(schemaKey!)!.body;
    const schema = JSON.parse(
      decryptBuffer(schemaEnvelope, {
        key: encryptionKey,
        aad: schemaKey!,
      }).plain.toString('utf8')
    );
    expect(schema.columns).toHaveLength(101);
    expect(schema.columns[100]).toMatchObject({
      key: 'future_100',
      futureOption: 'preserved',
    });
  });
});
