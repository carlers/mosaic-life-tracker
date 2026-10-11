import { describe, expect, it, vi } from 'vitest';
import { migrateSharePermissions } from '../../scripts/migrate-share-permissions.mjs';

describe('additive shared edit permission migration', () => {
  it('creates only missing default-off columns, remains idempotent', async () => {
    const columns = new Map<string, {key:string;type:string;required:boolean;default:boolean;status:string}>();
    const request = vi.fn(async (method: string, path: string, payload?: Record<string, unknown>) => {
      if (path.endsWith('/tables/task_shares')) {
        return { $permissions: [], rowSecurity: true, columns: [...columns.values()] };
      }
      if (path.endsWith('/columns/boolean') && method === 'POST') {
        expect(payload).toMatchObject({ required: false, default: false, array: false });
        const key = String(payload?.key);
        columns.set(key, { key, type:'boolean', required:false, default:false, status:'available' });
        return columns.get(key);
      }
      const key = path.split('/').at(-1) || '';
      if (method === 'GET') return columns.get(key);
      throw new Error('Unexpected request');
    });
    await migrateSharePermissions({ request, sleep: async () => {} });
    await migrateSharePermissions({ request, sleep: async () => {} });
    expect([...columns.keys()]).toEqual(['allow_title_edit','allow_date_edit']);
    expect(request.mock.calls.filter(call => call[0] === 'POST')).toHaveLength(2);
  });

  it('does not migrate an insecure or incompatible share table', async () => {
    for (const table of [
      { rowSecurity: false, $permissions: [], columns: [] },
      { rowSecurity: true, $permissions: ['read("users")'], columns: [] },
      { rowSecurity: true, $permissions: [], columns: [
        { key: 'allow_title_edit', type: 'varchar', required:false, default:false },
      ] },
    ]) {
      const request = vi.fn(async () => table);
      await expect(migrateSharePermissions({ request })).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
});
