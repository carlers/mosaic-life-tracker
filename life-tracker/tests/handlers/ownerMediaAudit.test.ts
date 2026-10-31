import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const requireCjs = createRequire(import.meta.url);
const { auditOwnerMedia, soleOwnerControl, MAX_BUCKET_PAGES }: any =
  requireCjs('../../appwrite-functions/message-action/owner-media-audit.js');

const owner = 'actor_1478';
const stranger = 'other_1478';
const permissions = (id = owner) => [
  'read("users")',
  `update("user:${id}")`,
  `delete("user:${id}")`,
];
const f = (id: string, sizeOriginal = 100, grants = permissions()) =>
  ({ $id: id, sizeOriginal, $permissions: grants });
const task = (id: string, image: unknown, deleted = false) =>
  ({ $id: id, user_id: owner, image, deleted });
const diary = (id: string, photos: string, deleted = false) =>
  ({ $id: id, user_id: owner, photos, deleted });
const respond = (db = makeMockDb(), storage = makeMockStorage(), userId = owner,
  body: Record<string, unknown> = { action: 'get_owner_media_audit' }) =>
  invoke({ userId, body, mockDb: db, mockStorage: storage });

function fixtures() {
  const db = makeMockDb();
  const storage = makeMockStorage();
  db.listRows.mockImplementation(async ({ tableId }: any) => ({
    rows: tableId === 'tasks' ? [
      task('t1', 'img_live'), task('t2', 'img_live'), task('t3', 'img_deleted', true),
      task('t4', 'img_friend'),
    ] : tableId === 'diary' ? [
      diary('d1', JSON.stringify(['img_diary', 'img_live'])),
    ] : [],
  }));
  storage.listFiles.mockResolvedValue({ files: [
    f('img_live', 100), f('img_deleted', 40),
    f('img_diary', 25), f('img_friend', 80, permissions(stranger)),
    f('img_unknown', 300), f('img_outsider', 900, permissions(stranger)),
  ] });
  return { db, storage };
}

describe('Phase 3B read-only server owner media audit', () => {
  it('returns strictly non-deletable owner-scoped summaries; distinct references count once', async () => {
    const { db, storage } = fixtures();
    const result = await respond(db, storage);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      coverage: 'partial-acl-and-owner-references',
      complete: false,
      deletionAuthorized: false,
      truncated: false,
      aclControlledReferencedLive: { files: 2, bytes: 125 },
      aclControlledTombstoned: { files: 1, bytes: 40 },
      aclControlledUnreferencedUnknown: { files: 1, bytes: 300 },
      missingOrUnverifiedReferences: 1,
    });
    expect(JSON.stringify(result.body)).not.toContain('img_');
    expect(result.body.limitations).toContain('no-authoritative-upload-provenance');
    expect(db.listRows).toHaveBeenCalledTimes(3);
    expect(storage.listFiles).toHaveBeenCalledTimes(1);
    expect(db.listRows.mock.calls.every(([args]) =>
      args.queries.some((q: any) =>
        q.op === 'equal' && q.key === 'user_id' && q.value === owner))).toBe(true);
    for (const fn of [db.createRow, db.updateRow, db.deleteRow, storage.deleteFile]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('rejects spoofed owner before any server rows/files are queried', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    const result = await respond(db, storage, owner, {
      action: 'get_owner_media_audit', ownerId: stranger,
    });
    expect(result.status).toBe(403);
    expect(db.listRows).not.toHaveBeenCalled();
    expect(storage.listFiles).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('requires an authenticated platform caller', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    const result = await respond(db, storage, '', { action: 'get_owner_media_audit' });
    expect(result.status).toBe(401);
    expect(db.listRows).not.toHaveBeenCalled();
    expect(storage.listFiles).not.toHaveBeenCalled();
  });

  it('refuses to count stranger-controlled files even when read(users) is granted', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.listRows.mockImplementation(async ({ tableId }: any) => ({
      rows: tableId === 'tasks' ? [task('t1', 'img_foreign')] : [],
    }));
    storage.listFiles.mockResolvedValue({files:[f('img_foreign', 999, permissions(stranger))]});
    const r = await respond(db, storage);
    expect(r.body.aclControlledReferencedLive).toEqual({ files: 0, bytes: 0 });
    expect(r.body.missingOrUnverifiedReferences).toBe(1);
    expect(r.body.aclControlledUnreferencedUnknown).toEqual({ files: 0, bytes: 0 });
  });

  it('fails closed if an admin query returns a foreign row', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.listRows.mockResolvedValue({rows:[{...task('alien', 'private'), user_id:stranger}]});
    const r = await respond(db, storage);
    expect(r.status).toBe(500);
    expect(r.body).toEqual({error:'An internal error occurred'});
    expect(storage.listFiles).not.toHaveBeenCalled();
  });

  it('tolerates nested REST row data with the same strict ownership check', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.listRows.mockImplementation(async ({ tableId }: any) => ({
      rows: tableId === 'tasks' ? [{ $id: 'nested', data: {user_id:owner, deleted:false, image:'img_a'} }] : [],
    }));
    storage.listFiles.mockResolvedValue({files:[f('img_a', 14)]});
    const r = await respond(db,storage);
    expect(r.status).toBe(200);
    expect(r.body.aclControlledReferencedLive).toEqual({ files: 1, bytes: 14 });
  });

  it('counts invalid Diary/photo metadata as unknown, not orphan or reclaimable', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    db.listRows.mockImplementation(async ({ tableId }: any) => ({
      rows: tableId === 'diary' ? [diary('diary_bad', '{not json')] : [],
    }));
    storage.listFiles.mockResolvedValue({files:[f('old_file', 120)]});
    const r = await respond(db,storage);
    expect(r.body.unclassifiedRecords).toBe(1);
    expect(r.body.aclControlledUnreferencedUnknown).toEqual({files:1,bytes:120});
    expect(r.body.deletionAuthorized).toBe(false);
    expect(r.body.complete).toBe(false);
  });

  it('detects staged offline image IDs without calling them uploaded files', async () => {
    const db = makeMockDb();
    db.listRows.mockImplementation(async ({ tableId }: any) => ({
      rows: tableId === 'tasks' ? [task('pending', 'localimg_unsynced')] : [],
    }));
    const r = await respond(db);
    expect(r.status).toBe(200);
    expect(r.body.pendingLocalImageIds).toBe(1);
    expect(r.body.aclControlledReferencedLive.files).toBe(0);
  });

  it('returns partial coverage if the bounded global storage scan fills its page cap', async () => {
    const db = makeMockDb(), storage = makeMockStorage();
    const fullPage = Array.from({length:100}, (_,i) =>
      f('img_' + String(i).padStart(3,'0'), 1, permissions(stranger)));
    storage.listFiles.mockResolvedValue({ files: fullPage });
    const r = await respond(db,storage);
    expect(r.status).toBe(200);
    expect(r.body.truncated).toBe(true);
    expect(r.body.complete).toBe(false);
    expect(r.body.limitations).toContain('pagination-truncated');
    expect(storage.listFiles).toHaveBeenCalledTimes(MAX_BUCKET_PAGES);
  });

  it('rejects ambiguous write grants and invalid metadata', async () => {
    expect(soleOwnerControl(permissions(),owner)).toBe(true);
    expect(soleOwnerControl([...permissions(), 'delete("user:other")'],owner)).toBe(false);
    expect(soleOwnerControl(['read("users")', 'update("user:other")'],owner)).toBe(false);
    expect(soleOwnerControl([...permissions(), 'write("users")'],owner)).toBe(false);
    const db = makeMockDb(), storage = makeMockStorage();
    db.listRows.mockImplementation(async ({tableId}:any) => ({
      rows: tableId==='tasks' ? [task('t1','img_bad')] : [],
    }));
    storage.listFiles.mockResolvedValue({files:[f('img_bad',Number.NaN)]});
    const r = await respond(db,storage);
    expect(r.body.invalidMetadata).toBe(1);
    expect(r.body.aclControlledReferencedLive.files).toBe(0);
    expect(r.body.deletionAuthorized).toBe(false);
  });

  it('fails closed and does not return an inventory if storage pagination fails', async () => {
    const db = makeMockDb(),storage = makeMockStorage();
    storage.listFiles.mockRejectedValue(new Error('provider offline'));
    const r = await respond(db,storage);
    expect(r.status).toBe(500);
    expect(r.body).toEqual({error:'An internal error occurred'});
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
});
