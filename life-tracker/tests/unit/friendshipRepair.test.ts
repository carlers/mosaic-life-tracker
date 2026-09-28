import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error Operator scripts are JavaScript modules.
import { planFriendshipRepair, applyFriendshipRepair, friendshipId } from '../../scripts/lib/friendship-repair.mjs';
const now = '2026-09-28T00:00:00.000Z';
const profiles = [{ user_id: 'alice', username: 'alice' }, { user_id: 'bob', username: 'bob' }];
const row = { $id: friendshipId('bob', 'alice'), $updatedAt: 'old', $permissions: ['read("user:alice")'],
  user_id: 'bob', friend_id: 'alice', status: 'pending_incoming', deleted: false };
describe('audited friendship repair', () => {
  it('repairs the observed wrong-owner incoming row and reconstructs its outgoing peer', () => {
    const plan = planFriendshipRepair([row], profiles, now);
    expect(plan.ambiguous).toEqual([]); expect(plan.changes).toHaveLength(2);
    expect(plan.changes[0].permissions).toEqual(['read("user:bob")']);
    expect(plan.changes[1]).toMatchObject({ id: friendshipId('alice', 'bob'), before: null,
      data: { user_id: 'alice', friend_id: 'bob', status: 'pending_outgoing' }, permissions: ['read("user:alice")'] });
    const repaired = plan.changes.map((c: any) => ({ ...c.before, ...c.data, $id: c.id, $permissions: c.permissions }));
    expect(planFriendshipRepair(repaired, profiles, now).changes).toEqual([]);
  });
  it.each([{ status: 'blocked' }, { deleted: true }])('never reconstructs blocked or deleted relationships: %o', patch => {
    const plan = planFriendshipRepair([{ ...row, ...patch }], profiles, now);
    expect(plan.changes.every((c: any) => c.before)).toBe(true);
  });
  it('does not invent acceptance for a one-sided accepted relationship', () => {
    const plan = planFriendshipRepair([{ ...row, status: 'accepted' }], profiles, now);
    expect(plan.ambiguous).toHaveLength(1); expect(plan.changes).toHaveLength(1);
  });
  it('aborts before writing when audited rows changed', async () => {
    const db = { createTransaction: vi.fn().mockResolvedValue({ $id: 'tx' }), getRow: vi.fn().mockResolvedValue({ ...row, deleted: true }),
      updateRow: vi.fn(), createRow: vi.fn(), updateTransaction: vi.fn().mockResolvedValue({}) };
    await expect(applyFriendshipRepair(db, 'db', 'friendships', planFriendshipRepair([row], profiles, now))).rejects.toThrow('changed since audit');
    expect(db.updateRow).not.toHaveBeenCalled(); expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'tx', rollback: true });
  });
});
