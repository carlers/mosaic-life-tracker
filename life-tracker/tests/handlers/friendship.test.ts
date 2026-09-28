import { describe, it, expect } from 'vitest';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

describe('server-owned friendships', () => {
  it('creates both request rows atomically with read access only for each owner', async () => {
    const db = makeMockDb();
    db.getRow.mockImplementation(async ({ tableId, rowId }: any) => {
      if (tableId === 'profiles') return { user_id: rowId.slice(8), username: rowId, deleted: false };
      throw Object.assign(new Error('missing'), { code: 404 });
    });
    const result = await invoke({ userId: 'alice', mockDb: db, body: {
      action: 'friendship', operation: 'send', friendUserId: 'bob', expectedVersion: null,
    } });
    expect(result.status).toBe(200);
    expect(db.createRow).toHaveBeenCalledTimes(2);
    for (const [input] of db.createRow.mock.calls) {
      expect(input.transactionId).toBe('tx');
      expect(input.permissions).toEqual([`read("user:${input.data.user_id}")`]);
      expect(input.rowId).toMatch(/^fr_[a-f0-9]{32}$/);
    }
    expect(db.createRow.mock.calls.map(([v]: any) => v.data.status)).toEqual(['pending_outgoing', 'pending_incoming']);
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'tx', commit: true });
  });
});

import { createHash } from 'node:crypto';
const fid = (a: string, b: string) => 'fr_' + createHash('sha256').update(`${a}|${b}`).digest('hex').slice(0, 32);
function pair(status = 'pending_outgoing', deleted = false) {
  return [
    { $id: fid('alice', 'bob'), user_id: 'alice', friend_id: 'bob', status, deleted, updated_at: 'v1' },
    { $id: fid('bob', 'alice'), user_id: 'bob', friend_id: 'alice', status: status === 'pending_outgoing' ? 'pending_incoming' : status, deleted, updated_at: 'v1' },
  ];
}
function setup(rows: any[] = []) {
  const db = makeMockDb();
  db.getRow.mockImplementation(async ({ tableId, rowId }: any) => {
    if (tableId === 'profiles') return { $id: rowId, user_id: rowId.slice(8), username: rowId, deleted: false };
    const row = rows.find(r => r.$id === rowId);
    if (row) return row;
    throw Object.assign(new Error('missing'), { code: 404 });
  });
  return db;
}
async function command(db: any, operation: string, userId = 'alice', expectedVersion: string | null = 'v1') {
  return invoke({ userId, mockDb: db, body: { action: 'friendship', operation, friendUserId: userId === 'alice' ? 'bob' : 'alice', expectedVersion } });
}
describe('friendship authorization and transitions', () => {
  it.each([
    ['accept', 'bob', 'accepted'], ['decline', 'bob', 'deleted'],
    ['cancel', 'alice', 'deleted'], ['block', 'alice', 'blocked'],
  ])('%s updates both sides for %s', async (operation, caller, next) => {
    const db = setup(pair()); const result = await command(db, operation, caller);
    expect(result.status).toBe(200); expect(db.updateRow).toHaveBeenCalledTimes(2);
    for (const [args] of db.updateRow.mock.calls) expect(args.data).toMatchObject(next === 'deleted' ? { deleted: true } : { status: next });
  });
  it('removes an accepted pair with tombstones', async () => {
    const db = setup(pair('accepted'));
    expect((await command(db, 'remove')).status).toBe(200);
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
  it.each(['accept', 'decline'])('sender cannot %s their outgoing request', async operation => {
    const db = setup(pair()); expect((await command(db, operation)).status).toBe(409);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
  it('crossed sends require explicit acceptance', async () => {
    const db = setup(pair()); expect((await command(db, 'send', 'bob')).status).toBe(409);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
  it.each(['send', 'accept', 'remove', 'cancel'])('blocked relationships reject %s', async operation => {
    const db = setup(pair('blocked')); expect((await command(db, operation)).status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
  it('rejects a stale version without changing either row and returns the caller state', async () => {
    const db = setup(pair()); const response = await command(db, 'cancel', 'alice', 'older');
    expect(response.status).toBe(409); expect(response.body.row.user_id).toBe('alice');
    expect(db.updateRow).not.toHaveBeenCalled();
  });
  it.each([['send', 'pending_outgoing'], ['accept', 'accepted'], ['block', 'blocked']])('lost response retry of %s is harmless', async (operation, state) => {
    const db = setup(pair(state)); expect((await command(db, operation, 'alice', null)).status).toBe(200);
    expect(db.updateRow).not.toHaveBeenCalled(); expect(db.createRow).not.toHaveBeenCalled();
  });
  it('old send cannot resurrect a cancellation', async () => {
    const db = setup(pair('pending_outgoing', true)); expect((await command(db, 'send', 'alice', null)).status).toBe(409);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
  it('rolls back if the second write fails', async () => {
    const db = setup(); db.createRow.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('failed'));
    expect((await command(db, 'send', 'alice', null)).status).toBe(500);
    expect(db.updateTransaction).not.toHaveBeenCalledWith(expect.objectContaining({ commit: true }));
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'tx', rollback: true });
  });
  it('retries transaction conflicts with fresh reads, bounded at three attempts', async () => {
    const db = setup(); db.updateTransaction.mockImplementation(async (args: any) => {
      if (args.commit) throw Object.assign(new Error('conflict'), { code: 409 });
    });
    expect((await command(db, 'send', 'alice', null)).status).toBe(500);
    expect(db.createTransaction).toHaveBeenCalledTimes(3);
  });
  it('rejects absent authentication and forged caller ownership', async () => {
    const db = setup();
    expect((await invoke({ mockDb: db, body: { action: 'friendship' } })).status).toBe(401);
    expect((await invoke({ userId: 'alice', mockDb: db, body: { action: 'friendship', ownerId: 'bob', friendUserId: 'bob', operation: 'send', expectedVersion: null } })).status).toBe(400);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('uses stored profiles, never supplied display names or permissions', async () => {
    const db = setup();
    const result = await invoke({ userId: 'alice', mockDb: db, body: { action: 'friendship', friendUserId: 'bob', operation: 'send', expectedVersion: null,
      friend_username: 'forged', permissions: ['read("any")'] } });
    expect(result.status).toBe(200);
    expect(db.createRow.mock.calls[0][0].data.friend_username).toBe('profile_bob');
    expect(db.createRow.mock.calls[0][0].permissions).toEqual(['read("user:alice")']);
  });
  it('account deletion cleans remote-only and blocked rows before returning', async () => {
    const db = setup(pair('blocked')); db.listRows.mockResolvedValueOnce({ rows: pair('blocked').slice(0, 1) }).mockResolvedValueOnce({ rows: [] });
    const result = await invoke({ userId: 'alice', mockDb: db, body: { action: 'delete_account_friendships', ownerId: 'alice' } });
    expect(result.status).toBe(200);
    expect(db.updateRow.mock.calls.filter(([a]: any) => a.tableId === 'friendships')).toHaveLength(2);
    expect(db.updateRow.mock.calls[0][0]).toMatchObject({ tableId: 'profiles', data: { deleted: true, is_searchable: false } });
  });
});
