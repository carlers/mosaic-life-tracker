import { describe, it, expect, vi } from 'vitest';
import { migrateCategoryLifecycleLockBackend } from '../../scripts/migrate-category-lifecycle-lock.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const base = '/tablesdb/life_tracker/tables/categories';

function fixture(initial: Record<string, Record<string, unknown>> = {}) {
  const columns = new Map(Object.entries(initial));
  const actions: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const request = vi.fn(async (method: string, path: string, body?: Record<string, unknown>) => {
    actions.push({ method, path, body });
    if (method === 'GET' && path === base) return { $id: 'categories' };
    if (method === 'GET' && path.startsWith(base + '/columns/')) {
      const value = columns.get(path.slice((base + '/columns/').length));
      if (value) return value;
      throw Object.assign(new Error('Missing'), { status: 404 });
    }
    if (method === 'POST' && path === base + '/columns/varchar' && body) {
      columns.set(String(body.key), { ...body, type: 'varchar', status: 'available' });
      return columns.get(String(body.key));
    }
    throw new Error('Unexpected migration request: ' + method + ' ' + path);
  });
  return { columns, actions, request };
}

describe('managed category lifecycle lock migration 024', () => {
  it('declares exact server-owned optional lock fields with Scratch parity', () => {
    const columns = MOSAIC_TABLES.find(table => table.id === 'categories')?.columns || [];
    for (const key of ['lifecycle_state', 'lifecycle_target']) {
      expect(columns.find(column => column.key === key)).toMatchObject({
        key, type: 'varchar', size: 64, required: false, default: '',
      });
    }
  });

  it('provisions missing fields additively and is idempotent', async () => {
    const mock = fixture();
    const first = await migrateCategoryLifecycleLockBackend({
      request: mock.request, sleep: async () => {},
    });
    expect(first.created).toEqual(['lifecycle_state', 'lifecycle_target']);
    expect(mock.actions.filter(action => action.method === 'POST').map(action => action.body)).toEqual([
      { key: 'lifecycle_state', size: 64, required: false, default: '', array: false, encrypt: false },
      { key: 'lifecycle_target', size: 64, required: false, default: '', array: false, encrypt: false },
    ]);
    const second = await migrateCategoryLifecycleLockBackend({
      request: mock.request, sleep: async () => {},
    });
    expect(second.created).toEqual([]);
    expect(mock.actions.every(action => ['GET', 'POST'].includes(action.method))).toBe(true);
  });

  it('rejects pre-existing incompatible fields without mutation', async () => {
    const mock = fixture({ lifecycle_state: {
      key: 'lifecycle_state', type: 'varchar', size: 32,
      required: false, default: '', status: 'available',
    } });
    await expect(migrateCategoryLifecycleLockBackend({
      request: mock.request, sleep: async () => {},
    })).rejects.toThrow(/Incompatible categories.lifecycle_state/);
    expect(mock.actions.every(action => action.method === 'GET')).toBe(true);
  });

  it('refuses to proceed when an existing provisioned column has failed', async () => {
    const mock = fixture({ lifecycle_state: {
      key: 'lifecycle_state', type: 'varchar', size: 64,
      required: false, default: '', status: 'failed',
    } });
    await expect(migrateCategoryLifecycleLockBackend({
      request: mock.request, sleep: async () => {},
    })).rejects.toThrow(/provisioning failed/);
    expect(mock.actions.every(action => action.method === 'GET')).toBe(true);
  });
});
