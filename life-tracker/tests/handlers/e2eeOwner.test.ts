import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';
const owner='synthetic_owner', foreign='synthetic_other';
const kid='k_'+'a'.repeat(32), rowId='p_'+'b'.repeat(32),
      revision='r_'+'c'.repeat(32), opId='o_'+'d'.repeat(32);
const root={v:1,alg:'A256GCM',kid,iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(64)};
const envelope={v:1,alg:'A256GCM',kid,revision,iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(32)};
const doc={
  projectId:'6ae94a2100014d01f5ed', ownerId:owner, rowId,
  collection:'tasks',domain:'task', routing:{userId:owner,isDeleted:false,date:'2026-11-19'},
  published:{},envelope,
};
const rootRow={user_id:owner,key_id:kid,generation:1,envelope:JSON.stringify(root)};
function serverRow(record=doc) {
  return {
    $id:record.rowId,user_id:owner,collection:record.collection,
    key_id:kid,revision:record.envelope.revision,
    envelope:JSON.stringify(record.envelope),routing_json:JSON.stringify(record.routing),
    op_id:opId,deleted:false,updated_at:'2026-11-19',
  };
}
const send=(db:MockDb,operation:string,additional:Record<string,unknown>={})=>
  invoke({userId:owner,body:{action:'e2ee_owner_v1',operation,...additional},mockDb:db});

describe('M2 synthetic server-only owner ciphertext action',()=>{
  let db:MockDb;
  beforeEach(()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6ae94a2100014d01f5ed');
    vi.stubEnv('APPWRITE_FUNCTION_API_ENDPOINT','http://127.0.0.1/v1');
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_OWNER_ALLOWED_OWNER_IDS',owner);
    db=makeMockDb();
    db.createRow.mockResolvedValue({});
    db.updateRows.mockResolvedValue({total:1});
    db.getRow.mockImplementation(async (args:{tableId:string})=>
      args.tableId==='account_crypto_roots_v2'?rootRow:serverRow());
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('is off by default; never activates for Production, unlisted or partial MFA',async()=>{
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','false');
    expect((await send(db,'create_root',{envelope:root})).status).toBe(404);
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','true');
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','production');
    expect((await send(db,'create_root',{envelope:root})).status).toBe(404);
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6ae94a2100014d01f5ed');
    vi.stubEnv('MOSAIC_E2EE_OWNER_ALLOWED_OWNER_IDS','');
    expect((await send(db,'create_root',{envelope:root})).status).toBe(403);
    vi.stubEnv('MOSAIC_E2EE_OWNER_ALLOWED_OWNER_IDS',owner);
    expect((await invoke({userId:owner,body:{
      action:'e2ee_owner_v1',operation:'create_root',envelope:root,
    },mockDb:db,pilotSessionRejected:true})).status).toBe(401);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('separately initializes owner crypto root with read-only row ACL',async()=>{
    const result=await send(db,'create_root',{envelope:root});
    expect(result.body).toMatchObject({ok:true,status:'created'});
    const input=db.createRow.mock.calls[0][0];
    expect(input.tableId).toBe('account_crypto_roots_v2');
    expect(input.permissions).toEqual(['read("user:synthetic_owner")']);
    expect(input.data).toMatchObject({user_id:owner,generation:1,key_id:kid});
    expect(JSON.stringify(input)).not.toContain('123456');
  });
  it('replaces only matching root generation through server CAS',async()=>{
    const next={...root,iv:'AQEBAQEBAQEBAQEB'};
    expect((await send(db,'replace_root',{
      expectedGeneration:1,expectedEnvelope:root,envelope:next,
    })).status).toBe(200);
    const args=db.updateRows.mock.calls[0][0];
    expect(args.tableId).toBe('account_crypto_roots_v2');
    expect(args.queries).toContainEqual({op:'equal',key:'generation',value:1});
    expect(args.data).toMatchObject({generation:2,envelope:JSON.stringify(next)});
    db.updateRows.mockClear();
    expect((await send(db,'replace_root',{
      expectedGeneration:0,expectedEnvelope:root,envelope:next,
    })).status).toBe(400);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('allows only ciphertext and reviewed owner-visible metadata in table',async()=>{
    const result=await send(db,'put',{record:doc,opId,expectedRevision:null});
    expect(result.body).toMatchObject({ok:true,status:'created'});
    const args=db.createRow.mock.calls[0][0];
    expect(args.tableId).toBe('private_owner_ciphertexts_v1');
    expect(args.permissions).toEqual(['read("user:synthetic_owner")']);
    expect(args.data.envelope).toBe(JSON.stringify(envelope));
    expect(args.data.routing_json).toBe(JSON.stringify(doc.routing));
    expect(JSON.stringify(args)).not.toContain('very-private-task-content');
    expect(args.data).not.toHaveProperty('title');
  });
  it('rejects plaintext, public visibility, recipient domains and owner spoofing',async()=>{
    for(const bad of [
      {...doc,published:{title:'secret'}},
      {...doc,routing:{...doc.routing,title:'private'}},
      {...doc,envelope:{...envelope,content:'secret'}},
      {...doc,ownerId:foreign},
      {...doc,collection:'messages',domain:'chat-message'},
      {...doc,rowId:'legacy-task-id'},
    ])expect((await send(db,'put',{record:bad,opId,expectedRevision:null})).status).toBe(400);
    expect((await send(db,'put',{record:doc,opId,ownerId:foreign})).status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('does not write before owner root envelope is registered',async()=>{
    db.getRow.mockResolvedValueOnce({user_id:owner,key_id:'k_'+'e'.repeat(32),
      envelope:JSON.stringify({...root,kid:'k_'+'e'.repeat(32)}),generation:1});
    const r=await send(db,'put',{record:doc,opId,expectedRevision:null});
    expect(r.status).toBe(409);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('enforces owner/collection/revision compare-and-swap with client ciphertext',async()=>{
    const next={...doc,envelope:{...envelope,revision:'r_'+'e'.repeat(32)}};
    const a=await send(db,'put',{record:next,opId:'o_'+'f'.repeat(32),expectedRevision:revision});
    expect(a.body).toMatchObject({ok:true,status:'updated'});
    const q=db.updateRows.mock.calls[0][0].queries;
    expect(q).toContainEqual({op:'equal',key:'user_id',value:owner});
    expect(q).toContainEqual({op:'equal',key:'revision',value:revision});
    db.updateRows.mockClear();
    expect((await send(db,'put',{record:doc,opId,expectedRevision:revision})).status).toBe(409);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('lists only owner rows, exact collection and opaque cursor',async()=>{
    db.listRows.mockResolvedValue({rows:[serverRow(),{
      ...serverRow(),user_id:foreign,
    }]});
    const result=await send(db,'list',{collection:'tasks'});
    expect(result.body.rows).toHaveLength(1);
    expect(result.body.rows[0]).toMatchObject({rowId,collection:'tasks',domain:'task'});
    expect(db.listRows.mock.calls[0][0].queries).toContainEqual({op:'equal',key:'collection',value:'tasks'});
    expect((await send(db,'list',{collection:'tasks',after:'plain-id'})).status).toBe(400);
    expect((await send(db,'list',{collection:'messages'})).status).toBe(400);
  });
});
