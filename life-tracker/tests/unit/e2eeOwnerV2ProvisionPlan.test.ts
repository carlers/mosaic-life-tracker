import {describe,expect,it,vi} from 'vitest';
import {planScratchOwnerV2Schema} from '../../scripts/e2ee-owner-v2-provision-plan.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {OWNER_PRIVATE_V2_SCRATCH_TABLE:expected}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-schema.js');
const PROJECT='6b00671500279e901846';
const base=id=>({$id:id,rowSecurity:true,enabled:true,$permissions:[]});
const full=()=>({...base(expected.id),
  columns:expected.columns.map((c:Record<string,unknown>)=>({...c,status:'available'})),
  indexes:expected.indexes.map((i:Record<string,unknown>)=>({...i,status:'available'})),
});
function reads(v2:unknown){
  return vi.fn(async(method:string,path:string)=>{
    if(method!=='GET')throw Error('Unexpected mutation');
    const name=path.split('/').at(-1);
    if(name===expected.id){
      if(v2===null)throw Object.assign(new Error('not found'),{status:404});
      return v2;
    }
    if(['private_owner_ciphertexts_v1','account_crypto_roots_v2'].includes(name??''))
      return base(name);
    throw Error('Unexpected backend target');
  });
}
describe('unwired E2EE Scratch v2 schema planning cannot make remote writes',()=>{
  it('only reads exact Scratch project and returns full 14-step additive proposal',async()=>{
    const request=reads(null);
    const planned=await planScratchOwnerV2Schema({projectId:PROJECT,request});
    expect(planned).toMatchObject({observed:'ABSENT',
      state:'REVIEW_REQUIRED_NOT_APPLIED',writes:0,projectId:PROJECT});
    expect(planned.operations).toHaveLength(14);
    expect(planned.operations[0]).toEqual({
      action:'create_table',tableId:expected.id,name:expected.name,
      rowSecurity:true,enabled:true,permissions:[],
    });
    expect(planned.operations.filter((x:{action:string})=>x.action==='create_column'))
      .toHaveLength(12);
    expect(planned.operations.at(-1)?.action).toBe('create_index');
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
    expect(Object.isFrozen(planned.operations)).toBe(true);
  });
  it('returns no operations for an exact fully populated secure table',async()=>{
    const request=reads(full());
    const planned=await planScratchOwnerV2Schema({projectId:PROJECT,request});
    expect(planned).toMatchObject({observed:'EXISTING',
      state:'SCHEMA_MATCHES_READ_ONLY',operations:[],writes:0});
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
  });
  it('resumes only missing reviewed fields in a compatible partial schema',async()=>{
    const partial=full();
    partial.columns=partial.columns.slice(0,5);
    partial.indexes=[];
    const request=reads(partial);
    const planned=await planScratchOwnerV2Schema({projectId:PROJECT,request});
    expect(planned.operations).toHaveLength(8);
    expect(planned.operations[0].action).toBe('create_column');
    expect(planned.operations.at(-1)?.action).toBe('create_index');
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
  });
  it('refuses wrong project, public v2 ACL, extra or malformed schema',async()=>{
    const request=reads(null);
    for(const projectId of [
      '6ae94a2100014d01f5ed','6ae9599c002ab812f9c3','other',
    ]){
      await expect(planScratchOwnerV2Schema({projectId,request})).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
    const corrupt=full();
    const variants=[
      {...corrupt,$permissions:['read("any")']},
      {...corrupt,rowSecurity:false},
      {...corrupt,columns:[...corrupt.columns,{key:'plaintext_title',type:'varchar',size:200,required:true}]},
      {...corrupt,columns:corrupt.columns.map((c:Record<string,unknown>)=>
        c.key==='envelope'?{...c,type:'varchar'}:c)},
      {...corrupt,columns:corrupt.columns.map((c:Record<string,unknown>)=>
        c.key==='envelope'?{...c,status:'processing'}:c)},
      {...corrupt,indexes:[{key:'foreign',type:'key',attributes:['user_id']}]},
      {...corrupt,indexes:[...corrupt.indexes,corrupt.indexes[0]]},
    ];
    for(const v2 of variants){
      const req=reads(v2);
      await expect(planScratchOwnerV2Schema({
        projectId:PROJECT,request:req,
      })).rejects.toThrow('denied');
      expect(req.mock.calls.every(c=>c[0]==='GET')).toBe(true);
    }
  });
  it('refuses a missing v1/root secure baseline',async()=>{
    const req=vi.fn(async(method:string,path:string)=>{
      if(path.endsWith('/account_crypto_roots_v2'))
        throw Object.assign(new Error('not found'),{status:404});
      return full();
    });
    await expect(planScratchOwnerV2Schema({
      projectId:PROJECT,request:req,
    })).rejects.toThrow('denied');
    expect(req.mock.calls.every(c=>c[0]==='GET')).toBe(true);
  });
});
