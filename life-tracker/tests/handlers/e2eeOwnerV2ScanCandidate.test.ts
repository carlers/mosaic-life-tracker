import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {
  generateAccountRoot,generateKeyId,generateRevision,generateOpaqueRowId,
} from '../../src/lib/e2ee/coreCrypto';
import {
  sealV2PrivateOwnerDocument,SCRATCH_OWNER_V2_PROJECT,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
const require=createRequire(import.meta.url);
const {handleProspectiveOwnerV2Scan}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-candidate.js'
) as {handleProspectiveOwnerV2Scan:(...args:unknown[])=>Promise<{
  status:number;body:Record<string,unknown>;
}>};
const crypto=require('node:crypto') as typeof import('node:crypto');
const OWNER='synthetic_scan_owner';
const ROOT_ID='kr_'+crypto.createHash('sha256')
  .update('mosaic-e2ee-owner-v2|'+OWNER).digest('hex').slice(0,32);
const at='2026-11-28T07:45:00.000Z';
const verify=vi.fn(async(_id:string,_jwt:string)=>true);
async function fixture(){
  const scope={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:OWNER};
  const root=generateAccountRoot(),keyId=generateKeyId();
  const rows=[];
  for(let i=0;i<2;i++){
    const rowId=generateOpaqueRowId();
    const record=await sealV2PrivateOwnerDocument(root,scope,{
      ...scope,rowId,keyId,revision:generateRevision(),payloadDomain:'task',
    },'tasks',{
      id:'hidden_original_'+i,userId:OWNER,isDeleted:false,
      title:'SYNTHETIC_PRIVATE_TASK_'+i,visibility:'private',
      date:'2045-07-08',createdAt:at,updatedAt:at,
    });
    rows.push({
      $id:rowId,$permissions:['read("user:'+OWNER+'")'],
      user_id:OWNER,collection:'tasks',key_id:keyId,key_generation:1,
      policy_version:2,revision:record.envelope.revision,
      envelope:JSON.stringify(record.envelope),
      routing_json:JSON.stringify(record.routing),
      op_id:'o_'+'a'.repeat(32),created_at:at,updated_at:at,
      deleted:false,
    });
  }
  rows.sort((a,b)=>a.$id.localeCompare(b.$id));
  let generation=1;
  const getRow=vi.fn(async(args:{tableId:string;rowId:string})=>{
    if(args.tableId==='account_crypto_roots_v2'&&args.rowId===ROOT_ID)
      return {$id:ROOT_ID,$permissions:['read("user:'+OWNER+'")'],
        user_id:OWNER,key_id:keyId,generation,
        envelope:JSON.stringify({v:1,alg:'A256GCM',kid:keyId,
          iv:'A'.repeat(16),ct:'A'.repeat(64)})};
    const row=rows.find(x=>x.$id===args.rowId);
    if(args.tableId==='private_owner_ciphertexts_v2'&&row)
      return structuredClone(row);
    throw Object.assign(Error('missing'),{code:404});
  });
  const listRows=vi.fn(async(_args:{databaseId:string;tableId:string;queries:unknown[]})=>({rows:structuredClone(rows)}));
  const db={getRow,listRows};
  const req={operation:'scan',collection:'tasks',expectedKeyId:keyId,
    expectedGeneration:1,limit:2,cursor:null as string|null};
  return {db,rows,req,setGeneration:(n:number)=>{generation=n;}};
}
beforeEach(()=>{
  vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',SCRATCH_OWNER_V2_PROJECT);
  vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ENABLED','true');
  vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS',OWNER);
  verify.mockReset().mockResolvedValue(true);
});
afterEach(()=>vi.unstubAllEnvs());
describe('unwired owner-v2 bounded ciphertext-only scan candidate',()=>{
  it('returns only private ciphertext with opaque cursor, never a migration ACK',async()=>{
    const f=await fixture();
    const result=await handleProspectiveOwnerV2Scan(
      f.db,OWNER,f.req,'synthetic-jwt',verify);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok:true,complete:false,nextCursor:f.rows[1].$id,
    });
    expect(result.body.rows).toHaveLength(2);
    const output=JSON.stringify(result.body);
    for(const secret of [
      'SYNTHETIC_PRIVATE_TASK','hidden_original_','2045-07-08','"visibility"',
    ])expect(output).not.toContain(secret);
    expect(f.db.getRow).toHaveBeenCalledTimes(2);
    expect(f.db.listRows).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledTimes(2);
    expect(f.db.listRows.mock.calls[0][0]).toMatchObject({
      databaseId:'life_tracker',tableId:'private_owner_ciphertexts_v2',
    });
    expect(f.db.listRows.mock.calls[0][0].queries).toHaveLength(4);
  });
  it('validates supplied cursor ownership before ordering any page',async()=>{
    const f=await fixture();
    f.db.listRows.mockResolvedValueOnce({rows:[structuredClone(f.rows[1])]});
    const result=await handleProspectiveOwnerV2Scan(
      f.db,OWNER,{...f.req,cursor:f.rows[0].$id},'jwt',verify);
    expect(result).toMatchObject({status:200,body:{
      complete:false,nextCursor:null,
    }});
    expect(f.db.listRows.mock.calls[0][0].queries).toHaveLength(5);
    f.db.listRows.mockClear();
    f.rows[0].user_id='foreign_owner';
    expect((await handleProspectiveOwnerV2Scan(f.db,OWNER,{
      ...f.req,cursor:f.rows[0].$id,
    },'jwt',verify)).status).toBe(409);
    expect(f.db.listRows).not.toHaveBeenCalled();
  });
  it('refuses wrong project, missing session, malformed selector and unknown collection',async()=>{
    const f=await fixture();
    const bad=[
      {...f.req,limit:0},{...f.req,limit:26},
      {...f.req,operation:'put'},{...f.req,collection:'messages'},
      {...f.req,cursor:'other_owner_cursor'},{...f.req,untrusted:'value'},
      {...f.req,expectedGeneration:2.5},
    ];
    for(const q of bad)expect((await handleProspectiveOwnerV2Scan(
      f.db,OWNER,q,'jwt',verify)).status).toBe(400);
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6ae9599c002ab812f9c3');
    expect((await handleProspectiveOwnerV2Scan(
      f.db,OWNER,f.req,'jwt',verify)).status).toBe(404);
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',SCRATCH_OWNER_V2_PROJECT);
    verify.mockResolvedValue(false);
    expect((await handleProspectiveOwnerV2Scan(
      f.db,OWNER,f.req,'jwt',verify)).status).toBe(401);
    expect(f.db.listRows).not.toHaveBeenCalled();
  });
  it('never emits forged rows, plaintext schema columns or reordered pages',async()=>{
    const f=await fixture();
    const row=f.rows[0];
    const corrupt=[
      {...row,user_id:'foreign'},
      {...row,$permissions:['read("any")']},
      {...row,key_generation:2},
      {...row,policy_version:1},
      {...row,deleted:true},
      {...row,plaintext_title:'PRIVATE'},
      {...row,updated_at:'not-date'},
      {...row,envelope:'{}'},
      {...row,routing_json:JSON.stringify({
        userId:OWNER,isDeleted:false,date:'PRIVATE_DAY',
      })},
      {...row,$id:'local_plaintext_id'},
    ];
    for(const mutation of corrupt){
      f.db.listRows.mockResolvedValueOnce({rows:[mutation]});
      const result=await handleProspectiveOwnerV2Scan(
        f.db,OWNER,{...f.req,limit:1},'jwt',verify);
      expect(result).toEqual({status:409,body:{
        error:'Encrypted owner operation unavailable',
      }});
    }
    for(const page of [
      [f.rows[1],f.rows[0]],[f.rows[0],f.rows[0]],
    ]){
      f.db.listRows.mockResolvedValueOnce({rows:page});
      expect((await handleProspectiveOwnerV2Scan(
        f.db,OWNER,f.req,'jwt',verify)).status).toBe(409);
    }
    f.db.listRows.mockResolvedValueOnce({rows:[f.rows[0],f.rows[1]]});
    expect((await handleProspectiveOwnerV2Scan(
      f.db,OWNER,{...f.req,limit:1},'jwt',verify)).status).toBe(409);
  });
  it('fails closed on root epoch rotation during list even when rows validate',async()=>{
    const f=await fixture();
    f.db.listRows.mockImplementationOnce(async()=>{
      f.setGeneration(2);
      return {rows:[f.rows[0]]};
    });
    const result=await handleProspectiveOwnerV2Scan(
      f.db,OWNER,{...f.req,limit:1},'jwt',verify);
    expect(result).toEqual({status:409,body:{
      error:'Encrypted owner operation unavailable',
    }});
  });
});
