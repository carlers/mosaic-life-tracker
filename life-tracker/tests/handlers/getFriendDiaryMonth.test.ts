import { describe, expect, it } from 'vitest';
import { invoke, makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

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

describe('diary reactions and owner-private friend attachments', () => {
  const visibleDiary = {
    $id: 'diary_visible', user_id: friend, date: '2026-10-12',
    visibility: 'followers', photos: '["img_photo"]', deleted: false,
  };
  const approvedFriendship = () => {
    const db = makeMockDb();
    // A diary reaction now performs a second ACL check while delivering activity.
    db.listRows.mockResolvedValue({rows:[friendship]});
    return db;
  };
  it('never reads diary or photos for a stranger', async () => {
    const db = makeMockDb(); const storage = makeMockStorage();
    const result = await invoke({ userId: caller, mockDb: db, mockStorage: storage,
      body: {action:'get_friend_diary_photo', friendUserId:friend, diaryId:'diary_visible', fileId:'img_photo'} });
    expect(result.status).toBe(403);
    expect(db.getRow).not.toHaveBeenCalledWith(expect.objectContaining({tableId:'diary'}));
    expect(storage.getFile).not.toHaveBeenCalled();
  });
  it('cannot download private or unreferenced diary photos', async () => {
    const db = approvedFriendship();const storage = makeMockStorage();
    db.getRow.mockResolvedValueOnce({...visibleDiary, visibility:'private'});
    const denied = await invoke({userId:caller,mockDb:db,mockStorage:storage,
      body:{action:'get_friend_diary_photo',friendUserId:friend,diaryId:'diary_visible',fileId:'img_photo'}});
    expect(denied.status).toBe(403);
    expect(storage.getFile).not.toHaveBeenCalled();
    const permittedDb=approvedFriendship();permittedDb.getRow.mockResolvedValueOnce(visibleDiary);
    const absent = await invoke({userId:caller,mockDb:permittedDb,mockStorage:storage,
      body:{action:'get_friend_diary_photo',friendUserId:friend,diaryId:'diary_visible',fileId:'img_other'}});
    expect(absent.status).toBe(404);
    expect(storage.getFile).not.toHaveBeenCalled();
  });
  it('returns one authorized WebP without granting direct storage permissions', async () => {
    const db=approvedFriendship();const storage=makeMockStorage();
    db.getRow.mockResolvedValueOnce(visibleDiary);
    const result=await invoke({userId:caller,mockDb:db,mockStorage:storage,
      body:{action:'get_friend_diary_photo',friendUserId:friend,diaryId:'diary_visible',fileId:'img_photo'}});
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({mimeType:'image/webp',data:Buffer.from('fake-image').toString('base64')});
    expect(storage.getFile).toHaveBeenCalledWith(expect.objectContaining({fileId:'img_photo'}));
    expect(db.updateRow).not.toHaveBeenCalled();
  });
  it('only permits visible diary reactions for accepted friends', async () => {
    const db=makeMockDb();
    const denied=await invoke({userId:caller,mockDb:db,
      body:{action:'react_to_diary',friendUserId:friend,diaryId:'diary_visible',emoji:'🌱',op:'add'}});
    expect(denied.status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();

    const permittedDb=approvedFriendship();permittedDb.getRow
      .mockResolvedValueOnce(visibleDiary)
      .mockRejectedValueOnce(Object.assign(new Error('missing'), {code:404}))
      .mockResolvedValueOnce(visibleDiary);
    const result=await invoke({userId:caller,mockDb:permittedDb,
      body:{action:'react_to_diary',friendUserId:friend,diaryId:'diary_visible',emoji:'🌱',op:'add'}});
    expect(result.status).toBe(200);
    expect(permittedDb.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'diary_reactions',permissions:[],data:expect.objectContaining({
        owner_id:friend,user_id:caller,emoji:'🌱',deleted:false
      })
    }));
  });
});
