import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: new Map<string, any>(), list: vi.fn(), upsert: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('../../src/lib/sdk', () => ({ guardedTablesDB: { listRows: state.list, updateRow: state.update, createRow: state.create } }));
vi.mock('../../src/db/database', () => ({ getDatabase: () => ({ friendships: {
  findOne: (id: string) => ({ exec: async () => state.rows.get(id) ?? null }),
  find: ({ selector }: any) => ({ exec: async () => [...state.rows.values()].filter(r => r.userId === selector.userId) }),
  upsert: state.upsert,
} }) }));
vi.mock('../../src/lib/friendCache', () => ({ clearCachedCalendar: vi.fn() }));
import { syncFriendships } from '../../src/lib/friendshipSync';
function local(id: string, overrides = {}) {
  const doc: any = { id, userId: 'alice', updatedAt: '2099-01-01T00:00:00.000Z', isDeleted: false, _meta: { lwt: 1 }, ...overrides };
  doc.incrementalModify = vi.fn(async fn => Object.assign(doc, fn(doc)));
  state.rows.set(id, doc); return doc;
}
const remote = { $id: 'fr_one', user_id: 'alice', friend_id: 'bob', status: 'accepted', deleted: false, updated_at: '2026-09-28T00:00:00.000Z' };
beforeEach(() => {
  const values = new Map(); vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k), setItem: (k: string, v: string) => values.set(k, v) });
  vi.clearAllMocks(); state.rows.clear(); state.list.mockResolvedValue({ rows: [remote] });
});
describe('server-owned friendship cache', () => {
  it('replaces legacy dirty/future-dated rows and tombstones absent local orphans without pushing', async () => {
    const existing = local('fr_one', { status: 'pending_outgoing' }); const orphan = local('fr_orphan');
    const other = local('fr_other', { userId: 'other' });
    await syncFriendships('alice');
    expect(existing.status).toBe('accepted'); expect(orphan.isDeleted).toBe(true); expect(other.isDeleted).toBe(false);
    expect(state.create).not.toHaveBeenCalled(); expect(state.update).not.toHaveBeenCalled();
  });
  it('does not overwrite a newer server response received during a pull', async () => {
    const current = local('fr_one', { updatedAt: '2026-09-29T00:00:00.000Z', status: 'blocked', _meta: { lwt: Date.now() + 1000 } });
    await syncFriendships('alice'); expect(current.status).toBe('blocked');
  });
  it('refuses to prune on a failed full pull', async () => {
    const orphan = local('fr_orphan'); state.list.mockRejectedValue(new Error('offline'));
    await expect(syncFriendships('alice')).rejects.toThrow('offline'); expect(orphan.isDeleted).toBe(false);
  });
  it('filters unexpected owners even when the server returns them', async () => {
    state.list.mockResolvedValue({ rows: [{ ...remote, user_id: 'mallory' }] });
    await syncFriendships('alice'); expect(state.upsert).not.toHaveBeenCalled();
  });
});
