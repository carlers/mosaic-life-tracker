import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const req = createRequire(import.meta.url);
const { reserveMediaUpload, confirmMediaUpload, RESERVATION_MS } =
  req('../../appwrite-functions/message-action/media-provenance.js');

const owner = 'synthetic_owner', stranger = 'synthetic_stranger', now = 1_784_000_000_000;
const id = 'img_' + 'a'.repeat(32);
const validFile = {
  $id: id, $createdAt: new Date(now + 1000).toISOString(),
  sizeOriginal: 167, mimeType: 'image/webp',
  $permissions: ['read("users")', `update("user:${owner}")`, `delete("user:${owner}")`],
};
const row = {
  $id: id, file_id: id, owner_id: owner, purpose: 'tasks', status: 'reserved',
  reserved_at: new Date(now).toISOString(), expires_at: new Date(now + RESERVATION_MS).toISOString(),
};

describe('server-minted media upload provenance (no physical deletion)', () => {
  it('mints a non-client-controlled owner-scoped opaque reservation with no permissions', async () => {
    const db = makeMockDb();
    const r = await reserveMediaUpload({ db, callerId: owner, purpose: 'tasks', now });
    expect(r.status).toBe(200);
    expect(r.body.fileId).toMatch(/^img_[0-9a-f]{32}$/);
    expect(r.body.deletionAuthorized).toBe(false);
    const args = db.createRow.mock.calls[0][0];
    expect(args.tableId).toBe('media_uploads');
    expect(args.permissions).toEqual([]);
    expect(args.rowId).toBe(r.body.fileId);
    expect(args.data.owner_id).toBe(owner);
    expect(args.data.status).toBe('reserved');
  });
  it('rejects invalid purpose and unauthenticated actor without writes', async () => {
    const db = makeMockDb();
    expect((await reserveMediaUpload({ db, callerId: owner, purpose:'other', now })).status).toBe(400);
    expect((await reserveMediaUpload({ db, callerId:'', purpose:'tasks', now })).status).toBe(401);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('verifies current Storage metadata, exact owner grants and post-reservation creation', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.getRow.mockResolvedValue(row);
    storage.getFile = vi.fn().mockResolvedValue(validFile);
    db.updateRows.mockResolvedValue({ total: 1 });
    const r = await confirmMediaUpload({ db, storage, callerId: owner, fileId:id, now:now+2000 });
    expect(r).toEqual({status:200,body:{fileId:id,status:'verified',deletionAuthorized:false}});
    expect(db.updateRows).toHaveBeenCalledTimes(1);
    expect(db.updateRows.mock.calls[0][0].data).toMatchObject({status:'verified',size_bytes:167});
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('denies a foreign caller before storage access or mutation', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.getRow.mockResolvedValue(row);
    expect((await confirmMediaUpload({db, storage, callerId:stranger,fileId:id,now})).status).toBe(403);
    expect(storage.getFile).not.toHaveBeenCalled();
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('does not trust owner-ACL spoofing, changed file IDs or stale preissued files', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.getRow.mockResolvedValue(row);
    storage.getFile = vi.fn();
    for (const file of [
      {...validFile, $id:'other'},
      {...validFile, $permissions:['read("users")',`update("user:${owner}")`,`delete("user:${stranger}")`]},
      {...validFile, $createdAt:new Date(now-60000).toISOString()},
      {...validFile, sizeOriginal:-1},
      {...validFile, mimeType:'text/plain'},
    ]) {
      storage.getFile.mockResolvedValue(file);
      const r = await confirmMediaUpload({db,storage,callerId:owner,fileId:id,now:now+2000});
      expect(r.status).toBe(409);
    }
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('rejects expired reservations and unrecognized legacy file IDs', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.getRow.mockResolvedValue(row);
    expect((await confirmMediaUpload({db,storage,callerId:owner,fileId:id,now:now+RESERVATION_MS+1})).status).toBe(409);
    expect((await confirmMediaUpload({db,storage,callerId:owner,fileId:'legacy_userfile',now})).status).toBe(400);
    expect(storage.getFile).not.toHaveBeenCalled();
  });
  it('treats missing upload, concurrent updates and storage errors as non-deletion outcomes', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.getRow.mockResolvedValue(row);
    storage.getFile = vi.fn().mockRejectedValue({code:404});
    expect((await confirmMediaUpload({db,storage,callerId:owner,fileId:id,now:now+2000})).status).toBe(409);
    storage.getFile.mockResolvedValue(validFile);
    db.updateRows.mockResolvedValue({total:0});
    expect((await confirmMediaUpload({db,storage,callerId:owner,fileId:id,now:now+2000})).status).toBe(409);
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('idempotent verification rechecks Storage permissions; never deletes', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.getRow.mockResolvedValue({...row,status:'verified'});
    storage.getFile = vi.fn().mockResolvedValue(validFile);
    expect((await confirmMediaUpload({db,storage,callerId:owner,fileId:id,now:now+2000})).status).toBe(200);
    expect(db.updateRows).not.toHaveBeenCalled();
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('routes authenticated actions through the existing Function without client supplied owner', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    const r = await invoke({userId:owner,body:{action:'reserve_media_upload',purpose:'diary',ownerId:owner},mockDb:db,mockStorage:storage});
    expect(r.status).toBe(200);
    expect(db.createRow.mock.calls[0][0].data.owner_id).toBe(owner);
    const bad = await invoke({userId:owner,body:{action:'reserve_media_upload',purpose:'tasks',ownerId:stranger},mockDb:db,mockStorage:storage});
    expect(bad.status).toBe(403); // spoof is blocked before other-account state lookup
  });
});
