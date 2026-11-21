import { describe, expect, it, vi } from 'vitest';
import { migrateCategoryStartDateBackend } from '../../scripts/migrate-category-start-date.mjs';

describe('category start-date migration', () => {
  it('creates and verifies the optional varchar column idempotently', async () => {
    let created = false;
    const request = vi.fn(async (method: string, path: string) => {
      if (method === 'GET' && path.endsWith('/tables/categories')) return { id: 'categories' };
      if (method === 'GET' && path.endsWith('/columns/started_on')) {
        if (!created) {
          const error = new Error('not found') as Error & { status: number };
          error.status = 404;
          throw error;
        }
        return { key: 'started_on', type: 'varchar', size: 10, required: false, default: '', status: 'available' };
      }
      if (method === 'POST' && path.endsWith('/columns/varchar')) {
        created = true;
        return {};
      }
      throw new Error('Unexpected migration request: ' + method + ' ' + path);
    });
    const result = await migrateCategoryStartDateBackend({ request, sleep: async () => {} });
    expect(result).toEqual({ column: 'started_on', created: true });
    expect(request).toHaveBeenCalledWith('POST', expect.stringContaining('/columns/varchar'),
      expect.objectContaining({ key: 'started_on', size: 10, required: false, default: '', array: false, encrypt: false }));
  });

  it('does not recreate an already available compatible column', async () => {
    const request = vi.fn(async (method: string, path: string) => {
      if (method === 'GET' && path.endsWith('/tables/categories')) return { id: 'categories' };
      if (method === 'GET' && path.endsWith('/columns/started_on')) {
        return { key: 'started_on', type: 'varchar', size: 10, required: false, default: '', status: 'available' };
      }
      throw new Error('Unexpected migration request: ' + method + ' ' + path);
    });
    const result = await migrateCategoryStartDateBackend({ request, sleep: async () => {} });
    expect(result).toEqual({ column: 'started_on', created: false });
    expect(request).not.toHaveBeenCalledWith('POST', expect.any(String), expect.anything());
  });

  it('fails closed when an existing column is incompatible', async () => {
    const request = vi.fn(async (method: string, path: string) => {
      if (method === 'GET' && path.endsWith('/tables/categories')) return { id: 'categories' };
      if (method === 'GET' && path.endsWith('/columns/started_on')) {
        return { key: 'started_on', type: 'varchar', size: 20, required: false, default: '', status: 'available' };
      }
      throw new Error('Unexpected migration request: ' + method + ' ' + path);
    });
    await expect(migrateCategoryStartDateBackend({ request, sleep: async () => {} }))
      .rejects.toThrow('Incompatible categories.started_on column: size');
  });
});
