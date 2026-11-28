import {beforeEach,describe,expect,it,vi} from 'vitest';
import {
  deriveMigratedOwnerRowId,generateAccountRoot,generateKeyId,
  generateOperationId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';
import {
  SCRATCH_OWNER_V2_PROJECT,sealV2PrivateOwnerDocument,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import {rehearseSavedOwnerV2Batch} from '../../src/lib/e2ee/ownerV2BatchRehearsal';

const mocks=vi.hoisted(()=>({list:vi.fn(),read:vi.fn()}));
vi.mock('../../src/lib/e2ee/ownerV2PendingIntentStore',()=>({
  listV2OwnerMigrationIntents:mocks.list,
  readV2OwnerMigrationIntent:mocks.read,
}));
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_batch_owner'};
const gate={assertReady:vi.fn(async()=>{})};
async function fixture(){
  const root=generateAccountRoot(),kid=generateKeyId(),generation=3;
  const plans=[];
  for(const localId of ['synthetic_task_a','synthetic_task_b']){
    const doc={id:localId,userId:owner.ownerId,isDeleted:false,
      title:'SYNTHETIC PRIVATE '+localId,date:'2045-07-08',
      visibility:'private'};
    const rowId=await deriveMigratedOwnerRowId(root,owner,'task',doc.id);
    const record=await sealV2PrivateOwnerDocument(root,owner,{
      ...owner,rowId,keyId:kid,revision:generateRevision(),payloadDomain:'task',
    },'tasks',doc);
    plans.push({projectId:owner.projectId,ownerId:owner.ownerId,
      rowId,collection:'tasks' as const,expectedRevision:null,
      expectedGeneration:generation,opId:generateOperationId(),record});
  }
  const stored=new Map<string,{plan:typeof plans[number]}>(),sent:string[]=[];
  let failAt=0,calls=0;
  const port={
    put:vi.fn(async(input:{operation:string;record:typeof plans[number]['record'];opId:string;
      expectedRevision:null;expectedGeneration:number})=>{
      if(++calls===failAt)throw new Error('synthetic offline interruption');
      const plan=plans.find(p=>p.rowId===input.record.rowId);
      if(!plan||plan.opId!==input.opId)throw Error('unexpected operation');
      const existing=stored.get(plan.rowId);
      if(existing){
        if(JSON.stringify(existing.plan)!==JSON.stringify(plan))
          throw Error('conflicting immutable retry');
        sent.push('duplicate');
        return {status:200,body:{ok:true,status:'duplicate',
          revision:plan.record.envelope.revision}};
      }
      stored.set(plan.rowId,{plan});sent.push('created');
      return {status:200,body:{ok:true,status:'created',
        revision:plan.record.envelope.revision}};
    }),
    get:vi.fn(async(input:{rowId:string;expectedOpId:string;expectedGeneration:number})=>{
      const prior=stored.get(input.rowId)?.plan;
      if(!prior||prior.opId!==input.expectedOpId||
         input.expectedGeneration!==generation)
        return {status:409,body:{error:'missing'}};
      return {status:200,body:{ok:true,record:prior.record,
        opId:prior.opId,keyGeneration:generation}};
    }),
  };
  mocks.list.mockImplementation(async()=>structuredClone(plans));
  mocks.read.mockImplementation(async(_root:unknown,_owner:unknown,rowId:string)=>
    structuredClone(plans.find(p=>p.rowId===rowId)??null));
  return {root,kid,generation,plans,port,stored,sent,failOn:(nth:number)=>{
    failAt=nth;calls=0;
  }};
}
beforeEach(()=>{
  mocks.list.mockReset();mocks.read.mockReset();gate.assertReady.mockReset();
  gate.assertReady.mockResolvedValue(undefined);
});

describe('dormant E2EE full owner-batch replay is NOT remote migration or queue acknowledgment',()=>{
  it('verifies all ciphertext row readbacks then retries EXACT identical operations',async()=>{
    const f=await fixture();
    const result=await rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate);
    expect(result).toEqual({
      status:'synthetic-port-readbacks-not-acknowledged',
      rows:2,created:2,duplicates:0,
    });
    const second=await rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate);
    expect(second).toMatchObject({rows:2,created:0,duplicates:2});
    expect(f.stored.size).toBe(2);
    expect(f.sent).toEqual(['created','created','duplicate','duplicate']);
    expect(f.port.put.mock.calls.map(([payload])=>payload.opId))
      .toEqual([...f.port.put.mock.calls.slice(0,2).map(([p])=>p.opId),
        ...f.port.put.mock.calls.slice(0,2).map(([p])=>p.opId)]);
    expect(mocks.list).toHaveBeenCalledTimes(4);
  });
  it('preserves every original ciphertext intent when a later remote attempt fails',async()=>{
    const f=await fixture(),before=JSON.stringify(f.plans);
    f.failOn(2);
    await expect(rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate)).rejects.toThrow('retained');
    expect(JSON.stringify(f.plans)).toBe(before);
    expect(f.stored.size).toBe(1); // partial remote success is not a batch ACK
    f.failOn(0);
    const retry=await rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate);
    expect(retry).toMatchObject({rows:2,created:1,duplicates:1});
    expect(f.stored.size).toBe(2);
  });
  it('rejects invalid owner, incorrect generation or duplicated op IDs BEFORE any server calls',async()=>{
    const f=await fixture();
    for(const changed of [
      {...owner,projectId:'6ae9599c002ab812f9c3'},
      {...owner,projectId:'6ae94a2100014d01f5ed'},
    ]){
      await expect(rehearseSavedOwnerV2Batch(
        f.root,changed,f.kid,f.generation,f.port,gate)).rejects.toThrow();
    }
    await expect(rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation+1,f.port,gate)).rejects.toThrow();
    mocks.list.mockResolvedValueOnce([
      f.plans[0],{...f.plans[1],opId:f.plans[0].opId},
    ]);
    await expect(rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate)).rejects.toThrow();
    expect(f.port.put).not.toHaveBeenCalled();
  });
  it('rejects a missing or modified local ciphertext plan and expired MFA',async()=>{
    const f=await fixture();
    mocks.list.mockResolvedValueOnce([]);
    await expect(rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate)).rejects.toThrow();
    mocks.list.mockImplementationOnce(async()=>structuredClone(f.plans))
      .mockImplementationOnce(async()=>structuredClone([
        {...f.plans[0],opId:generateOperationId()},f.plans[1],
      ]));
    await expect(rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate)).rejects.toThrow();
    gate.assertReady.mockRejectedValueOnce(Error('MFA expired'));
    await expect(rehearseSavedOwnerV2Batch(
      f.root,owner,f.kid,f.generation,f.port,gate)).rejects.toThrow();
  });
});
