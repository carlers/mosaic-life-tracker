import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';
const owner = 'synthetic_owner', other = 'synthetic_other';
const kid = 'k_' + 'a'.repeat(32), rev = 'r_' + '1'.repeat(32);
const rowId = 'p_' + '2'.repeat(32), opId = 'o_' + '3'.repeat(32);
const recovery = { v:1, alg:'A256GCM', kid, iv:'AAAAAAAAAAAAAAAA', ct:'A'.repeat(64) };
const envelope = { ...recovery, revision:rev, ct:'A'.repeat(32) };
const send = (db:MockDb, operation:string, extras:Record<string,unknown>={}, userId=owner) =>
  invoke({userId, body:{action:'e2ee_diary_pilot',operation,...extras},mockDb:db});

describe('isolated E2EE Diary transport: server cannot create plaintext', () => {
  let db:MockDb;
  beforeEach(() => {
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID', '6ae94a2100014d01f5ed');
    vi.stubEnv('MOSAIC_E2EE_PILOT_ENABLED', 'true');
    vi.stubEnv('MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS', owner + ',' + other);
    db=makeMockDb();
    db.createRow.mockResolvedValue({});
    db.updateRows.mockResolvedValue({total:1});
  });
  afterEach(() => vi.unstubAllEnvs());
  it('cannot run with the feature gate off or in the production project', async () => {
    vi.stubEnv('MOSAIC_E2EE_PILOT_ENABLED','false');
    expect((await send(db,'create_root',{envelope:recovery})).status).toBe(404);
    vi.stubEnv('MOSAIC_E2EE_PILOT_ENABLED','true');
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6ae9599c002ab812f9c3');
    expect((await send(db,'create_root',{envelope:recovery})).status).toBe(404);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('requires an exact disposable account allowlist, even on Scratch', async () => {
    vi.stubEnv('MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS', '');
    expect((await send(db, 'create_root', { envelope: recovery })).status).toBe(403);
    vi.stubEnv('MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS', 'synthetic_otherr');
    expect((await send(db, 'create_root', { envelope: recovery })).status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('derives owner from caller and stores only owner-readable wrapped root', async () => {
    const result=await send(db,'create_root',{envelope:recovery});
    expect(result.status).toBe(200);
    const args=db.createRow.mock.calls[0][0];
    expect(args.tableId).toBe('account_crypto_envelopes');
    expect(args.data.user_id).toBe(owner);
    expect(args.permissions).toEqual(['read("user:synthetic_owner")']);
    expect(JSON.stringify(args)).not.toContain('plaintext-secret-marker');
  });
  it('rejects plaintext, PIN fields, unsafely formed ciphertext and spoofed owner', async () => {
    expect((await send(db,'create_root',{envelope:{...recovery,pin:'123456'}})).status).toBe(400);
    expect((await send(db,'create_root',{envelope:{...recovery,ct:'123456'}})).status).toBe(400);
    expect((await send(db,'put',{rowId,opId,envelope:{...envelope,content:'secret'}})).status).toBe(400);
    expect((await send(db,'put',{rowId,opId,envelope:{...envelope,ct:'inval!d'}})).status).toBe(400);
    expect((await send(db,'put',{rowId,opId,envelope,ownerId:other})).status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('creates unique opaque rows with owner-read only, no owner direct write', async () => {
    const result=await send(db,'put',{rowId,opId,envelope});
    expect(result.body).toMatchObject({status:'created',revision:rev});
    expect(db.createRow.mock.calls[0][0]).toMatchObject({
      tableId:'private_diary_ciphertexts',rowId,permissions:['read("user:synthetic_owner")'],
      data:{user_id:owner,key_id:kid,revision:rev,op_id:opId,deleted:false},
    });
  });
  it('rejects a foreign row and never mutates it', async () => {
    db.getRow.mockResolvedValue({user_id:other,revision:rev});
    const result=await send(db,'get',{rowId});
    expect(result.status).toBe(403);
    const update=await send(db,'put',{rowId,opId,envelope,expectedRevision:rev});
    expect(update.status).toBe(403);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('enforces CAS and rejects stale revisions with no mutation', async () => {
    db.getRow.mockResolvedValue({
      $id:rowId,user_id:owner,key_id:kid,revision:rev,
      op_id:'o_'+'4'.repeat(32),envelope:JSON.stringify(envelope),deleted:false,
    });
    const next={...envelope,revision:'r_'+'5'.repeat(32)};
    expect((await send(db,'put',{rowId,opId,envelope:next,expectedRevision:'r_'+'6'.repeat(32)})).status).toBe(409);
    expect(db.updateRows).not.toHaveBeenCalled();
    expect((await send(db,'put',{rowId,opId,envelope:next,expectedRevision:rev})).status).toBe(200);
    expect(db.updateRows.mock.calls[0][0].queries).toContainEqual({op:'equal',key:'revision',value:rev});
  });
  it('idempotent lost response does not re-encrypt/rewrite same bytes', async () => {
    db.getRow.mockResolvedValue({
      $id:rowId,user_id:owner,key_id:kid,revision:rev,
      op_id:opId,envelope:JSON.stringify(envelope),deleted:false,
    });
    const r=await send(db,'put',{rowId,opId,envelope,expectedRevision:'r_'+'0'.repeat(32)});
    expect(r.body.status).toBe('duplicate');
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('scopes listed rows to caller and validates cursors', async () => {
    db.listRows.mockResolvedValue({rows:[
      {$id:rowId,user_id:owner,key_id:kid,revision:rev,envelope:JSON.stringify(envelope),deleted:false},
      {$id:'p_'+'9'.repeat(32),user_id:other},
    ]});
    const result=await send(db,'list');
    expect(result.body.rows).toHaveLength(1);
    expect(db.listRows.mock.calls[0][0].queries).toContainEqual({op:'equal',key:'user_id',value:owner});
    expect((await send(db,'list',{after:'invalid'})).status).toBe(400);
  });
});
