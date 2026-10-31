import { describe, expect, it } from 'vitest';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

const caller = 'person_a';
const owner = 'person_b';
const friend = { $id: 'friendship_accepted' };
const diary = {
  $id: 'diary_visible', user_id: owner, date: '2026-10-12', content: 'Original diary content',
  visibility: 'followers', deleted: false, emoji: '🍁',
};
const missing = Object.assign(new Error('missing'), { code: 404 });
function acceptedDb() {
  const db = makeMockDb();
  db.listRows.mockResolvedValue({ rows: [friend] });
  db.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
    tableId === 'diary' ? Promise.resolve(diary) : Promise.reject(missing));
  return db;
}

describe('diary reference and reaction security', () => {
  it('refuses a forged or no-longer-readable diary quote', async () => {
    const db = makeMockDb();
    const message = {
      action: 'deliver', messageId: 'msg_diary_denied', recipientId: owner, content: 'reply',
      diaryRefId: diary.$id, diaryRefOwnerId: owner, diaryRefDate: diary.date,
    };
    expect((await invoke({ userId: caller, mockDb: db, body: message })).status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
    const accepted = acceptedDb();
    const forged = await invoke({ userId: caller, mockDb: accepted,
      body: { ...message, diaryRefOwnerId: caller } });
    expect(forged.status).toBe(400);
    expect(accepted.createRow).not.toHaveBeenCalled();
  });

  it('does not persist diary excerpts even when old clients send them', async () => {
    const db = acceptedDb();
    const result = await invoke({ userId: caller, mockDb: db, body: {
      action: 'deliver', messageId: 'msg_diary_accepted', recipientId: owner,
      content: 'My actual reply', diaryRefId: diary.$id,
      diaryRefOwnerId: owner, diaryRefDate: diary.date,
      diaryRefExcerpt: 'FAKE QUOTE',
    } });
    expect(result.status).toBe(200);
    expect(db.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'messages',
      data: expect.objectContaining({
        diary_ref_id: diary.$id, diary_ref_owner_id: owner,
        diary_ref_excerpt: '', content: 'My actual reply',
      }),
    }));
  });

  it('returns diary previews only for currently visible entries owned by message participants', async () => {
    const db = acceptedDb();
    const message = {
      $id: 'msg_diary_preview', user_id: caller, deleted: false,
      sender_id: caller, recipient_id: owner, diary_ref_id: diary.$id,
      diary_ref_owner_id: owner, diary_ref_date: diary.date,
    };
    db.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
      Promise.resolve(tableId === 'messages' ? message : diary));
    const allowed = await invoke({ userId: caller, mockDb: db,
      body: { action: 'get_diary_reference_previews', messageIds: [message.$id] } });
    expect(allowed.status).toBe(200);
    expect(allowed.body.previews[message.$id]).toEqual({
      date: diary.date, excerpt: 'Original diary content',
    });

    db.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
      Promise.resolve(tableId === 'messages' ? message : { ...diary, visibility: 'private' }));
    const denied = await invoke({ userId: caller, mockDb: db,
      body: { action: 'get_diary_reference_previews', messageIds: [message.$id] } });
    expect(denied.status).toBe(200);
    expect(denied.body.previews).toEqual({});

    db.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
      Promise.resolve(tableId === 'messages' ? { ...message, user_id: 'another' } : diary));
    const forged = await invoke({ userId: caller, mockDb: db,
      body: { action: 'get_diary_reference_previews', messageIds: [message.$id] } });
    expect(forged.status).toBe(200);
    expect(forged.body.previews).toEqual({});
  });

  it('denies cross-owner reaction summaries without querying actor identities', async () => {
    const db = makeMockDb();
    db.getRow.mockResolvedValueOnce(diary);
    const res = await invoke({ userId: caller, mockDb: db,
      body: { action: 'get_owner_diary_reactions', diaryId: diary.$id } });
    expect(res.status).toBe(403);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('writes one message activity alongside an authorized diary reaction', async () => {
    const db = acceptedDb();
    const res = await invoke({ userId: caller, mockDb: db, body: {
      action: 'react_to_diary', friendUserId: owner, diaryId: diary.$id,
      emoji: '🔥', op: 'add',
    } });
    expect(res.status).toBe(200);
    const writes = db.createRow.mock.calls.map(([value]: [Record<string, unknown>]) => value);
    expect(writes.filter(row => row.tableId === 'diary_reactions')).toHaveLength(1);
    expect(writes.filter(row => row.tableId === 'messages')).toHaveLength(2);
    expect(writes.find(row => row.tableId === 'messages')).toEqual(
      expect.objectContaining({ data: expect.objectContaining({
        diary_ref_id: diary.$id, diary_ref_owner_id: owner,
      }) }));
  });

  it('does not emit any social activity for removal of an absent reaction', async () => {
    const db = acceptedDb();
    const result = await invoke({ userId: caller, mockDb: db, body: {
      action: 'react_to_diary', friendUserId: owner, diaryId: diary.$id,
      emoji: '🔥', op: 'remove',
    } });
    expect(result.status).toBe(200);
    expect(result.body.changed).toBe(false);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('summarizes owner reactions only for the authorized diary owner', async () => {
    const db = acceptedDb();
    db.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
      tableId === 'diary'
        ? Promise.resolve({ ...diary, user_id: owner })
        : Promise.reject(missing));
    db.listRows.mockImplementation(({ tableId }: { tableId: string }) =>
      Promise.resolve({ rows: tableId === 'diary_reactions'
        ? [{ diary_id: diary.$id, owner_id: owner, user_id: caller, emoji: '🔥', deleted: false }]
        : [friend] }));
    const result = await invoke({ userId: owner, mockDb: db, body: {
      action: 'get_owner_diary_reactions', diaryId: diary.$id,
    } });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body.reactions)).toEqual([{ emoji: '🔥', userIds: [caller] }]);
  });

});
