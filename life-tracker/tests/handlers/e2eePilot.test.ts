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
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID', '6b00671500279e901846');
    vi.stubEnv('APPWRITE_FUNCTION_API_ENDPOINT', 'http://127.0.0.1/v1');
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
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6ae94a2100014d01f5ed');
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
  it('fails closed without an independently authenticated Appwrite session', async () => {
    const body = { action: 'e2ee_diary_pilot', operation: 'create_root', envelope: recovery };
    const missing = await invoke({ userId: owner, body, mockDb: db, pilotJwt: null });
    expect(missing.status).toBe(401);
    const pendingMfa = await invoke({
      userId: owner, body, mockDb: db, pilotSessionRejected: true,
    });
    expect(pendingMfa.status).toBe(401);
    const noMfaConfigured = await invoke({
      userId: owner, body, mockDb: db, pilotMfaDisabled: true,
    });
    expect(noMfaConfigured.status).toBe(401);
    const mismatchedJwtOwner = await invoke({
      userId: owner, body, mockDb: db, pilotSessionOwnerId: other,
    });
    expect(mismatchedJwtOwner.status).toBe(401);
    vi.stubEnv('APPWRITE_FUNCTION_API_ENDPOINT', '');
    const unavailableProvider = await invoke({ userId: owner, body, mockDb: db });
    expect(unavailableProvider.status).toBe(401);
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
  it('returns a monotonic recovery generation and rejects invalid old data', async () => {
    db.getRow.mockResolvedValue({
      user_id: owner, generation: 2, key_id: kid, envelope: JSON.stringify(recovery),
    });
    const result = await send(db, 'read_root');
    expect(result.body).toMatchObject({ok:true, generation:2, envelope:recovery});
    db.getRow.mockResolvedValue({
      user_id: owner, generation: 0, key_id: kid, envelope: JSON.stringify(recovery),
    });
    expect((await send(db, 'read_root')).status).toBe(409);
  });
  it('rotates recovery wrapping with single-row server CAS and no plaintext', async () => {
    const next = { ...recovery, iv: 'AQEBAQEBAQEBAQEB' };
    db.getRow.mockResolvedValue({
      user_id: owner, generation: 1, key_id: kid, envelope: JSON.stringify(recovery),
    });
    const result = await send(db, 'rotate_recovery', {
      expectedEnvelope: recovery, expectedGeneration: 1, envelope: next,
    });
    expect(result.body).toMatchObject({ok:true,status:'updated',generation:2});
    const update = db.updateRows.mock.calls[0][0];
    expect(update.tableId).toBe('account_crypto_envelopes');
    expect(update.queries).toContainEqual({op:'equal',key:'generation',value:1});
    expect(update.queries).toContainEqual({op:'equal',key:'user_id',value:owner});
    expect(update.data.envelope).toBe(JSON.stringify(next));
    expect(update.data).not.toHaveProperty('content');
  });
  it('rejects stale or unrelated recovery rotation without any mutation', async () => {
    const next = { ...recovery, iv: 'AQEBAQEBAQEBAQEB' };
    const different = { ...recovery, kid: 'k_' + 'b'.repeat(32) };
    db.getRow.mockResolvedValue({
      user_id: owner, generation: 2, key_id: kid, envelope: JSON.stringify(recovery),
    });
    const payload = { expectedEnvelope: recovery, expectedGeneration: 1, envelope: next };
    expect((await send(db,'rotate_recovery',payload)).status).toBe(409);
    expect((await send(db,'rotate_recovery',{...payload,envelope:different})).status).toBe(400);
    expect((await send(db,'rotate_recovery',{...payload,expectedGeneration:0})).status).toBe(400);
    expect((await send(db,'rotate_recovery',{...payload,ownerId:other})).status).toBe(403);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('retries an already acknowledged CAS without duplicating the generation', async () => {
    const next = { ...recovery, iv: 'AQEBAQEBAQEBAQEB' };
    db.getRow.mockResolvedValue({
      user_id: owner, generation: 2, key_id: kid, envelope: JSON.stringify(next),
    });
    const result = await send(db,'rotate_recovery',{
      expectedEnvelope:recovery, expectedGeneration:1, envelope:next,
    });
    expect(result.body).toMatchObject({ok:true,status:'duplicate',generation:2});
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('detects simultaneous recovery replacement without accepting stale CAS', async () => {
    const next = { ...recovery, iv: 'AQEBAQEBAQEBAQEB' };
    const later = { user_id:owner, generation:2, key_id:kid,
      envelope:JSON.stringify({...recovery,iv:'AgICAgICAgICAgIC'}) };
    db.getRow.mockResolvedValueOnce({
      user_id:owner,generation:1,key_id:kid,envelope:JSON.stringify(recovery),
    }).mockResolvedValueOnce(later);
    db.updateRows.mockResolvedValueOnce({total:0});
    const result = await send(db,'rotate_recovery',{
      expectedEnvelope:recovery, expectedGeneration:1, envelope:next,
    });
    expect(result.status).toBe(409);
    expect(db.updateRows).toHaveBeenCalledOnce();
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
