import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {makeMockDb,type MockDb} from '../helpers/invoke-handler';
import {
  generateAccountRoot,generateKeyId,generateRevision,generateOpaqueRowId,
} from '../../src/lib/e2ee/coreCrypto';
import {
  sealV2PrivateOwnerDocument,SCRATCH_OWNER_V2_PROJECT,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
const require=createRequire(import.meta.url);
const {handleProspectiveOwnerV2Put}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-candidate.js'
) as {handleProspectiveOwnerV2Put:(db:MockDb,ownerId:string,payload:unknown,
  jwt:string,verify:(id:string,jwt:string)=>Promise<boolean>)=>Promise<{
    status:number;body:Record<string,unknown>;
  }>};
const owner='synthetic_owner';
const rootId='kr_'+require('node:crypto').createHash('sha256')
  .update('mosaic-e2ee-owner-v2|'+owner).digest('hex').slice(0,32);
const doc={
  id:'private-local-id',userId:owner,isDeleted:false,title:'SECRET_TITLE',
  date:'2044-02-03',reminderTime:'14:37',visibility:'private',
  createdAt:'2026-11-26T02:00:00Z',updatedAt:'2026-11-26T02:00:00Z',
};
const verify=vi.fn(async()=>true);
async function candidate(){
  const root=generateAccountRoot(),c={
    projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:owner,
    payloadDomain:'task' as const,rowId:generateOpaqueRowId(),
    keyId:generateKeyId(),revision:generateRevision(),
  };
  const record=await sealV2PrivateOwnerDocument(root,
    {projectId:c.projectId,ownerId:owner},c,'tasks',doc);
  const payload={operation:'put',record,opId:'o_'+'a'.repeat(32),
    expectedRevision:null,expectedGeneration:1};
  const storedRoot={user_id:owner,key_id:c.keyId,generation:1,envelope:JSON.stringify({
    v:1,alg:'A256GCM',kid:c.keyId,iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(64),
  })};
  return {c,record,payload,storedRoot};
}
function setupDb(storedRoot:unknown):MockDb{
  const db=makeMockDb();
  db.getRow.mockImplementation(async(args:{tableId:string,rowId:string})=>{
    if(args.tableId==='account_crypto_roots_v2'&&args.rowId===rootId)
      return storedRoot;
    throw Object.assign(new Error('not found'),{code:404});
  });
  return db;
}
describe('Scratch-only V2 prospective writer, not dispatched',()=>{
  beforeEach(()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',SCRATCH_OWNER_V2_PROJECT);
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS',owner);
    verify.mockClear();
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('fails closed unless project, opt-in, allowlist and completed MFA all match',async()=>{
    const {payload,storedRoot}=await candidate(),db=setupDb(storedRoot);
    for(const [name,val,code] of [
      ['MOSAIC_E2EE_OWNER_V2_ENABLED','false',404],
      ['APPWRITE_FUNCTION_PROJECT_ID','6ae9599c002ab812f9c3',404],
      ['MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS','other',403],
    ] as const){
      vi.stubEnv(name,val);
      expect((await handleProspectiveOwnerV2Put(db,owner,payload,'jwt',verify)).status).toBe(code);
      vi.stubEnv(name,name==='MOSAIC_E2EE_OWNER_V2_ENABLED'?'true':
        name==='APPWRITE_FUNCTION_PROJECT_ID'?SCRATCH_OWNER_V2_PROJECT:owner);
    }
    expect((await handleProspectiveOwnerV2Put(db,owner,payload,'jwt',
      async()=>false)).status).toBe(401);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('creates only authenticated v2 ciphertext and owner read ACL, no public date/visibility',async()=>{
    const {payload,storedRoot,record}=await candidate(),db=setupDb(storedRoot);
    const out=await handleProspectiveOwnerV2Put(db,owner,payload,'jwt',verify);
    expect(out).toMatchObject({status:200,body:{status:'created'}});
    expect(verify).toHaveBeenCalledWith(owner,'jwt');
    const written=db.createRow.mock.calls[0][0];
    expect(written.tableId).toBe('private_owner_ciphertexts_v2');
    expect(written.rowId).toBe(record.rowId);
    expect(written.permissions).toEqual(['read("user:synthetic_owner")']);
    expect(written.data).toMatchObject({
      policy_version:2,key_generation:1,
      collection:'tasks',key_id:record.envelope.kid,
      deleted:false,
    });
    const json=JSON.stringify(written);
    for(const secret of [doc.title,doc.id,doc.date,doc.reminderTime,
      '"visibility"'])expect(json).not.toContain(secret);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('denies tampered metadata, public/social, spoofed owner, malformed generations before any write',async()=>{
    const {payload,storedRoot,record}=await candidate(),db=setupDb(storedRoot);
    const variants=[
      {...payload,record:{...record,routing:{...record.routing,date:'2044-02-03'}}},
      {...payload,record:{...record,routing:{...record.routing,visibility:'private'}}},
      {...payload,record:{...record,published:{content:'public'}}},
      {...payload,record:{...record,schemaVersion:1}},
      {...payload,record:{...record,collection:'messages',domain:'chat-message'}},
      {...payload,record:{...record,ownerId:'other'}},
      {...payload,record:{...record,projectId:'6ae94a2100014d01f5ed'}},
      {...payload,expectedGeneration:0},
      {...payload,expectedRevision:'not-a-revision'},
      {...payload,operation:'list'},
      {...payload,unrecognized:'secret'},
    ];
    for(const variant of variants){
      const actual=await handleProspectiveOwnerV2Put(db,owner,variant,'jwt',verify);
      expect(actual.status).toBe(400);
    }
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('denies wrong registered root epoch/key before create or mutation',async()=>{
    const {payload,storedRoot}=await candidate();
    for(const mismatched of [
      {...storedRoot,generation:2},
      {...storedRoot,key_id:'k_'+'f'.repeat(32)},
      {...storedRoot,user_id:'different'},
      {...storedRoot,envelope:'malformed'},
    ]){
      const db=setupDb(mismatched);
      expect((await handleProspectiveOwnerV2Put(db,owner,payload,'jwt',verify)).status).toBe(409);
      expect(db.createRow).not.toHaveBeenCalled();
    }
  });
  it('allows exact retry but not conflicting create, and updates only CAS-matching generation',async()=>{
    const {payload,storedRoot,record}=await candidate(),db=setupDb(storedRoot);
    const stored={
      $id:record.rowId,user_id:owner,collection:'tasks',
      key_id:record.envelope.kid,key_generation:1,policy_version:2,
      revision:record.envelope.revision,op_id:payload.opId,
      envelope:JSON.stringify(record.envelope),routing_json:JSON.stringify(record.routing),
    };
    db.createRow.mockRejectedValue(Object.assign(new Error('Conflict'),{code:409}));
    const get=db.getRow.getMockImplementation();
    db.getRow.mockImplementation(async(args:{tableId:string,rowId:string})=>
      args.tableId==='private_owner_ciphertexts_v2'?stored:get(args));
    expect((await handleProspectiveOwnerV2Put(db,owner,payload,'jwt',verify)).body)
      .toMatchObject({status:'duplicate'});
    const revision=generateRevision();
    const update={...payload,expectedRevision:record.envelope.revision,
      opId:'o_'+'b'.repeat(32),
      record:{...record,envelope:{...record.envelope,revision}}};
    db.updateRows.mockResolvedValue({total:1});
    expect((await handleProspectiveOwnerV2Put(db,owner,update,'jwt',verify)).body)
      .toMatchObject({status:'updated',revision});
    const query=db.updateRows.mock.calls[0][0].queries;
    expect(query).toContainEqual({op:'equal',key:'revision',value:record.envelope.revision});
    expect(query).toContainEqual({op:'equal',key:'key_generation',value:1});
    expect(query).toContainEqual({op:'equal',key:'policy_version',value:2});
    expect(query).toContainEqual({op:'equal',key:'user_id',value:owner});
    db.updateRows.mockResolvedValue({total:0});
    expect((await handleProspectiveOwnerV2Put(db,owner,update,'jwt',verify)).status).toBe(409);
    db.getRow.mockImplementation(async(args:{tableId:string,rowId:string})=>
      args.tableId==='private_owner_ciphertexts_v2'?{...stored,user_id:'foreign'}:get(args));
    expect((await handleProspectiveOwnerV2Put(db,owner,update,'jwt',verify)).status).toBe(404);
  });
});
