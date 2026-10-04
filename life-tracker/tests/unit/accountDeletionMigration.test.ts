import { describe, expect, it, vi } from 'vitest';
import {
  assertCompatibleDeletionTable,
  assertCompatibleIndex,
  migrateAccountDeletionBackend,
  parseAccountDeletionMigrationArgs,
} from '../../scripts/migrate-account-deletion.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const deletionTable = MOSAIC_TABLES.find(
  (table) => table.id === 'account_deletions'
)!;

describe('account deletion backend migration', () => {
  it('parses portable Appwrite target configuration without hardcoded secrets', () => {
    expect(
      parseAccountDeletionMigrationArgs(
        ['--project', 'project_1', '--endpoint', 'https://fra.cloud.appwrite.io'],
        { APPWRITE_API_KEY: 'temporary-key' } as any
      )
    ).toMatchObject({
      endpoint: 'https://fra.cloud.appwrite.io/v1',
      projectId: 'project_1',
      apiKey: 'temporary-key',
      databaseId: 'life_tracker',
    });
  });

  it('creates the server-only job table and missing message indexes once', async () => {
    const existing = new Map<string, any>();
    const calls: Array<{ method: string; path: string; body?: any }> = [];
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      calls.push({ method, path, body });
      if (method === 'GET') {
        if (existing.has(path)) return existing.get(path);
        throw Object.assign(new Error('Not found'), { status: 404 });
      }
      if (
        method === 'POST' &&
        path === '/tablesdb/life_tracker/tables'
      ) {
        existing.set(
          '/tablesdb/life_tracker/tables/account_deletions',
          {
            $id: deletionTable.id,
            permissions: deletionTable.permissions,
            rowSecurity: deletionTable.rowSecurity,
            enabled: deletionTable.enabled,
            columns: deletionTable.columns,
          }
        );
        for (const index of deletionTable.indexes) {
          existing.set(
            `/tablesdb/life_tracker/tables/account_deletions/indexes/${index.key}`,
            index
          );
        }
        return {};
      }
      if (method === 'POST' && path.endsWith('/indexes')) {
        existing.set(`${path}/${body.key}`, body);
        return {};
      }
      throw new Error(`Unexpected ${method} ${path}`);
    });

    await migrateAccountDeletionBackend({ request, log: () => {} });

    expect(
      calls.find(
        (call) =>
          call.method === 'POST' &&
          call.path === '/tablesdb/life_tracker/tables'
      )?.body
    ).toMatchObject({
      tableId: 'account_deletions',
      permissions: [],
      rowSecurity: true,
    });
    expect(
      calls
        .filter(
          (call) =>
            call.method === 'POST' &&
            call.path === '/tablesdb/life_tracker/tables/messages/indexes'
        )
        .map((call) => call.body.key)
    ).toEqual(['idx_sender_id', 'idx_recipient_id']);

    calls.length = 0;
    await migrateAccountDeletionBackend({ request, log: () => {} });
    expect(calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('fails closed when an existing resource uses an incompatible schema', () => {
    expect(() =>
      assertCompatibleIndex(
        { key: 'idx_sender_id', type: 'key', attributes: ['recipient_id'] },
        { key: 'idx_sender_id', type: 'key', attributes: ['sender_id'] },
        'messages'
      )
    ).toThrow(/does not match/);

    expect(() =>
      assertCompatibleDeletionTable({
        $id: 'account_deletions',
        permissions: [],
        rowSecurity: false,
        enabled: true,
        columns: deletionTable.columns,
      })
    ).toThrow(/does not match/);

    expect(() =>
      assertCompatibleDeletionTable({
        $id: 'account_deletions',
        permissions: ['read("users")'],
        rowSecurity: true,
        enabled: true,
        columns: deletionTable.columns,
      })
    ).toThrow(/does not match/);

    expect(() =>
      assertCompatibleDeletionTable({
        $id: 'account_deletions',
        permissions: [],
        rowSecurity: true,
        enabled: true,
        columns: deletionTable.columns.map((column: any) =>
          column.key === 'user_id' ? { ...column, size: 36 } : column
        ),
      })
    ).toThrow(/user_id.*incompatible/i);

    expect(() =>
      assertCompatibleDeletionTable({
        $id: 'account_deletions',
        permissions: [],
        rowSecurity: true,
        enabled: true,
        columns: [
          ...deletionTable.columns,
          { key: 'unexpected', type: 'varchar', size: 50, required: true },
        ],
      })
    ).toThrow(/unexpected required column/i);
  });
});
