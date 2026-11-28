import {beforeEach,describe,expect,it,vi} from 'vitest';
import {
  deriveMigratedOwnerRowId,generateAccountRoot,generateKeyId,
  generateOperationId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';
import {
  SCRATCH_OWNER_V2_PROJECT,sealV2PrivateOwnerDocument,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import {rehearsePersistedOwnerV2RoundTrip} from '../../src/lib/e2ee/ownerV2TransportRehearsal';
const mocks=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../../src/lib/e2ee/ownerV2PendingIntentStore',()=>({
  readV2OwnerMigrationIntent:mocks.read,
}));
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_port_owner'};
async function fixture(){
  const root=generateAccountRoot(),keyId=generateKeyId();
  const doc={id:'private_task',userId:owner.ownerId,isDeleted:false,
    title:'SECRET',date:'2045-01-01',visibility:'private'};
  const rowId=await deriveMigratedOwnerRowId(root,owner,'task',doc.id);
  const record=await sealV2PrivateOwnerDocument(root,owner,{
    ...owner,rowId,keyId,revision:generateRevision(),payloadDomain:'task',
  },'tasks',doc);
  const plan={projectId:owner.projectId,ownerId:owner.ownerId,
    collection:'tasks' as const,rowId,expectedRevision:null,
    expectedGeneration:3,opId:generateOperationId(),record};
  const port={
    put:vi.fn(async()=>({status:200,body:{ok:true,status:'created',
      revision:record.envelope.revision}})),
    get:vi.fn(async()=>({status:200,body:{ok:true,record,
      opId:plan.opId,keyGeneration:3}})),
  };
  const gate={assertReady:vi.fn(async()=>{})};
  mocks.read.mockResolvedValue(plan);
  return {root,keyId,rowId,record,plan,port,gate};
}
beforeEach(()=>mocks.read.mockReset());

describe('dormant owner-v2 ciphertext transport rehearsal is not an ACK',()=>{
  it('reads the original plan twice and checks complete byte-identical readback',async()=>{
    const f=await fixture();
    const result=await rehearsePersistedOwnerV2RoundTrip(
      f.root,owner,f.rowId,f.keyId,3,f.port,f.gate);
    expect(result).toMatchObject({status:'readback-verified-not-acknowledged',
      rowId:f.rowId,opId:f.plan.opId,putStatus:'created',keyGeneration:3});
    expect(f.port.put).toHaveBeenCalledExactlyOnceWith({
      operation:'put',record:f.record,opId:f.plan.opId,
      expectedRevision:null,expectedGeneration:3,
    });
    expect(f.port.get).toHaveBeenCalledExactlyOnceWith({
      operation:'get',rowId:f.rowId,collection:'tasks',
      expectedKeyId:f.keyId,expectedGeneration:3,
      expectedOpId:f.plan.opId,
    });
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(f.gate.assertReady).toHaveBeenCalledTimes(4);
  });
  it('never sends on invalid owner/project/root/epoch/session or missing saved intent',async()=>{
    const f=await fixture();
    for(const [root,scope,epoch] of [
      [f.root,{...owner,projectId:'6ae9599c002ab812f9c3'},3],
      [new Uint8Array(31),owner,3],
      [f.root,owner,4],
    ] as const){
      await expect(rehearsePersistedOwnerV2RoundTrip(
        root as typeof f.root,scope,f.rowId,f.keyId,epoch,f.port,f.gate))
        .rejects.toThrow();
    }
    mocks.read.mockResolvedValueOnce(null);
    await expect(rehearsePersistedOwnerV2RoundTrip(
      f.root,owner,f.rowId,f.keyId,3,f.port,f.gate)).rejects.toThrow();
    f.gate.assertReady.mockRejectedValueOnce(new Error('MFA expired'));
    await expect(rehearsePersistedOwnerV2RoundTrip(
      f.root,owner,f.rowId,f.keyId,3,f.port,f.gate)).rejects.toThrow();
    expect(f.port.put).not.toHaveBeenCalled();
  });
  it('rejects forged PUT success without treating it as delivery',async()=>{
    const f=await fixture();
    for(const put of [
      {status:409,body:{error:'conflict'}},
      {status:200,body:{ok:true,status:'created',revision:'r_'+'0'.repeat(32)}},
      {status:200,body:{ok:true,status:'created',revision:f.record.envelope.revision,
        plaintext:'LEAK'}},
    ]){
      f.port.put.mockResolvedValueOnce(put);
      await expect(rehearsePersistedOwnerV2RoundTrip(
        f.root,owner,f.rowId,f.keyId,3,f.port,f.gate)).rejects.toThrow();
    }
    expect(f.port.get).not.toHaveBeenCalled();
  });
  it('rejects wrong server operation, ciphertext, epoch or extra response fields',async()=>{
    const f=await fixture();
    const reply=(changes:Record<string,unknown>)=>({
      status:200,body:{ok:true,record:f.record,opId:f.plan.opId,keyGeneration:3,
        ...changes},
    });
    const altered={...f.record,envelope:{
      ...f.record.envelope,ct:'A'===f.record.envelope.ct[0]
        ?'B'+f.record.envelope.ct.slice(1)
        :'A'+f.record.envelope.ct.slice(1),
    }};
    for(const val of [
      reply({opId:'o_'+'f'.repeat(32)}),
      reply({keyGeneration:4}),
      reply({record:altered}),
      reply({plaintext:'LEAK'}),
    ]){
      f.port.get.mockResolvedValueOnce(val);
      await expect(rehearsePersistedOwnerV2RoundTrip(
        f.root,owner,f.rowId,f.keyId,3,f.port,f.gate)).rejects.toThrow();
    }
  });
  it('refuses a changed local encrypted pending plan after remote readback',async()=>{
    const f=await fixture();
    mocks.read.mockResolvedValueOnce(f.plan).mockResolvedValueOnce({
      ...f.plan,opId:generateOperationId(),
    });
    await expect(rehearsePersistedOwnerV2RoundTrip(
      f.root,owner,f.rowId,f.keyId,3,f.port,f.gate)).rejects.toThrow();
  });
});


describe('dormant v2 port callback account context integrity',()=>{
  it('rejects attempts to redirect later IDB reads from an injected MFA callback',async()=>{
    const f=await fixture();
    const gate={assertReady:vi.fn(async (scope:{ownerId:string})=>{
      expect(scope.ownerId).toBe(owner.ownerId);
      expect(Object.isFrozen(scope)).toBe(true);
      expect(Reflect.set(scope,'ownerId','synthetic_other_owner')).toBe(false);
    })};
    const result=await rehearsePersistedOwnerV2RoundTrip(
      f.root,{...owner},f.rowId,f.keyId,3,f.port,gate);
    expect(result.status).toBe('readback-verified-not-acknowledged');
    expect(mocks.read.mock.calls).toHaveLength(2);
    expect(mocks.read.mock.calls.every(([,scope])=>
      scope.ownerId===owner.ownerId)).toBe(true);
    expect(gate.assertReady).toHaveBeenCalledTimes(4);
  });
});
