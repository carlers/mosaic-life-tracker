import { describe, expect, it, vi } from 'vitest';
import { listAll } from '../../appwrite-functions/dr-backup/backup.mjs';

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
});
