import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {
  deriveMigratedOwnerRowId,generateAccountRoot,generateKeyId,
  generateOperationId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';
import {
  sealV2PrivateOwnerDocument,openV2PrivateOwnerDocument,
  SCRATCH_OWNER_V2_PROJECT,V2_OWNER_DOMAIN,type OwnerV2Collection,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import {makeMockDb} from '../helpers/invoke-handler';

const require=createRequire(import.meta.url);
const {handleProspectiveOwnerV2Put,handleProspectiveOwnerV2Get}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-candidate.js',
) as {
  handleProspectiveOwnerV2Put:(...args:any[])=>Promise<{status:number;body:any}>;
  handleProspectiveOwnerV2Get:(...args:any[])=>Promise<{status:number;body:any}>;
};
const nodeCrypto=require('node:crypto') as typeof import('node:crypto');
const ownerId='synthetic_eight_domain_owner';
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId};
const rootId='kr_'+nodeCrypto.createHash('sha256')
  .update('mosaic-e2ee-owner-v2|'+ownerId).digest('hex').slice(0,32);
const acl=[`read("user:${ownerId}")`];

const fixtures:ReadonlyArray<{
  collection:OwnerV2Collection;
  secret:string;
  doc:Record<string,unknown>;
}>=([
  ['tasks','PRIVATE-TASK-TITLE',{title:'PRIVATE-TASK-TITLE',date:'2045-02-01',
    visibility:'private',reminderTime:'06:25'}],
  ['categories','PRIVATE-CATEGORY',{name:'PRIVATE-CATEGORY',visibility:'private',
    startedOn:'2045-02-01'}],
  ['diary','PRIVATE-DIARY-CONTENT',{content:'PRIVATE-DIARY-CONTENT',
    visibility:'private',date:'2045-02-01',photos:['private-photo']}],
  ['bucketList','PRIVATE-BUCKET-TITLE',{title:'PRIVATE-BUCKET-TITLE',
    description:'PRIVATE BUCKET DESCRIPTION'}],
  ['bucketTaskLinks','PRIVATE-BUCKET-ID',{bucketListId:'PRIVATE-BUCKET-ID',
    taskId:'PRIVATE-TASK-LINK'}],
  ['settings','PRIVATE-SETTING-VALUE',{key:'private-setting',
    value:'PRIVATE-SETTING-VALUE'}],
  ['activities','PRIVATE-WORKOUT-TITLE',{title:'PRIVATE-WORKOUT-TITLE',
    sport:'PRIVATE SPORT',localDate:'2045-02-01',
    distanceMeters:5000,elapsedSeconds:1200}],
  ['activityTaskLinks','PRIVATE-ACTIVITY-ID',{activityId:'PRIVATE-ACTIVITY-ID',
    taskId:'PRIVATE-TASK-LINK'}],
] as const).map(([collection,secret,attrs])=>({
  collection,secret,doc:{
    id:'legacy_'+collection,userId:ownerId,isDeleted:false,
    ...attrs,
  },
}));

describe('unwired v2 owner Function: synthetic 8-domain ciphertext PUT/GET integration',()=>{
  beforeEach(()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',SCRATCH_OWNER_V2_PROJECT);
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS',ownerId);
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('writes only owner ACL and encrypted data, accepts idempotent retries and reads exact op ID',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    const db=makeMockDb(),saved=new Map<string,any>();
    const rootRow={
      $id:rootId,$permissions:acl,user_id:ownerId,key_id:keyId,
      generation:1,envelope:JSON.stringify({
        v:1,alg:'A256GCM',kid:keyId,iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(64),
      }),
    };
    db.getRow.mockImplementation(async(args:{tableId:string;rowId:string})=>{
      if(args.tableId==='account_crypto_roots_v2'&&args.rowId===rootId)
        return rootRow;
      if(args.tableId==='private_owner_ciphertexts_v2'){
        if(saved.has(args.rowId))return saved.get(args.rowId);
      }
      throw Object.assign(new Error('not found'),{code:404});
    });
    db.createRow.mockImplementation(async(
      args:{tableId:string;rowId:string;data:Record<string,unknown>;permissions:string[]},
    )=>{
      if(args.tableId!=='private_owner_ciphertexts_v2'||
         saved.has(args.rowId))throw Object.assign(new Error('already exists'),{code:409});
      const row={$id:args.rowId,$permissions:args.permissions,...args.data};
      saved.set(args.rowId,row);
      return row;
    });
    const verified=vi.fn(async(id:string)=>id===ownerId);
    for(const {collection,secret,doc} of fixtures){
      const rowId=await deriveMigratedOwnerRowId(
        root,owner,V2_OWNER_DOMAIN[collection],doc.id as string);
      const ctx={...owner,rowId,keyId,revision:generateRevision(),
        payloadDomain:V2_OWNER_DOMAIN[collection]};
      const record=await sealV2PrivateOwnerDocument(
        root,owner,ctx,collection,doc);
      const opId=generateOperationId();
      const put={operation:'put',record,opId,expectedRevision:null,
        expectedGeneration:1};
      const created=await handleProspectiveOwnerV2Put(
        db,ownerId,put,'session-jwt',verified);
      expect(created).toMatchObject({status:200,body:{status:'created'}});
      const duplicate=await handleProspectiveOwnerV2Put(
        db,ownerId,put,'session-jwt',verified);
      expect(duplicate).toMatchObject({status:200,body:{status:'duplicate'}});
      const read=await handleProspectiveOwnerV2Get(
        db,ownerId,{
          operation:'get',rowId,collection,expectedKeyId:keyId,
          expectedGeneration:1,expectedOpId:opId,
        },'session-jwt',verified);
      expect(read).toEqual({status:200,body:{
        ok:true,record,opId,keyGeneration:1,
      }});
      expect(await openV2PrivateOwnerDocument(
        root,owner,ctx,collection,read.body.record)).toEqual(doc);
      expect(saved.get(rowId).$permissions).toEqual(acl);
      for(const plain of [secret,doc.id as string,'2045-02-01','visibility']){
        expect(JSON.stringify(saved.get(rowId))).not.toContain(plain);
      }
      const wrongOp=await handleProspectiveOwnerV2Get(
        db,ownerId,{operation:'get',rowId,collection,expectedKeyId:keyId,
          expectedGeneration:1,expectedOpId:generateOperationId()},
        'session-jwt',verified);
      expect(wrongOp.status).toBe(409);
    }
    expect(saved.size).toBe(8);
    expect(db.createRow).toHaveBeenCalledTimes(16);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
});
