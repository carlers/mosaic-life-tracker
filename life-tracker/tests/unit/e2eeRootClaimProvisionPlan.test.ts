import {describe,expect,it,vi} from 'vitest';
import {
  planScratchRootClaimSchema,planScratchV2WithRootClaim,
} from '../../scripts/e2ee-root-claim-provision-plan.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {SCRATCH_OWNER_ROOT_EPOCH_CLAIMS:claim}=require(
  '../../appwrite-functions/message-action/e2ee-root-epoch-claim-schema.js');
const {OWNER_PRIVATE_V2_SCRATCH_TABLE:ownerV2}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-schema.js');
const PROJECT='6b00671500279e901846';
const table=(id:string,enabled=true)=>({
  $id:id,rowSecurity:true,enabled,$permissions:[],
});
const ready=(schema:typeof claim,enabled=false)=>({
  ...table(schema.id,enabled),
  columns:schema.columns.map((c:Record<string,unknown>)=>({...c,status:'available'})),
  indexes:schema.indexes.map((i:Record<string,unknown>)=>({...i,status:'available'})),
});
function fakeReader(existing:unknown=null,v2:unknown=null){
  return vi.fn(async(method:string,path:string)=>{
    if(method!=='GET')throw Error('Unexpected backend mutation');
    const id=path.split('/').at(-1);
    if(!path.startsWith('/tablesdb/life_tracker/tables/'))throw Error('Wrong DB');
    if(id===claim.id){
      if(existing===null)throw Object.assign(Error('missing'),{code:404});
      return existing;
    }
    if(id===ownerV2.id){
      if(v2===null)throw Object.assign(Error('missing'),{code:404});
      return v2;
    }
    if(['account_crypto_roots_v2','private_owner_ciphertexts_v1'].includes(id??''))
      return table(id!);
    throw Error('Unexpected target');
  });
}
describe('unwired isolated Scratch root-claim GET-only provisioning plan',()=>{
  it('proposes only disabled root-claim schema and no mutation of preserved v1/root tables',async()=>{
    const request=fakeReader();
    const plan=await planScratchRootClaimSchema({projectId:PROJECT,request});
    expect(plan).toMatchObject({
      projectId:PROJECT,tableId:'owner_root_epoch_claims_v2',
      observed:'ABSENT',status:'REVIEW_REQUIRED_NOT_APPLIED',
      enabled:false,writes:0,
    });
    expect(plan.operations).toHaveLength(10); // table + 8 columns + index
    expect(plan.operations[0]).toEqual({
      action:'create_table',tableId:claim.id,name:claim.name,
      enabled:false,rowSecurity:true,permissions:[],
    });
    expect(plan.operations.filter((x:{action:string})=>x.action==='create_column'))
      .toHaveLength(8);
    expect(plan.operations.at(-1)?.action).toBe('create_index');
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
    expect(Object.isFrozen(plan.operations)).toBe(true);
  });
  it('returns zero actions for exact fully-provisioned but DISABLED claim table',async()=>{
    const request=fakeReader(ready(claim));
    const plan=await planScratchRootClaimSchema({projectId:PROJECT,request});
    expect(plan).toMatchObject({
      observed:'EXISTING_DISABLED',status:'SCHEMA_MATCHES_DISABLED_NOT_READY',
      operations:[],enabled:false,writes:0,
    });
  });
  it('only proposes missing fields for compatible partial disabled schema',async()=>{
    const partial=ready(claim);
    partial.columns=partial.columns.slice(0,3);
    partial.indexes=[];
    const plan=await planScratchRootClaimSchema({
      projectId:PROJECT,request:fakeReader(partial),
    });
    expect(plan.operations).toHaveLength(6);
    expect(plan.operations[0].action).toBe('create_column');
    expect(plan.operations.at(-1)?.action).toBe('create_index');
  });
  it('refuses Preview/Production and missing baseline BEFORE considering claim table',async()=>{
    const request=fakeReader();
    for(const wrong of ['6ae94a2100014d01f5ed',
      '6ae9599c002ab812f9c3','garbage']){
      await expect(planScratchRootClaimSchema({
        projectId:wrong,request,
      })).rejects.toThrow('blocked');
    }
    expect(request).not.toHaveBeenCalled();
    const missing=vi.fn(async(method:string,path:string)=>{
      if(path.endsWith('account_crypto_roots_v2'))
        throw Object.assign(Error('not found'),{code:404});
      return table(path.split('/').at(-1)!);
    });
    await expect(planScratchRootClaimSchema({
      projectId:PROJECT,request:missing,
    })).rejects.toThrow('blocked');
  });
  it('rejects an enabled claim table, broad ACL, malicious extras or still-building index',async()=>{
    const valid=ready(claim);
    const variants=[
      {...valid,enabled:true},
      {...valid,rowSecurity:false},
      {...valid,$permissions:['create("users")']},
      {...valid,columns:[...valid.columns,
        {key:'plaintext_root',type:'varchar',size:255,required:false}]},
      {...valid,columns:[...valid.columns,valid.columns[0]]},
      {...valid,columns:valid.columns.map((c:Record<string,unknown>)=>
        c.key==='after_envelope_sha256'?{...c,size:40}:c)},
      {...valid,indexes:valid.indexes.map((i:Record<string,unknown>)=>({
        ...i,status:'processing',
      }))},
      {...valid,indexes:[{key:'unsafe_index',type:'key',attributes:['owner_id']}]},
    ];
    for(const value of variants){
      const request=fakeReader(value);
      await expect(planScratchRootClaimSchema({
        projectId:PROJECT,request,
      })).rejects.toThrow('blocked');
      expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
    }
  });
  it('packages both reviewed v2 table plans into one read-only operation set',async()=>{
    const request=fakeReader();
    const plan=await planScratchV2WithRootClaim({projectId:PROJECT,request});
    expect(plan).toMatchObject({
      projectId:PROJECT,
      status:'TWO_SCHEMAS_REVIEW_ONLY_NOT_RUNTIME_READY',
      writes:0,
    });
    expect(plan.operations).toHaveLength(24);
    expect(plan.ownerV2.operations).toHaveLength(14);
    expect(plan.rootClaim.operations).toHaveLength(10);
    expect(plan.operations[0].tableId).toBe(ownerV2.id);
    expect(plan.operations[14].tableId).toBe(claim.id);
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
    expect(request).toHaveBeenCalledTimes(6);
  });
});
