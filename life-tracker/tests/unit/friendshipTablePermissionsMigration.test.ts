import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { migrateFriendshipTablePermissions } from '../../scripts/migrate-friendship-permissions.mjs';

const manifest = MOSAIC_TABLES.find(table => table.id === 'friendships')!;

function table(permissions: string[] = ['create("users")']) {
  return {
    $id: 'friendships', name: manifest.name,
    $permissions: permissions, rowSecurity: true, enabled: true,
    columns: manifest.columns.map(column => ({
      ...column, default: 'default' in column ? column.default : null,
    })),
    indexes: manifest.indexes.map(index => ({
      ...index, columns: index.attributes,
    })),
  };
}

describe('manual friendship table permissions migration', () => {
  it('changes only known broad-create permissions and verifies readback', async () => {
    const request = vi.fn().mockResolvedValueOnce(table())
      .mockResolvedValueOnce({}).mockResolvedValueOnce(table([]));
    await expect(migrateFriendshipTablePermissions({ request }))
      .resolves.toEqual({ changed: true });
    expect(request).toHaveBeenNthCalledWith(2,
      'PUT', '/tablesdb/life_tracker/tables/friendships',
      { name: manifest.name, permissions: [], rowSecurity: true, enabled: true });
  });

  it('is idempotent when table is already private', async () => {
    const request = vi.fn().mockResolvedValue(table([]));
    await expect(migrateFriendshipTablePermissions({ request }))
      .resolves.toEqual({ changed: false });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('fails closed on unexpected grants or schema mismatch', async () => {
    for (const invalid of [
      table(['read("users")']), { ...table(), rowSecurity: false },
      { ...table(), columns: table().columns.filter(c => c.key !== 'status') },
    ]) {
      const request = vi.fn().mockResolvedValue(invalid);
      await expect(migrateFriendshipTablePermissions({ request })).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects failed read-back after changing permissions', async () => {
    const request = vi.fn().mockResolvedValueOnce(table()).mockResolvedValueOnce({})
      .mockResolvedValueOnce(table());
    await expect(migrateFriendshipTablePermissions({ request }))
      .rejects.toThrow(/not confirmed/);
  });
});
