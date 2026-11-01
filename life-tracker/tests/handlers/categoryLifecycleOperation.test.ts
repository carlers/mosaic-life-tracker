import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const source = {
  $id: 'cat_a', $updatedAt: '2026-11-01T15:00:00Z',
  user_id: 'owner', name: 'School', visibility: 'private',
  deleted: false, lifecycle_state: '', lifecycle_target: '',
};
const destination = {
  ...source, $id: 'cat_b', name: 'Backlogs',
};
const task = {
  $id: 'task_a', $updatedAt: '2026-11-01T15:01:00Z',
  user_id: 'owner', category_id: 'cat_a', deleted: false, visibility: '',
};
describe('server owned resumable category lifecycle', () => {
  let db: MockDb;
  const execute = (body: Record<string, unknown>, userId = 'owner') =>
    invoke({userId, mockDb: db, body: {
      action: 'run_category_lifecycle', categoryId: 'cat_a',
      mode: 'delete', confirmName: 'School', ...body,
    }});
  beforeEach(() => {
    process.env.CATEGORY_DESTRUCTIVE_ENABLED = 'true';
    db = makeMockDb();
    db.getRow.mockImplementation(async ({rowId}: {rowId: string}) =>
      rowId === 'cat_b' ? destination : source);
    db.updateRows.mockResolvedValue({total: 1});
    db.listRows.mockResolvedValue({rows: [], total: 0});
  });
  afterEach(() => {delete process.env.CATEGORY_DESTRUCTIVE_ENABLED;});

  it('rejects deletion before permission cutover', async () => {
    delete process.env.CATEGORY_DESTRUCTIVE_ENABLED;
    const r = await execute({});
    expect(r.status).toBe(503);
    expect(db.getRow).not.toHaveBeenCalled();
  });

  it('denies foreign source, confirmation mismatch and invalid requests', async () => {
    expect((await execute({confirmName: 'nope'})).status).toBe(400);
    db.getRow.mockResolvedValueOnce({...source, user_id: 'not-owner'});
    expect((await execute({})).status).toBe(404);
    expect((await execute({mode:'move', destinationId:'cat_a'})).status).toBe(400);
    expect(db.updateRows).not.toHaveBeenCalled();
  });

  it('tombstones an empty category after server-side lock', async () => {
    const r = await execute({});
    expect(r.body).toMatchObject({ok:true, status:'done', remaining:0});
    expect(db.updateRows).toHaveBeenCalledTimes(2);
    expect(db.updateRows).toHaveBeenLastCalledWith(expect.objectContaining({
      tableId:'categories', data:expect.objectContaining({deleted:true}),
    }));
  });

  it('moves tasks preserving effective source privacy and ID', async () => {
    db.listRows.mockResolvedValueOnce({rows:[task]}).mockResolvedValueOnce({rows:[],total:0});
    const r = await execute({mode:'move',destinationId:'cat_b'});
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('done');
    expect(db.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',data:expect.objectContaining({category_id:'cat_b',visibility:'private'}),
    }));
    expect(db.updateRows).not.toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',data:expect.objectContaining({deleted:true}),
    }));
  });

  it('revokes shares and tombstones bucket links before deleting tasks', async () => {
    db.listRows.mockResolvedValueOnce({rows:[task]}).mockResolvedValueOnce({rows:[],total:0});
    const r = await execute({});
    expect(r.body).toMatchObject({status:'done',affected:1});
    expect(db.updateRows.mock.calls.filter(call => call[0].tableId === 'task_shares')).toHaveLength(1);
    expect(db.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'task_shares',data:expect.objectContaining({status:'revoked'}),
    }));
    expect(db.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'bucket_task_links',data:expect.objectContaining({deleted:true}),
    }));
    expect(db.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',data:expect.objectContaining({deleted:true}),
    }));
  });

  it('returns processing for incomplete batches without deleting category', async () => {
    db.listRows.mockResolvedValueOnce({rows:[task]}).mockResolvedValueOnce({rows:[],total:7});
    const r = await execute({});
    expect(r.body).toMatchObject({status:'processing',remaining:7});
    expect(db.updateRows.mock.calls.filter(call =>
      call[0].tableId === 'categories' && call[0].data.deleted === true)).toHaveLength(0);
  });

  it('resumes locked same-mode operations but rejects different operations', async () => {
    db.getRow.mockResolvedValue({...source,lifecycle_state:'delete',lifecycle_target:''});
    expect((await execute({})).body.status).toBe('done');
    expect(db.updateRows).toHaveBeenCalledTimes(1);
    expect((await execute({mode:'move',destinationId:'cat_b'})).status).toBe(409);
  });

  it('preserves active category if task revision conflicts', async () => {
    db.listRows.mockResolvedValueOnce({rows:[task]});
    db.updateRows.mockResolvedValueOnce({total:1}).mockResolvedValueOnce({total:0})
      .mockResolvedValueOnce({total:0}).mockResolvedValueOnce({total:0});
    const r=await execute({});
    expect(r.status).toBe(409);
    expect(db.updateRows.mock.calls.some(call=>call[0].data.deleted === true && call[0].tableId==='categories')).toBe(false);
  });
});
