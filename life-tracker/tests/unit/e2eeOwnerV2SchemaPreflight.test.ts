import {describe,expect,it,vi} from 'vitest';
import {inspectOwnerV2ScratchSchema} from '../../scripts/e2ee-owner-v2-preflight.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {OWNER_PRIVATE_V2_SCRATCH_TABLE:expected}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-schema.js');
const id='6b00671500279e901846';
function secure($id:string){
  return {$id,rowSecurity:true,enabled:true,$permissions:[]};
}
const v2=()=>({...secure(expected.id),
  columns:expected.columns.map((x:Record<string,unknown>)=>({...x})),
  indexes:expected.indexes.map((x:Record<string,unknown>)=>({...x})),
});
function mockRead(table:unknown=v2()){
  return vi.fn(async(method:string,path:string)=>{
    if(method!=='GET')throw new Error('Unexpected mutation');
    const name=path.split('/').at(-1);
    if(name===expected.id){
      if(table==='404')throw Object.assign(new Error('not found'),{status:404});
      return table;
    }
    if(['account_crypto_roots_v2','private_owner_ciphertexts_v1'].includes(name??''))
      return secure(name as string);
    throw new Error('Unexpected path');
  });
}
describe('Prospective Scratch owner v2 schema read-only preflight',()=>{
  it('requires exact isolated project and never queries other environments',async()=>{
    const request=mockRead();
    for(const wrong of ['6ae94a2100014d01f5ed','6ae9599c002ab812f9c3','unknown'])
      await expect(inspectOwnerV2ScratchSchema({projectId:wrong,request})).rejects.toThrow();
    await expect(inspectOwnerV2ScratchSchema({projectId:id,
      databaseId:'other',request})).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('does not interpret an absent v2 table as ready',async()=>{
    const request=mockRead('404');
    const status=await inspectOwnerV2ScratchSchema({projectId:id,request});
    expect(status).toMatchObject({phase:'MISSING',status:'NOT_PROVISIONED',writes:0});
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
  });
  it('validates existing v1/root and every v2 table/column/index/ACL',async()=>{
    const request=mockRead();
    expect(await inspectOwnerV2ScratchSchema({projectId:id,request}))
      .toMatchObject({phase:'EXISTING',status:'SCHEMA_ACL_VERIFIED',writes:0});
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
  });
  it('refuses partial V2 schema, changed permissions, index drift and missing prior baseline',async()=>{
    const bad=[
      {...v2(),$permissions:['create("users")']},
      {...v2(),rowSecurity:false},
      {...v2(),enabled:false},
      {...v2(),columns:v2().columns.slice(1)},
      {...v2(),columns:v2().columns.map((x:Record<string,unknown>)=>({...x,
        ...(x.key==='key_generation'?{type:'varchar'}:{})}))},
      {...v2(),indexes:[]},
      {...v2(),indexes:[{key:'other',type:'key',attributes:['user_id']}]},
    ];
    for(const table of bad){
      const request=mockRead(table);
      await expect(inspectOwnerV2ScratchSchema({projectId:id,request}))
        .rejects.toThrow('blocked');
      expect(request.mock.calls.every(c=>c[0]==='GET')).toBe(true);
    }
    const missingPrior=vi.fn(async(method:string,path:string)=>{
      if(path.endsWith('/private_owner_ciphertexts_v1'))
        throw Object.assign(new Error('not found'),{status:404});
      return v2();
    });
    await expect(inspectOwnerV2ScratchSchema({projectId:id,request:missingPrior}))
      .rejects.toThrow('blocked');
  });
});
