import { describe, expect, it } from 'vitest';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

const caller = 'person_a';
const friend = 'person_b';
const payload = { action: 'get_friend_diary_month', friendUserId: friend, month: '2026-10' };
const friendship = { $id: 'friendship_accepted' };

describe('get_friend_diary_month privacy', () => {
  it('rejects invalid input without querying rows', async () => {
    const db = makeMockDb();
    const result = await invoke({ userId: caller, mockDb: db, body: { ...payload, month: '2026-13' } });
    expect(result.status).toBe(400);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('denies strangers before querying diary rows', async () => {
    const db = makeMockDb();
    const result = await invoke({ userId: caller, mockDb: db, body: payload });
    expect(result.status).toBe(403);
    expect(db.listRows.mock.calls.every(call => call[0].tableId !== 'diary')).toBe(true);
  });

  it('filters private, deleted and out-of-month rows even if returned unexpectedly', async () => {
    const db = makeMockDb();
    db.listRows.mockResolvedValueOnce({ rows: [friendship] })
      .mockResolvedValueOnce({ rows: [friendship] })
      .mockResolvedValueOnce({ rows: [
        { $id: 'ok', user_id: friend, date: '2026-10-12', content: 'visible', emoji: '🌱', visibility: 'followers', deleted: false },
        { $id: 'secret', user_id: friend, date: '2026-10-14', content: 'SECRET', emoji: '🔒', visibility: 'private', deleted: false },
        { $id: 'old', user_id: friend, date: '2026-09-30', content: 'OLD', visibility: 'public', deleted: false },
        { $id: 'removed', user_id: friend, date: '2026-10-17', content: 'deleted', visibility: 'public', deleted: true },
        { $id: 'alien', user_id: caller, date: '2026-10-18', content: 'OTHER', visibility: 'public', deleted: false },
      ] });
    const result = await invoke({ userId: caller, mockDb: db, body: payload });
    expect(result.status).toBe(200);
    expect(result.body.entries).toEqual([expect.objectContaining({ $id: 'ok', content: 'visible', emoji: '🌱' })]);
    const diaryQuery = db.listRows.mock.calls.find(call => call[0].tableId === 'diary')?.[0];
    expect(diaryQuery).toBeDefined();
    expect(JSON.stringify(diaryQuery.queries)).toContain('2026-10-01');
    expect(JSON.stringify(diaryQuery.queries)).toContain('2026-11-01');
  });

  it('rejects one-sided friendship or self lookups', async () => {
    const db = makeMockDb();
    db.listRows.mockResolvedValueOnce({ rows: [friendship] }).mockResolvedValueOnce({ rows: [] });
    expect((await invoke({ userId: caller, mockDb: db, body: payload })).status).toBe(403);
    expect((await invoke({ userId: caller, mockDb: db, body: { ...payload, friendUserId: caller } })).status).toBe(400);
  });
});
