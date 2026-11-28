import {describe,expect,it,vi} from 'vitest';
import {
  generateAccountRoot,generateKeyId,generateRevision,
  deriveMigratedOwnerRowId,
} from '../../src/lib/e2ee/coreCrypto';
import {
  sealV2PrivateOwnerDocument,SCRATCH_OWNER_V2_PROJECT,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import {
  decryptProspectiveOwnerV2ScanPage,type OwnerV2ScanRequest,
} from '../../src/lib/e2ee/ownerV2ScanPage';
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,
  ownerId:'synthetic_scan_page_owner'};
const when='2026-11-28T07:50:00.000Z';
async function fixture(){
  const root=generateAccountRoot(),keyId=generateKeyId();
  const rowId=await deriveMigratedOwnerRowId(
    root,owner,'task','synthetic_original_task');
  const record=await sealV2PrivateOwnerDocument(root,owner,{
    ...owner,payloadDomain:'task',rowId,keyId,revision:generateRevision(),
  },'tasks',{
    id:'synthetic_original_task',userId:owner.ownerId,
    title:'PRIVATE SCANNED TASK',date:'2045-12-31',
    visibility:'private',isDeleted:false,
    createdAt:when,updatedAt:when,
  });
  const original={
    rowId,record,opId:'o_'+'a'.repeat(32),keyGeneration:1,
    serverUpdatedAt:when,
  };
  const gate={assertReady:vi.fn(async(_owner:typeof owner)=>{})};
  const port={scan:vi.fn(async(_request:OwnerV2ScanRequest)=>({
    status:200,body:{ok:true,rows:[original],
      nextCursor:rowId,complete:false},
  }))};
  const read=()=>decryptProspectiveOwnerV2ScanPage(
    root,owner,'tasks',keyId,1,1,null,port,gate);
  return {root,keyId,rowId,record,original,gate,port,read};
}
describe('owner-v2 scan page client AEAD readback is NOT live sync',()=>{
  it('decrypts only into memory after exact authenticated scope, row and opaque ID',async()=>{
    const f=await fixture();
    const result=await f.read();
    expect(result).toMatchObject({
      status:'local-decryption-only-not-sync',complete:false,
      nextCursor:f.rowId,
    });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].document).toMatchObject({
      id:'synthetic_original_task',
      title:'PRIVATE SCANNED TASK',visibility:'private',
      date:'2045-12-31',userId:owner.ownerId,
    });
    expect(f.gate.assertReady).toHaveBeenCalledTimes(2);
    expect(f.port.scan).toHaveBeenCalledOnce();
    expect(f.port.scan.mock.calls[0][0]).toEqual({
      operation:'scan',collection:'tasks',expectedKeyId:f.keyId,
      expectedGeneration:1,limit:1,cursor:null,
    });
    expect(JSON.stringify(f.port.scan.mock.calls[0][0]))
      .not.toContain('PRIVATE SCANNED TASK');
  });
  it('refuses forged response completion, leaked metadata and bad remote key, owner, op or cursor',async()=>{
    const f=await fixture(),good=f.original;
    const variants=[
      {status:200,body:{ok:true,rows:[good],nextCursor:f.rowId,complete:true}},
      {status:200,body:{ok:true,rows:[good],nextCursor:null,complete:false}},
      {status:200,body:{ok:true,rows:[{...good,opId:'invalid'}],
        nextCursor:f.rowId,complete:false}},
      {status:200,body:{ok:true,rows:[{...good,keyGeneration:2}],
        nextCursor:f.rowId,complete:false}},
      {status:200,body:{ok:true,rows:[{...good,serverUpdatedAt:'bad'}],
        nextCursor:f.rowId,complete:false}},
      {status:200,body:{ok:true,rows:[{...good,record:{
        ...good.record,ownerId:'attacker',
      }}],nextCursor:f.rowId,complete:false}},
      {status:200,body:{ok:true,rows:[{
        ...good,plaintext_title:'SECRET',
      }],nextCursor:f.rowId,complete:false}},
      {status:200,body:{ok:true,rows:[good],nextCursor:f.rowId,
        complete:false,plaintext_title:'SECRET'}},
    ];
    for(const response of variants){
      f.port.scan.mockResolvedValueOnce(response as never);
      await expect(f.read()).rejects.toThrow('no sync');
    }
  });
  it('denies wrong account, wrong root, stale epoch and expired session without creating a checkpoint',async()=>{
    const f=await fixture();
    await expect(decryptProspectiveOwnerV2ScanPage(
      f.root,{...owner,ownerId:'foreign'},'tasks',
      f.keyId,1,1,null,f.port,f.gate)).rejects.toThrow();
    await expect(decryptProspectiveOwnerV2ScanPage(
      f.root,{...owner,projectId:'6ae9599c002ab812f9c3'},
      'tasks',f.keyId,1,1,null,f.port,f.gate)).rejects.toThrow();
    await expect(decryptProspectiveOwnerV2ScanPage(
      f.root,owner,'tasks',f.keyId,2,1,null,f.port,f.gate)).rejects.toThrow();
    await expect(decryptProspectiveOwnerV2ScanPage(
      new Uint8Array(32),owner,'tasks',f.keyId,1,1,null,
      f.port,f.gate)).rejects.toThrow();
    f.gate.assertReady.mockRejectedValueOnce(Error('MFA expired'));
    await expect(f.read()).rejects.toThrow();
  });
  it('rejects syntactically valid ciphertext sealed to a forged opaque row ID',async()=>{
    const f=await fixture();
    const badId='p_'+'f'.repeat(32);
    const record=await sealV2PrivateOwnerDocument(f.root,owner,{
      ...owner,payloadDomain:'task',rowId:badId,
      keyId:f.keyId,revision:generateRevision(),
    },'tasks',{
      id:'synthetic_original_task',userId:owner.ownerId,
      title:'PRIVATE SCANNED TASK',date:'2045-12-31',
      visibility:'private',isDeleted:false,
      createdAt:when,updatedAt:when,
    });
    f.port.scan.mockResolvedValueOnce({
      status:200,body:{ok:true,
        rows:[{...f.original,rowId:badId,record}],
        nextCursor:badId,complete:false},
    });
    await expect(f.read()).rejects.toThrow('no sync');
  });
  it('denies zero-limit, oversized pages or unrecognized caller cursor before any transport call',async()=>{
    const f=await fixture();
    for(const [lim,cursor] of [
      [0,null],[26,null],[1,'not-a-row'],
    ] as const){
      await expect(decryptProspectiveOwnerV2ScanPage(
        f.root,owner,'tasks',f.keyId,1,lim,cursor,f.port,
        f.gate)).rejects.toThrow();
    }
    expect(f.port.scan).not.toHaveBeenCalled();
  });
});
