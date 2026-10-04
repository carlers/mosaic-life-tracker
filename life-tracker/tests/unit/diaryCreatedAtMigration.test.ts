import { describe, expect, it, vi } from 'vitest';
import {
  assertCompatibleDiaryCreatedAtColumn,
  migrateDiaryCreatedAtBackend,
  parseDiaryCreatedAtMigrationArgs,
} from '../../scripts/migrate-diary-created-at.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const diary = MOSAIC_TABLES.find((table) => table.id === 'diary')!;
const createdAt = diary.columns.find((column: any) => column.key === 'created_at')!;

describe('diary created_at backend migration', () => {
  it('parses portable Appwrite target configuration', () => {
    expect(
      parseDiaryCreatedAtMigrationArgs(
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

  it('creates the missing column once and waits until it is available', async () => {
    let currentColumn: any = null;
    const calls: Array<{ method: string; path: string; body?: any }> = [];
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      calls.push({ method, path, body });
      if (method === 'GET' && path === '/tablesdb/life_tracker/tables/diary') {
        return { $id: 'diary' };
      }
      if (
        method === 'GET' &&
        path === '/tablesdb/life_tracker/tables/diary/columns/created_at'
      ) {
        if (!currentColumn) {
          throw Object.assign(new Error('Not found'), { status: 404 });
        }
        return currentColumn;
      }
      if (
        method === 'POST' &&
        path === '/tablesdb/life_tracker/tables/diary/columns/varchar'
      ) {
        currentColumn = {
          ...createdAt,
          status: 'available',
          error: '',
        };
        return currentColumn;
      }
      throw new Error(`Unexpected ${method} ${path}`);
    });

    await expect(
      migrateDiaryCreatedAtBackend({
        request,
        log: () => {},
        sleep: async () => {},
      })
    ).resolves.toEqual({
      tableId: 'diary',
      column: 'created_at',
      created: true,
    });

    expect(
      calls.find((call) => call.method === 'POST')?.body
    ).toMatchObject({
      key: 'created_at',
      size: 50,
      required: false,
      default: '',
      array: false,
      encrypt: false,
    });

    calls.length = 0;
    await expect(
      migrateDiaryCreatedAtBackend({
        request,
        log: () => {},
        sleep: async () => {},
      })
    ).resolves.toEqual({
      tableId: 'diary',
      column: 'created_at',
      created: false,
    });
    expect(calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('fails closed when an existing created_at column is incompatible', () => {
    expect(() =>
      assertCompatibleDiaryCreatedAtColumn({
        ...createdAt,
        size: 36,
        status: 'available',
      })
    ).toThrow(/incompatible.*size/i);

    expect(() =>
      assertCompatibleDiaryCreatedAtColumn({
        ...createdAt,
        status: 'failed',
        error: 'backend rejected column',
      })
    ).toThrow(/failed provisioning/i);
  });

  it('refuses to migrate when the diary table is missing', async () => {
    const request = vi.fn(async () => {
      throw Object.assign(new Error('Not found'), { status: 404 });
    });

    await expect(
      migrateDiaryCreatedAtBackend({ request })
    ).rejects.toThrow(/Diary table is missing/i);
  });
});
