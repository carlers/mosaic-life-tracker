import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const A = 'user_a', B = 'user_b', MSG = 'msg_synthetic_1';
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 30);
const THREAD = 'th_' + hash('user_a|user_b'), PEER = 'rmsg_' + hash(MSG);
const row = (direction: 'incoming' | 'outgoing' = 'outgoing') => ({
  $id: direction === 'outgoing' ? MSG : PEER,
  user_id: direction === 'outgoing' ? A : B,
  thread_id: THREAD, sender_id: A, recipient_id: B, direction,
  original_message_id: MSG, content: 'synthetic', is_unsent: false, deleted: false,
  created_at: '2026-10-12T00:00:00.000Z',
});
const accepted = { $id: 'accepted' };
describe('message-action / repair_thread', () => {
  let db: MockDb;
  beforeEach(() => { db = makeMockDb(); });
  const invokeRepair = (owner = A, partner = B, scope = 'self', cursor = '') =>
    invoke({ userId: owner, mockDb: db,
      body: { action: 'repair_thread', partnerId: partner, scope, cursor } });
  function allow(rows: object[]) {
    db.listRows.mockResolvedValueOnce({ rows: [accepted] })
      .mockResolvedValueOnce({ rows: [accepted] })
      .mockResolvedValueOnce({ rows });
  }

  it('denies unknown or revoked friends before scanning or writing', async () => {
    const res = await invokeRepair();
    expect(res.status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('repairs an absent recipient copy, with recipient-only permissions', async () => {
    allow([row()]);
    const res = await invokeRepair();
    expect(res.body).toMatchObject({ ok: true, checked: 1, repaired: 1, nextScope: 'peer' });
    const args = db.createRow.mock.calls[0][0];
    expect(args.rowId).toBe(PEER);
    expect(args.data).toMatchObject({ user_id: B, direction: 'incoming',
      original_message_id: MSG, sender_id: A, recipient_id: B,
      content: 'synthetic', deleted: false, is_unsent: false });
    expect(args.permissions).toContain('read("user:user_b")');
  });

  it('repairs a missing sender copy by scanning the other participant', async () => {
    allow([row('incoming')]);
    const res = await invokeRepair(A, B, 'peer');
    expect(res.body).toMatchObject({ ok: true, repaired: 1, nextScope: 'done' });
    expect(db.listRows.mock.calls[2][0].queries)
      .toContainEqual({ op: 'equal', key: 'user_id', value: B });
    const args = db.createRow.mock.calls[0][0];
    expect(args.rowId).toBe(MSG);
    expect(args.data).toMatchObject({ user_id: A, direction: 'outgoing' });
  });

  it('leaves deleted and unsent source rows untouched', async () => {
    allow([{ ...row(), deleted: true }, { ...row(), is_unsent: true }]);
    const res = await invokeRepair();
    expect(res.body.repaired).toBe(0);
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('does not resurrect an unsent recipient row', async () => {
    allow([row()]);
    db.getRow.mockResolvedValueOnce({ ...row('incoming'), is_unsent: true });
    const res = await invokeRepair();
    expect(res.body.repaired).toBe(0);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown peer lookup error', async () => {
    allow([row()]);
    db.getRow.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { code: 503 }));
    const res = await invokeRepair();
    expect(res.status).toBe(503);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('rejects conflicting peer identity and cross-owner snapshot leaks', async () => {
    allow([row()]);
    db.getRow.mockResolvedValueOnce({ ...row('incoming'), user_id: 'attacker' });
    expect((await invokeRepair()).status).toBe(409);
    expect(db.createRow).not.toHaveBeenCalled();

    db = makeMockDb();
    allow([{ ...row(), user_id: B }]);
    expect((await invokeRepair()).status).toBe(409);
  });

  it('accepts a concurrent create winner only if the completed row matches', async () => {
    allow([row()]);
    db.getRow.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 404 }))
      .mockResolvedValueOnce(row('incoming'));
    db.createRow.mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 409 }));
    expect((await invokeRepair()).body).toMatchObject({ ok: true, repaired: 0 });
  });

  it('bounds pages and preserves cursor pagination independently per owner', async () => {
    allow(Array.from({ length: 50 }, (_, i) =>
      ({ ...row(), $id: 'msg_page_' + i, deleted: true })));
    const res = await invokeRepair();
    expect(res.body).toMatchObject({ ok: true, checked: 50, nextCursor: 'msg_page_49', nextScope: 'self' });
    expect(db.listRows.mock.calls[2][0].queries).toContainEqual({ op: 'limit', n: 50 });
  });

  it('rejects invalid partner, scope and cursor without attempting repair', async () => {
    expect((await invokeRepair(A, A)).status).toBe(400);
    expect((await invokeRepair(A, B, 'invalid')).status).toBe(400);
    expect((await invokeRepair(A, B, 'self', 'bad-dash')).status).toBe(400);
    expect(db.createRow).not.toHaveBeenCalled();
  });
});
