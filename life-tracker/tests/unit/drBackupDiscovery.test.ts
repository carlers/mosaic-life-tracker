import { describe, expect, it, vi } from 'vitest';
import {
  listAll,
  putEncrypted,
  withBackupStage,
} from '../../appwrite-functions/dr-backup/backup.mjs';

describe('DR Appwrite discovery pagination', () => {
  it('offset-paginates schema metadata that has no row-style ID cursor', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({
      key: `column_${index}`,
    }));
    const listPage = vi
      .fn()
      .mockResolvedValueOnce({ columns: first })
      .mockResolvedValueOnce({ columns: [{ key: 'column_100' }] });

    const result = await listAll(listPage, 'columns', {
      cursorField: null,
    });

    expect(result).toHaveLength(101);
    expect(listPage).toHaveBeenCalledTimes(2);
    const secondQueries = listPage.mock.calls[1][0] as string[];
    expect(
      secondQueries.some(
        (query) => query.includes('"method":"offset"') && query.includes('100')
      )
    ).toBe(true);
  });

  it('splits staged encrypted writes into put, head, and verify failures', async () => {
    const encryptionKey = Buffer.alloc(32, 7);
    const plain = Buffer.from('schema');

    const putError = new Error('provider put detail');
    const putR2 = {
      putObject: vi.fn().mockRejectedValue(putError),
      headObject: vi.fn(),
    };

    await expect(
      putEncrypted(putR2, 'snapshots/test/schema.json.enc', plain, {
        encryptionKey,
        keyVersion: 'v1',
        stagePrefix: 'tables_schema_deadbeef0001',
      })
    ).rejects.toBe(putError);
    expect((putError as Error & { backupStage?: string }).backupStage).toBe(
      'tables_schema_deadbeef0001_put'
    );

    const headError = new Error('provider head detail');
    const headR2 = {
      putObject: vi.fn().mockResolvedValue({}),
      headObject: vi.fn().mockRejectedValue(headError),
    };

    await expect(
      putEncrypted(headR2, 'snapshots/test/schema.json.enc', plain, {
        encryptionKey,
        keyVersion: 'v1',
        stagePrefix: 'tables_schema_deadbeef0002',
      })
    ).rejects.toBe(headError);
    expect((headError as Error & { backupStage?: string }).backupStage).toBe(
      'tables_schema_deadbeef0002_head'
    );

    const verifyR2 = {
      putObject: vi.fn().mockResolvedValue({}),
      headObject: vi.fn().mockResolvedValue({
        size: 0,
        metadata: {},
      }),
    };

    await expect(
      putEncrypted(verifyR2, 'snapshots/test/schema.json.enc', plain, {
        encryptionKey,
        keyVersion: 'v1',
        stagePrefix: 'tables_schema_deadbeef0003',
      })
    ).rejects.toMatchObject({
      backupStage: 'tables_schema_deadbeef0003_verify',
    });
  });

  it('adds the narrowest stage to provider errors without overwriting an existing stage', async () => {
    const providerError = Object.assign(
      new Error('provider detail must stay internal'),
      { code: 401 }
    );

    await expect(
      withBackupStage('tables_list_rows', async () => {
        throw providerError;
      })
    ).rejects.toBe(providerError);

    expect(
      (providerError as Error & { backupStage?: string }).backupStage
    ).toBe('tables_list_rows');

    const alreadyTagged = Object.assign(new Error('already tagged'), {
      backupStage: 'tables_list_columns',
    });

    await expect(
      withBackupStage('tables_export', async () => {
        throw alreadyTagged;
      })
    ).rejects.toBe(alreadyTagged);

    expect(alreadyTagged.backupStage).toBe('tables_list_columns');
  });
});
