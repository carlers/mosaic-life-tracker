import { beforeEach, describe, expect, it } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

describe('category lifecycle persisted inventory preflight', () => {
  let db: MockDb;

  beforeEach(() => {
    db = makeMockDb();
    db.getRow.mockResolvedValue({ $id: 'cat_1', user_id: 'owner_a', deleted: false });
  });

  async function query(categoryId = 'cat_1', userId = 'owner_a') {
    return invoke({
      userId,
      mockDb: db,
      body: { action: 'get_category_lifecycle_preflight', categoryId },
    });
  }

  it('counts all server-persisted live owner tasks, not the one-row page', async () => {
    db.listRows.mockResolvedValue({ total: 143, rows: [{ $id: 'task_1' }] });
    const response = await query();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true, categoryId: 'cat_1', persistedTaskCount: 143,
      scope: 'synced_server_rows_only', safeToDelete: false,
    });
    expect(db.listRows).toHaveBeenCalledWith({
      databaseId: 'life_tracker', tableId: 'tasks', total: true, ttl: 0,
      queries: expect.arrayContaining([
        { op: 'equal', key: 'user_id', value: 'owner_a' },
        { op: 'equal', key: 'category_id', value: 'cat_1' },
        { op: 'equal', key: 'deleted', value: false },
        { op: 'limit', n: 1 },
      ]),
    });
  });

  it('denies cross-owner reads without listing tasks', async () => {
    const response = await query('cat_1', 'owner_b');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Category not found' });
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('denies deleted and missing categories without listing tasks', async () => {
    db.getRow.mockResolvedValueOnce({ user_id: 'owner_a', deleted: true });
    expect((await query()).status).toBe(404);
    db.getRow.mockRejectedValueOnce({ code: 404 });
    expect((await query()).status).toBe(404);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('rejects invalid IDs before reading the database', async () => {
    expect((await query('../cat_1')).status).toBe(400);
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('fails closed when Appwrite omits or corrupts the total', async () => {
    db.listRows.mockResolvedValue({ rows: [{ $id: 'task_1' }] });
    expect((await query()).status).toBe(503);
    db.listRows.mockResolvedValue({ total: -1, rows: [] });
    expect((await query()).status).toBe(503);
  });
});
