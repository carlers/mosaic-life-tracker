import {describe,expect,it,vi} from 'vitest';
import {checkScratchRootEpochRaceModel} from '../../scripts/e2ee-root-epoch-race-contract.mjs';
const PROJECT='6b00671500279e901846',OWNER='synthetic_disposable_race_owner';
const oldKey='k_'+'a'.repeat(32),oldHash='b'.repeat(64);
const target={
  projectId:PROJECT,ownerId:OWNER,expectedGeneration:4,contenders:20,
};
function fixture(options:{
  doubleWinner?:boolean;indeterminate?:boolean;rootDrift?:boolean;
  wrongCleanup?:boolean;declineFixture?:boolean;
}={}){
  let winner:Record<string,unknown>|null=null;
  const port={
    setup:vi.fn(async()=>({
      projectId:PROJECT,ownerId:OWNER,generation:4,
      keyId:oldKey,oldEnvelopeSha256:oldHash,
      claimAbsent:!options.declineFixture,disposable:true,
    })),
    attempt:vi.fn(async(plan:Record<string,unknown>)=>{
      if(!winner){winner=plan;
        return {status:'committed',operationId:plan.operationId};}
      if(options.indeterminate)throw Error('synthetic network reply lost');
      if(options.doubleWinner)return {
        status:'committed',operationId:plan.operationId,
      };
      throw Object.assign(Error('same unique epoch claim exists'),{code:409});
    }),
    readback:vi.fn(async()=>{
      if(!winner)throw Error('missing');
      return {
        projectId:PROJECT,ownerId:OWNER,rootGeneration:options.rootDrift?4:5,
        rootKeyId:winner.nextKeyId,claimId:winner.claimId,
        claimOperationId:winner.operationId,
        fromGeneration:4,toGeneration:5,
        beforeEnvelopeSha256:oldHash,
        afterEnvelopeSha256:winner.afterEnvelopeSha256,
        claimCount:options.doubleWinner?2:1,
      };
    }),
    cleanup:vi.fn(async()=>options.wrongCleanup?
      {status:'pending',ownerId:OWNER}:{status:'cleared',ownerId:OWNER}),
  };
  return {port};
}
describe('source-only synthetic root-epoch contention contract, never a backend proof',()=>{
  it('tests 20 simultaneous claim collisions and confirms exactly one synthetic winner',async()=>{
    const f=fixture();
    const result=await checkScratchRootEpochRaceModel({...target,port:f.port});
    expect(result).toMatchObject({
      status:'synthetic-port-model-only-not-backend-proof',
      contenders:20,committed:1,conflicts:19,indeterminate:0,generation:5,
    });
    expect(result.claimId).toMatch(/^ec_[a-f0-9]{32}$/);
    expect(f.port.attempt).toHaveBeenCalledTimes(20);
    expect(f.port.readback).toHaveBeenCalledOnce();
    expect(f.port.cleanup).toHaveBeenCalledOnce();
    const plans=f.port.attempt.mock.calls.map(([plan])=>plan);
    expect(new Set(plans.map(p=>p.claimId)).size).toBe(1);
    expect(new Set(plans.map(p=>p.operationId)).size).toBe(20);
    const payload=JSON.stringify(plans);
    expect(payload).not.toContain('rootBytes');
    expect(payload).not.toContain('recoveryKey');
  });
  it('allows bounded 90-contender synthetic adversarial test',async()=>{
    const f=fixture();
    const result=await checkScratchRootEpochRaceModel({
      ...target,contenders:90,port:f.port,
    });
    expect(result).toMatchObject({contenders:90,conflicts:89,committed:1});
  });
  it('rejects two winners or unknown commit receipts without treating cleanup as acceptance',async()=>{
    for(const options of [{doubleWinner:true},{indeterminate:true}]){
      const f=fixture(options);
      await expect(checkScratchRootEpochRaceModel({
        ...target,port:f.port,
      })).rejects.toThrow('no runtime attestation');
      expect(f.port.cleanup).toHaveBeenCalledOnce();
    }
  });
  it('rejects forged postcommit generations and incomplete fixture erasure',async()=>{
    for(const options of [
      {rootDrift:true},{wrongCleanup:true},{declineFixture:true},
    ]){
      const f=fixture(options);
      await expect(checkScratchRootEpochRaceModel({
        ...target,port:f.port,
      })).rejects.toThrow('no runtime attestation');
      expect(f.port.cleanup).toHaveBeenCalledTimes(
        options.declineFixture?0:1);
    }
  });
  it('refuses other Appwrite environments or unbounded attempts before starting',async()=>{
    const f=fixture();
    for(const params of [
      {...target,projectId:'6ae9599c002ab812f9c3'},
      {...target,projectId:'6ae94a2100014d01f5ed'},
      {...target,expectedGeneration:0},
      {...target,contenders:19},
      {...target,contenders:91},
    ]){
      await expect(checkScratchRootEpochRaceModel({
        ...params,port:f.port,
      })).rejects.toThrow();
    }
    expect(f.port.setup).not.toHaveBeenCalled();
    expect(f.port.attempt).not.toHaveBeenCalled();
    expect(f.port.cleanup).not.toHaveBeenCalled();
  });
});
