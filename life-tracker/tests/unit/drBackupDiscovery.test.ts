import { describe, expect, it, vi } from 'vitest';
import {
  listAll,
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
      .mockResolvedValueOnce({ columns: [{ key: 'column_100' }]   it('adds the narrowest stage to provider errors without overwriting an existing stage', async () => {
    const providerError = Object.assign(new Error('provider detail must stay internal'), {
      code: 401,
    });

    await expect(
      withBackupStage('tables_list_rows', async () => {
        throw providerError;
      })
    ).rejects.toBe(providerError);
    expect((providerError as Error & { backupStage?: string }).backupStage).toBe(
      'tables_list_rows'
    );

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
});
