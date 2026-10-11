import { describe, expect, it, vi } from 'vitest';
import { migrateBucketListBackend } from '../../scripts/migrate-bucket-list.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { validateBucketListInput } from '../../src/hooks/useBucketList';

const table = MOSAIC_TABLES.find(item => item.id === 'bucket_list_items')!;

describe('Bucket List creation and migration', () => {
  it('requires a bounded nonempty title', () => {
    expect(() => validateBucketListInput('  ', '')).toThrow();
    expect(() => validateBucketListInput('x'.repeat(256), '')).toThrow();
    expect(() => validateBucketListInput('Yes', 'x'.repeat(2001))).toThrow();
    expect(validateBucketListInput('  Goal  ', 'Memo')).toEqual({ title: 'Goal', description: 'Memo' });
  });
  it('creates only the manifest-owned table when absent', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'GET') throw Object.assign(new Error('missing'), { status: 404 });
      return {};
    });
    await expect(migrateBucketListBackend({ request })).resolves.toEqual({ created: true });
    expect(request).toHaveBeenCalledWith('POST', expect.any(String), expect.objectContaining({
      tableId: table.id, rowSecurity: true, columns: table.columns,
    }));
  });
  it('rejects incompatible existing permission state', async () => {
    const request = vi.fn().mockResolvedValue({ ...table, $id: table.id, $permissions: ['read("users")'] });
    await expect(migrateBucketListBackend({ request })).rejects.toThrow(/permission drift/);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
