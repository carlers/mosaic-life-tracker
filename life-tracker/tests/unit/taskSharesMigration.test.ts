import { describe, expect, it, vi } from 'vitest';
import { migrateTaskSharesBackend } from '../../scripts/migrate-task-shares.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'task_shares')!;
const compatible = () => ({
  $id: 'task_shares', enabled: true, rowSecurity: true, $permissions: [],
  columns: expected.columns.map(column => ({ ...column, status: 'available' })),
  indexes: expected.indexes.map(index => ({
    ...index, status: 'available',
  })),
});

describe('shared-task membership schema migration', () => {
  it('creates exactly one private server-owned table with indexed owner/invitee/task', async () => {
    const request = vi.fn(async (method: string, path: string, body?: unknown) => {
      if (method === 'GET') throw Object.assign(new Error('not found'), { status: 404 });
      if (method === 'POST') return body;
      throw Error('Unexpected request ' + method + ' ' + path);
    });
    expect(await migrateTaskSharesBackend({ request })).toEqual({ created: true });
    const posts = request.mock.calls.filter(([method]) => method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toBe('/tablesdb/life_tracker/tables');
    expect(posts[0][2]).toMatchObject({
      tableId: 'task_shares',
      permissions: [],
      rowSecurity: true,
      indexes: [
        { key: 'idx_task_share_owner', attributes: ['owner_id'] },
        { key: 'idx_task_share_invitee', attributes: ['invitee_id'] },
        { key: 'idx_task_share_task', attributes: ['task_id', 'status'] },
      ],
    });
  });

  it('reconciles an existing private matching table without writes', async () => {
    const request = vi.fn(async () => compatible());
    expect(await migrateTaskSharesBackend({ request })).toEqual({ created: false });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an extra client create permission', () => ({ ...compatible(), $permissions: ['create("users")'] })],
    ['row security disabled', () => ({ ...compatible(), rowSecurity: false })],
    ['removed grant epoch column', () => ({
      ...compatible(), columns: compatible().columns.filter(column => column.key !== 'grant_epoch'),
    })],
    ['altered task status index', () => ({
      ...compatible(), indexes: compatible().indexes.map(index =>
        index.key === 'idx_task_share_task' ? { ...index, attributes: ['task_id'] } : index),
    })],
  ])('rejects existing schema drift: %s', async (_label, fixture) => {
    const request = vi.fn(async () => fixture());
    await expect(migrateTaskSharesBackend({ request })).rejects.toThrow(/Incompatible/);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
