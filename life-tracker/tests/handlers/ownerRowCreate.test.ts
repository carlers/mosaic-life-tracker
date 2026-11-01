import { beforeEach, describe, expect, it } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const time = '2026-11-01T00:00:00Z';
const task = (extra: Record<string, unknown> = {}) => ({
  user_id: 'owner', title: 'Task', category_id: 'cat_1',
  is_completed: false, order: 0, date: '2026-10-30',
  created_at: time, updated_at: time, deleted: false,
  visibility: 'private', reactions: '', ...extra,
});
const category = (extra: Record<string, unknown> = {}) => ({
  user_id: 'owner', name: 'Work', color: '#112233',
  order: 0, visibility: 'private', deleted: false, updated_at: time, ...extra,
});

describe('owner-only server row create foundation', () => {
  let db: MockDb;
  const send = (tableId: string, data: Record<string, unknown>, owner = 'owner') =>
    invoke({ userId: owner, mockDb: db, body: {
      action: 'create_owner_row', tableId, rowId: 'row_1', data,
    } });

  beforeEach(() => {
    db = makeMockDb();
    db.createRow.mockResolvedValue({});
    db.getRow.mockResolvedValue({ user_id: 'owner', deleted: false });
  });

  it('creates an owner task only with a live owner category', async () => {
    const r = await send('tasks', task());
    expect(r).toMatchObject({ status: 200, body: { ok: true, status: 'created' } });
    expect(db.getRow).toHaveBeenCalledWith({
      databaseId: 'life_tracker', tableId: 'categories', rowId: 'cat_1',
    });
    expect(db.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'tasks', rowId: 'row_1', data: task(),
      permissions: ['read("user:owner")'],
    }));
  });

  it('rejects foreign, deleted and missing task categories', async () => {
    db.getRow.mockResolvedValueOnce({ user_id: 'another', deleted: false });
    expect((await send('tasks', task())).status).toBe(409);
    db.getRow.mockResolvedValueOnce({ user_id: 'owner', deleted: true });
    expect((await send('tasks', task())).status).toBe(409);
    db.getRow.mockRejectedValueOnce({ code: 404 });
    expect((await send('tasks', task())).status).toBe(409);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('preserves historical assignments but blocks future and Backlogs tasks in a retired category', async () => {
    db.getRow.mockResolvedValue({ user_id: 'owner', deleted: false, retired_on: '2026-10-31' });
    expect((await send('tasks', task())).status).toBe(200);
    expect((await send('tasks', task({ date: '2026-11-01' }))).status).toBe(409);
    expect((await send('tasks', task({ date: '' }))).status).toBe(409);
    expect(db.createRow).toHaveBeenCalledTimes(1);
  });

  it('denies foreign ownership, tombstones, invalid fields and dates before writing', async () => {
    for (const patch of [
      { user_id: 'other' }, { deleted: true }, { reactions: '[]' },
      { date: '2026-02-31' }, { updated_at: 'bad' },
      { order: -1 }, { category_id: '../foreign' }, { $permissions: ['read("users")'] },
    ]) expect((await send('tasks', task(patch))).status).toBe(400);
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('creates valid categories and rejects malformed retirement dates', async () => {
    expect((await send('categories', category({ retired_on: '2026-10-31' }))).status).toBe(200);
    expect((await send('categories', category({ retired_on: '2026-02-31' }))).status).toBe(400);
    expect(db.createRow).toHaveBeenCalledTimes(1);
  });

  it('compensates for a category locked after the initial create check', async () => {
    db.getRow.mockResolvedValueOnce({ user_id: 'owner', deleted: false })
      .mockResolvedValueOnce({ user_id: 'owner', deleted: false, lifecycle_state: 'delete' });
    const r=await send('tasks', task());
    expect(r.status).toBe(409);
    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',rowId:'row_1',data:expect.objectContaining({deleted:true}),
    }));
  });

  it('returns an existing owner collision but never leaks a foreign row', async () => {
    db.createRow.mockRejectedValue({ code: 409 });
    db.getRow.mockResolvedValueOnce({ user_id: 'owner', $id: 'row_1' });
    expect((await send('categories', category())).body).toMatchObject({
      ok: true, status: 'existing', row: { user_id: 'owner' },
    });
    db.getRow.mockResolvedValueOnce({ user_id: 'other', $id: 'row_1' });
    expect((await send('categories', category())).status).toBe(403);
  });
});
