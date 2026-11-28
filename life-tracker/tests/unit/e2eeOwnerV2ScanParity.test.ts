import {describe,expect,it,vi} from 'vitest';
import {
  generateAccountRoot,generateKeyId,generateRevision,
  generateOperationId,deriveMigratedOwnerRowId,
} from '../../src/lib/e2ee/coreCrypto';
import {
  SCRATCH_OWNER_V2_PROJECT,V2_OWNER_DOMAIN,
  sealV2PrivateOwnerDocument,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import type {PreparedV1ToV2} from '../../src/lib/e2ee/ownerV1ToV2MigrationPlan';
import type {OwnerV2ScanRequest} from '../../src/lib/e2ee/ownerV2ScanPage';
import {rehearsePersistedOwnerV2TwoPassParity}
  from '../../src/lib/e2ee/ownerV2ScanParity';

const {readIntents}=vi.hoisted(()=>({readIntents:vi.fn()}));
vi.mock('../../src/lib/e2ee/ownerV2PendingIntentStore',()=>({
  listV2OwnerMigrationIntents:readIntents,
}));

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_two_pass_owner'};
const stamp='2026-11-28T08:00:00.000Z';
async function fixture(){
  const root=generateAccountRoot(),keyId=generateKeyId();
  const raw=[
    {collection:'tasks' as const,document:{
      id:'private_task_id',userId:owner.ownerId,isDeleted:false,
      title:'DO NOT LEAK TASK',visibility:'private',
      date:'2045-05-06',createdAt:stamp,updatedAt:stamp,
    }},
    {collection:'diary' as const,document:{
      id:'private_diary_id',userId:owner.ownerId,isDeleted:false,
      content:'DO NOT LEAK DIARY',visibility:'private',
      date:'2045-05-06',createdAt:stamp,updatedAt:stamp,
    }},
  ];
  const plans:PreparedV1ToV2[]=[];
  for(const {collection,document} of raw){
    const rowId=await deriveMigratedOwnerRowId(
      root,owner,V2_OWNER_DOMAIN[collection],document.id);
    const record=await sealV2PrivateOwnerDocument(root,owner,{
      ...owner,rowId,keyId,payloadDomain:V2_OWNER_DOMAIN[collection],
      revision:generateRevision(),
    },collection,document);
    plans.push({
      projectId:owner.projectId,ownerId:owner.ownerId,
      rowId,collection,expectedGeneration:1,
      expectedRevision:null,opId:generateOperationId(),record,
    });
  }
  readIntents.mockReset().mockImplementation(async()=>structuredClone(plans));
  const requests:OwnerV2ScanRequest[]=[];
  let scanCounter=0;
  const scan=vi.fn(async(request:OwnerV2ScanRequest)=>{
    requests.push(structuredClone(request));
    scanCounter++;
    const visible=plans.filter(plan=>plan.collection===request.collection)
      .sort((a,b)=>a.rowId.localeCompare(b.rowId))
      .filter(plan=>request.cursor===null||plan.rowId>request.cursor!)
      .slice(0,request.limit).map(plan=>({
        rowId:plan.rowId,record:structuredClone(plan.record),
        opId:plan.opId,keyGeneration:1,serverUpdatedAt:stamp,
      }));
    return {status:200,body:{ok:true,rows:visible,complete:false,
      nextCursor:visible.length===request.limit?visible.at(-1)!.rowId:null,
    }};
  });
  const gate={assertReady:vi.fn(async(_scope:typeof owner)=>{})};
  const rehearse=()=>rehearsePersistedOwnerV2TwoPassParity(
    root,owner,keyId,1,1,{scan},gate);
  return {root,keyId,plans,requests,scan,gate,rehearse,
    getCalls:()=>scanCounter};
}
describe('dormant two-pass preserved owner-v2 scan parity is NEVER migration ACK',()=>{
  it('checks exact original task+Diary ciphertext across all opaque cursors twice',async()=>{
    const f=await fixture();
    const result=await f.rehearse();
    expect(result).toEqual({
      status:'two-pass-original-ciphertext-observed-not-acknowledged',
      rows:2,collections:2,pages:8,complete:false,
    });
    expect(f.scan).toHaveBeenCalledTimes(8);
    expect(f.requests.map(x=>x.operation)).toEqual(Array(8).fill('scan'));
    expect(f.requests.every(x=>x.expectedGeneration===1&&
      x.expectedKeyId===f.keyId&&x.limit===1)).toBe(true);
    const wire=JSON.stringify(f.requests);
    expect(wire).not.toContain('DO NOT LEAK');
    expect(readIntents).toHaveBeenCalledTimes(2);
    expect(f.gate.assertReady).toHaveBeenCalled();
  });
  it('rejects missing row, operation mismatch and syntactically valid changed ciphertext',async()=>{
    for(const kind of ['missing','operation','ciphertext'] as const){
      const f=await fixture();
      const original=f.scan.getMockImplementation()!;
      f.scan.mockImplementation(async(request:OwnerV2ScanRequest)=>{
        const result=await original(request);
        if(request.collection==='tasks'&&request.cursor===null){
          if(kind==='missing')result.body.rows=[];
          if(kind==='operation')result.body.rows[0]!.opId='o_'+'f'.repeat(32);
          if(kind==='ciphertext'){
            const envelope=result.body.rows[0]!.record.envelope;
            result.body.rows[0]!.record={
              ...result.body.rows[0]!.record,
              envelope:{...envelope,ct:
                (envelope.ct.startsWith('A')?'B':'A')+envelope.ct.slice(1)},
            };
          }
          if(kind==='missing')result.body.nextCursor=null;
        }
        return result;
      });
      await expect(f.rehearse()).rejects.toThrow('original local intents retained');
    }
  });
  it('rejects changed server timestamps between complete passes',async()=>{
    const f=await fixture();
    const original=f.scan.getMockImplementation()!;
    let calls=0;
    f.scan.mockImplementation(async(request:OwnerV2ScanRequest)=>{
      const result=await original(request);
      calls++;
      if(calls>4&&result.body.rows.length)
        result.body.rows[0]!.serverUpdatedAt='2026-11-28T08:01:00.000Z';
      return result;
    });
    await expect(f.rehearse()).rejects.toThrow('original local intents retained');
  });
  it('rejects a new or altered pending intent appearing between scans and final readback',async()=>{
    const f=await fixture();
    readIntents.mockReset()
      .mockResolvedValueOnce(structuredClone(f.plans))
      .mockResolvedValueOnce(f.plans.map((p,i)=>i===0?{
        ...p,opId:'o_'+'f'.repeat(32),
      }:p));
    await expect(f.rehearse()).rejects.toThrow('original local intents retained');
    expect(readIntents).toHaveBeenCalledTimes(2);
  });
  it('fails closed on wrong key, owner, root or epoch before remote scan',async()=>{
    const f=await fixture();
    await expect(rehearsePersistedOwnerV2TwoPassParity(
      new Uint8Array(32),owner,f.keyId,1,1,
      {scan:f.scan},f.gate)).rejects.toThrow();
    expect(f.scan).toHaveBeenCalled();
    f.scan.mockClear();
    for(const args of [
      [f.root,{...owner,ownerId:'foreign'},f.keyId,1],
      [f.root,{...owner,projectId:'6ae9599c002ab812f9c3'},f.keyId,1],
      [f.root,owner,f.keyId,2],
    ] as const){
      await expect(rehearsePersistedOwnerV2TwoPassParity(
        args[0],args[1],args[2],args[3],1,
        {scan:f.scan},f.gate)).rejects.toThrow();
    }
    expect(f.scan).not.toHaveBeenCalled();
  });
});
