import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {makeMockDb,type MockDb} from '../helpers/invoke-handler';
import {
  generateAccountRoot,generateKeyId,generateOpaqueRowId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';
import {
  sealV2PrivateOwnerDocument,openV2PrivateOwnerDocument,
  SCRATCH_OWNER_V2_PROJECT,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
const require=createRequire(import.meta.url);
const {handleProspectiveOwnerV2Get}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-candidate.js'
) as {handleProspectiveOwnerV2Get:(db:MockDb,user:string,payload:unknown,jwt:string,
  verifier:(id:string,jwt:string)=>Promise<boolean>)=>Promise<{status:number;body:any}>};
const owner='synthetic_v2_owner',verified=vi.fn(async()=>true);
const rootId='kr_'+require('node:crypto').createHash('sha256')
  .update('mosaic-e2ee-owner-v2|'+owner).digest('hex').slice(0,32);
async function fixture(){
  const root=generateAccountRoot();
  const c={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:owner,
    payloadDomain:'task' as const,rowId:generateOpaqueRowId(),
    keyId:generateKeyId(),revision:generateRevision()};
  const doc={
    id:'PRIVATE_SOURCE_ID',userId:owner,isDeleted:false,
    visibility:'private',date:'2043-01-11',reminderTime:'09:23',
    title:'SECRET OWNER TASK',completed:false,categoryId:'category_private',
    order:1,createdAt:'2026-11-26T01:00:00Z',updatedAt:'2026-11-26T01:00:00Z',
  };
  const record=await sealV2PrivateOwnerDocument(root,
    {projectId:c.projectId,ownerId:owner},c,'tasks',doc);
  const rootRow={user_id:owner,key_id:c.keyId,generation:1,
    envelope:JSON.stringify({v:1,alg:'A256GCM',kid:c.keyId,
      iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(64)})};
  const row={
    $id:c.rowId,user_id:owner,collection:'tasks',key_id:c.keyId,
    key_generation:1,policy_version:2,revision:c.revision,
    envelope:JSON.stringify(record.envelope),routing_json:JSON.stringify(record.routing),
    deleted:false,
  };
  const payload={operation:'get',rowId:c.rowId,collection:'tasks',
    expectedKeyId:c.keyId,expectedGeneration:1};
  const db=makeMockDb();
  db.getRow.mockImplementation(async(args:{tableId:string;rowId:string})=>{
    if(args.tableId==='account_crypto_roots_v2'&&args.rowId===rootId)return rootRow;
    if(args.tableId==='private_owner_ciphertexts_v2'&&args.rowId===c.rowId)return row;
    throw Object.assign(new Error('not found'),{code:404});
  });
  return {db,payload,c,record,root,doc,row,rootRow};
}
describe('UNWIRED owner v2 Function ciphertext-only GET contract',()=>{
  beforeEach(()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',SCRATCH_OWNER_V2_PROJECT);
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS',owner);
    verified.mockClear();
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('returns exact owner ciphertext independently decryptable with correct root',async()=>{
    const {db,payload,record,root,c,doc}=await fixture();
    const result=await handleProspectiveOwnerV2Get(db,owner,payload,'jwt',verified);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ok:true,record});
    expect(await openV2PrivateOwnerDocument(root,
      {projectId:c.projectId,ownerId:owner},c,'tasks',result.body.record)).toEqual(doc);
    const text=JSON.stringify(result);
    for(const secret of [doc.id,doc.title,doc.date,doc.reminderTime,
      '"visibility"'])expect(text).not.toContain(secret);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('never reads row without exact Scratch, allowlist, required verifier and root generation',async()=>{
    const f=await fixture();
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ENABLED','false');
    expect((await handleProspectiveOwnerV2Get(f.db,owner,f.payload,'jwt',verified)).status).toBe(404);
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ENABLED','true');
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6ae9599c002ab812f9c3');
    expect((await handleProspectiveOwnerV2Get(f.db,owner,f.payload,'jwt',verified)).status).toBe(404);
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',SCRATCH_OWNER_V2_PROJECT);
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS','other');
    expect((await handleProspectiveOwnerV2Get(f.db,owner,f.payload,'jwt',verified)).status).toBe(403);
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS',owner);
    expect((await handleProspectiveOwnerV2Get(f.db,owner,f.payload,'jwt',
      async()=>false)).status).toBe(401);
    expect((await handleProspectiveOwnerV2Get(f.db,owner,f.payload,'jwt',
      undefined as unknown as typeof verified)).status).toBe(401);
    const wrong={...f.payload,expectedGeneration:2};
    expect((await handleProspectiveOwnerV2Get(f.db,owner,wrong,'jwt',verified)).status).toBe(409);
    expect(f.db.createRow).not.toHaveBeenCalled();
  });
  it('denies selectors for other domains or public fields before any row query',async()=>{
    const f=await fixture();
    f.db.getRow.mockClear();
    const invalid=[
      {...f.payload,collection:'messages'},
      {...f.payload,rowId:'plain_legacy_id'},
      {...f.payload,expectedKeyId:'bad'},
      {...f.payload,expectedGeneration:0},
      {...f.payload,operation:'list'},
      {...f.payload,title:'plaintext'},
    ];
    for(const q of invalid)
      expect((await handleProspectiveOwnerV2Get(f.db,owner,q,'jwt',verified)).status).toBe(400);
    expect(f.db.getRow).not.toHaveBeenCalled();
  });
  it('rejects foreign owner, v1 row, corrupt routing/ciphertext and unknown key generation',async()=>{
    const f=await fixture();
    const variants=[
      {...f.row,user_id:'other'},
      {...f.row,policy_version:1},
      {...f.row,key_generation:2},
      {...f.row,routing_json:JSON.stringify({...f.record.routing,date:'2043-01-11'})},
      {...f.row,routing_json:'bad'},
      {...f.row,envelope:'not an envelope'},
      {...f.row,deleted:true},
      {...f.row,revision:generateRevision()},
    ];
    const original=f.db.getRow.getMockImplementation();
    for(const v of variants){
      f.db.getRow.mockImplementation(async(args:{tableId:string})=>
        args.tableId==='private_owner_ciphertexts_v2'?v:original(args));
      const result=await handleProspectiveOwnerV2Get(f.db,owner,f.payload,'jwt',verified);
      expect(result.status).toBe(v.user_id==='other'?404:409);
    }
    expect(f.db.createRow).not.toHaveBeenCalled();
  });
});
