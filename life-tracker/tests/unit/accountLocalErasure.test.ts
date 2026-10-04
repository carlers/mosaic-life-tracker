import { describe, expect, it, vi } from 'vitest';
import { purgeAccountFromDatabase } from '../../src/db/database';

function collection(rows: Array<{ id: string; userId: string }>) {
  const docs = rows.map((row) => ({
    ...row,
    remove: vi.fn(async () => {
      const index = rows.findIndex((candidate) => candidate.id === row.id);
      if (index >= 0) rows.splice(index, 1);
    }),
  }));
  return {
    find: ({ selector }: { selector: { userId: string } }) => ({
      exec: async () =>
        docs.filter(
          (doc) =>
            rows.some((row) => row.id === doc.id) &&
            doc.userId === selector.userId
        ),
    }),
  };
}

describe('account-scoped local erasure', () => {
  // Regression: §23.8 (deleting one account cannot destroy another account).
  it('removes only the deleting owner from the shared local database', async () => {
    const stores = Object.fromEntries(
      ['tasks', 'categories', 'diary', 'settings', 'friendships', 'messages', 'syncMeta'].map(
        (name) => [
          name,
          [
            { id: `${name}_alice`, userId: 'alice' },
            { id: `${name}_bob`, userId: 'bob' },
          ],
        ]
      )
    ) as Record<string, Array<{ id: string; userId: string }>>;

    const database = Object.fromEntries(
      Object.entries(stores).map(([name, rows]) => [name, collection(rows)])
    );

    await purgeAccountFromDatabase('alice', database as never);

    for (const rows of Object.values(stores)) {
      expect(rows).toEqual([
        expect.objectContaining({ userId: 'bob' }),
      ]);
    }
  });
});
