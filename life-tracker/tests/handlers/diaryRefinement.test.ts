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

  it('rejects stale quote epochs and permits a current one', async () => {
    const stale = acceptedDb();
    stale.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
      tableId === 'diary' ? Promise.resolve({ ...diary, quote_epoch: 1 }) : Promise.reject(missing));
    const body = { action: 'deliver', messageId: 'msg_stale_epoch', recipientId: owner,
      content: 'reply', diaryRefId: diary.$id, diaryRefOwnerId: owner,
      diaryRefDate: diary.date, diaryRefEpoch: 0 };
    expect((await invoke({ userId: caller, mockDb: stale, body })).status).toBe(403);
    expect(stale.createRow).not.toHaveBeenCalled();
    const accepted = await invoke({ userId: caller, mockDb: stale,
      body: { ...body, messageId: 'msg_fresh_epoch', diaryRefEpoch: 1 } });
    expect(accepted.status).toBe(200);
    expect(stale.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'messages', data: expect.objectContaining({ diary_ref_epoch: 1 }),
    }));
  });

  it('revokes diary quote versions and scrubs both copies without deleting chat bodies', async () => {
    const db = makeMockDb();
    const currentDiary = { ...diary, quote_epoch: 0,
      quote_revoke_revision: '', updated_at: '2026-10-12T12:00:00.000Z',
      $updatedAt: '2026-10-12T12:00:02.000Z' };
    const messages = [
      { $id: 'msg_quote_a', diary_ref_id: diary.$id, diary_ref_owner_id: owner,
        diary_ref_epoch: 0, diary_ref_excerpt: 'Sensitive original text',
        diary_ref_date: diary.date },
      { $id: 'rmsg_quote_b', diary_ref_id: diary.$id, diary_ref_owner_id: owner,
        diary_ref_epoch: 0, diary_ref_excerpt: 'Sensitive original text',
        diary_ref_date: diary.date },
    ];
    db.getRow.mockResolvedValue(currentDiary);
    db.updateRows.mockResolvedValue({ total: 1, rows: [] });
    db.listRows.mockResolvedValue({ rows: messages });
    const revision = '2026-10-13T12:00:00.000Z';
    const result = await invoke({ userId: owner, mockDb: db, body: {
      action: 'revoke_diary_references', diaryId: diary.$id, revision,
    } });
    expect(result.status).toBe(200);
    expect(result.body.scrubbed).toBe(2);
    expect(db.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'diary', data: expect.objectContaining({
        quote_epoch: 1, quote_revoke_revision: revision,
      }), queries: expect.arrayContaining([
        expect.objectContaining({ op: 'equal', key: '$updatedAt', value: currentDiary.$updatedAt }),
        expect.objectContaining({ op: 'equal', key: 'user_id', value: owner }),
      ]),
    }));
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'messages', rowId: 'msg_quote_a',
      data: expect.objectContaining({ diary_ref_excerpt: '', diary_ref_date: '' }),
    }));
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'messages', rowId: 'rmsg_quote_b',
      data: expect.objectContaining({ diary_ref_excerpt: '', diary_ref_date: '' }),
    }));
    expect(db.updateRow.mock.calls.some(([args]: [Record<string, unknown>]) =>
      args.tableId === 'messages' && (args.data as Record<string, unknown>).content !== undefined)).toBe(false);
  });

  it('rejects unauthorized diary quote revocation', async () => {
    const db = makeMockDb();
    db.getRow.mockResolvedValue(diary);
    const result = await invoke({ userId: caller, mockDb: db, body: {
      action: 'revoke_diary_references', diaryId: diary.$id,
      revision: '2026-10-13T12:00:00.000Z',
    } });
    expect(result.status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('retries an interrupted revocation without incrementing the epoch again', async () => {
    const db = makeMockDb();
    const revision = '2026-10-13T12:00:00.000Z';
    const updatedDiary = { ...diary, quote_epoch: 1,
      quote_revoke_revision: revision, updated_at: '2026-10-12T12:00:00.000Z' };
    db.getRow.mockResolvedValue(updatedDiary);
    db.listRows.mockResolvedValue({ rows: [{
      $id: 'msg_retry', diary_ref_id: diary.$id, diary_ref_owner_id: owner,
      diary_ref_epoch: 0, diary_ref_excerpt: 'Old text', diary_ref_date: diary.date,
    }] });
    const result = await invoke({ userId: owner, mockDb: db,
      body: { action: 'revoke_diary_references', diaryId: diary.$id, revision } });
    expect(result.status).toBe(200);
    expect(result.body.epoch).toBe(1);
    expect(result.body.scrubbed).toBe(1);
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'messages', rowId: 'msg_retry',
    }));
  });

  it('rejects stale revocation revisions and unauthorized cross-owner writes', async () => {
    const db = makeMockDb();
    db.getRow.mockResolvedValue({
      ...diary, quote_epoch: 2, quote_revoke_revision: '2026-10-13T12:00:00.000Z',
      updated_at: '2026-10-13T12:01:00.000Z',
    });
    const stale = await invoke({ userId: owner, mockDb: db,
      body: { action: 'revoke_diary_references', diaryId: diary.$id,
        revision: '2026-10-13T12:00:30.000Z' } });
    expect(stale.status).toBe(409);
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('fails closed while a privacy change is fenced but not yet published', async () => {
    const db = acceptedDb();
    const pending = { ...diary, quote_epoch: 1,
      quote_revoke_revision: '2026-10-13T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z' };
    const message = { $id: 'msg_fenced', user_id: caller,
      sender_id: caller, recipient_id: owner, diary_ref_id: diary.$id,
      diary_ref_owner_id: owner, diary_ref_date: diary.date,
      diary_ref_epoch: 1 };
    db.getRow.mockImplementation(({ tableId }: { tableId: string }) =>
      Promise.resolve(tableId === 'messages' ? message : pending));
    const preview = await invoke({ userId: caller, mockDb: db,
      body: { action: 'get_diary_reference_previews', messageIds: ['msg_fenced'] } });
    expect(preview.status).toBe(200);
    expect(preview.body.previews).toEqual({});
    const deliver = await invoke({ userId: caller, mockDb: db,
      body: { action: 'deliver', messageId: 'msg_fenced_new', recipientId: owner,
        diaryRefId: diary.$id, diaryRefOwnerId: owner, diaryRefDate: diary.date,
        diaryRefEpoch: 1, content: 'reply' } });
    expect(deliver.status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('does not increment or scrub when the epoch CAS loses to another writer', async () => {
    const db = makeMockDb();
    db.getRow.mockResolvedValue({
      ...diary, updated_at: '2026-10-12T12:00:00.000Z',
      $updatedAt: '2026-10-12T12:00:02.000Z',
      quote_epoch: 0, quote_revoke_revision: '',
    });
    const response = await invoke({ userId: owner, mockDb: db,
      body: { action: 'revoke_diary_references', diaryId: diary.$id,
        revision: '2026-10-13T12:00:00.000Z' } });
    expect(response.status).toBe(409);
    expect(db.updateRows).toHaveBeenCalledTimes(1);
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
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
