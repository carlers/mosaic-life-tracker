import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {prospectiveScratchRootEpochTransaction}=require(
  '../../appwrite-functions/message-action/e2ee-root-epoch-transaction-candidate.js'
) as {
  prospectiveScratchRootEpochTransaction:(...args:unknown[])=>Promise<{
    status:string;claimId:string;generation:number;
  }>;
};
const crypto=require('node:crypto') as typeof import('node:crypto');
const PROJECT='6b00671500279e901846',OWNER='synthetic_root_tx';
const OLD_KEY='k_'+'a'.repeat(32),NEW_KEY='k_'+'b'.repeat(32);
const ENVELOPE=(keyId:string,ct='A'.repeat(64))=>JSON.stringify({
  v:1,alg:'A256GCM',kid:keyId,iv:'A'.repeat(16),ct,
});
const OLD=ENVELOPE(OLD_KEY),NEXT=ENVELOPE(NEW_KEY,'B'.repeat(64));
const ROOT_ID='kr_'+crypto.createHash('sha256')
  .update('mosaic-e2ee-owner-v2|'+OWNER).digest('hex').slice(0,32);
const proposal={expectedKeyId:OLD_KEY,nextKeyId:NEW_KEY,
  operationId:'o_'+'c'.repeat(32)};
const verify=vi.fn(async()=>true);
// Test-only stub: NOT a trusted proof of possession, signature, or replay gate.
const verifyRootAuthorization=vi.fn(async()=>true);
const syntheticProof='c'.repeat(86);
function fakeDb(){
  let current:Record<string,unknown>={
    $id:ROOT_ID,$permissions:['read("user:'+OWNER+'")'],
    user_id:OWNER,key_id:OLD_KEY,generation:1,envelope:OLD,
  };
  const claims=new Map<string,Record<string,unknown>>();
  type Stage=Readonly<{kind:'claim'|'root';args:{
    databaseId:string;tableId:string;rowId:string;
    data:Record<string,unknown>;permissions?:string[];transactionId:string;
  }}>;
  const pending=new Map<string,Stage[]>();
  let serial=0;
  const getRow=vi.fn(async(args:{tableId:string;rowId:string})=>{
    if(args.tableId==='account_crypto_roots_v2'&&args.rowId===ROOT_ID)
      return structuredClone(current);
    if(args.tableId==='owner_root_epoch_claims_v2'){
      const claim=claims.get(args.rowId);
      if(claim)return structuredClone(claim);
    }
    throw Object.assign(new Error('not found'),{code:404});
  });
  const createTransaction=vi.fn(async()=>{
    const id='tx_'+(++serial);pending.set(id,[]);return {$id:id};
  });
  const createRow=vi.fn(async(args:Stage['args'])=>{
    if(!pending.has(args.transactionId))throw Error('missing transaction');
    pending.get(args.transactionId)!.push({kind:'claim',args});return {};
  });
  const updateRow=vi.fn(async(args:Stage['args'])=>{
    if(!pending.has(args.transactionId))throw Error('missing transaction');
    pending.get(args.transactionId)!.push({kind:'root',args});return {};
  });
  const updateTransaction=vi.fn(async(args:{transactionId:string;commit?:boolean;rollback?:boolean})=>{
    const staged=pending.get(args.transactionId);
    if(!staged)throw Error('transaction no longer available');
    if(args.rollback){pending.delete(args.transactionId);return {status:'rolled_back'};}
    if(!args.commit||staged.length!==2||
       staged[0].kind!=='claim'||staged[1].kind!=='root')
      throw Error('unsafe staged transaction');
    const [claim,root]=staged.map(item=>item.args);
    if(claim.databaseId!=='life_tracker'||root.databaseId!=='life_tracker'||
       claim.tableId!=='owner_root_epoch_claims_v2'||
       root.tableId!=='account_crypto_roots_v2'||root.rowId!==ROOT_ID||
       claim.permissions?.length!==0||
       root.permissions?.join()!=='read("user:'+OWNER+'")')
      throw Error('bad transaction shape');
    if(claims.has(claim.rowId))throw Object.assign(Error('unique conflict'),{code:409});
    // Synthetic atomic commit model: neither row is visible until all staged
    // operations are accepted and committed together.
    claims.set(claim.rowId,{$id:claim.rowId,...claim.data});
    current={...current,...root.data};
    pending.delete(args.transactionId);
    return {status:'committed'};
  });
  return {getRow,createTransaction,createRow,updateRow,updateTransaction,
    root:()=>structuredClone(current),claims,pending,setRoot:(row:Record<string,unknown>)=>{
      current=row;
    }};
}
async function invoke(db:ReturnType<typeof fakeDb>,
  next=NEXT,expected=OLD,p=proposal,owner=OWNER){
  return prospectiveScratchRootEpochTransaction(
    db,owner,'synthetic-jwt',verify,1,p,expected,next,
    syntheticProof,verifyRootAuthorization);
}
describe('unwired Scratch-only atomic owner-root epoch transaction candidate',()=>{
  beforeEach(()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',PROJECT);
    vi.stubEnv('MOSAIC_E2EE_ROOT_TX_CANDIDATE_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_ROOT_TX_ALLOWED_OWNER_IDS',OWNER);
    verify.mockReset();verify.mockResolvedValue(true);
    verifyRootAuthorization.mockReset();verifyRootAuthorization.mockResolvedValue(true);
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('stages a unique epoch claim and root update in ONE transaction; acknowledges only commit + readbacks',async()=>{
    const db=fakeDb(),result=await invoke(db);
    expect(result).toMatchObject({status:'committed-and-readback',generation:2});
    expect(result.claimId).toMatch(/^ec_[a-f0-9]{32}$/);
    expect(db.createTransaction).toHaveBeenCalledOnce();
    expect(db.createRow).toHaveBeenCalledOnce();
    expect(db.updateRow).toHaveBeenCalledOnce();
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'tx_1',commit:true});
    expect(db.root()).toMatchObject({generation:2,key_id:NEW_KEY,envelope:NEXT});
    expect(db.claims.size).toBe(1);
    expect(db.claims.get(result.claimId)).toMatchObject({
      from_generation:1,to_generation:2,expected_key_id:OLD_KEY,
      next_key_id:NEW_KEY,operation_id:proposal.operationId,
    });
    const all=JSON.stringify([
      db.createRow.mock.calls,db.updateRow.mock.calls]);
    expect(all).not.toContain('synthetic-jwt');
    expect(all).not.toContain('recovery_key');
    expect(db.pending.size).toBe(0);
    expect(verify).toHaveBeenCalledTimes(3);
    expect(verifyRootAuthorization).toHaveBeenCalledTimes(2);
    const [bound,provided]=verifyRootAuthorization.mock.calls[0];
    expect(provided).toBe(syntheticProof);
    expect(bound).toEqual({
      projectId:PROJECT,ownerId:OWNER,claimId:result.claimId,
      expectedGeneration:1,nextGeneration:2,
      expectedKeyId:OLD_KEY,nextKeyId:NEW_KEY,
      operationId:proposal.operationId,
      beforeEnvelopeSha256:crypto.createHash('sha256').update(OLD).digest('hex'),
      afterEnvelopeSha256:crypto.createHash('sha256').update(NEXT).digest('hex'),
    });
    expect(verifyRootAuthorization.mock.calls[1][0]).toEqual(bound);
    expect(all).not.toContain(syntheticProof);
  });
  it('denies wrong project, flag, allowlist, missing transaction APIs and MFA before any stage',async()=>{
    const db=fakeDb();
    for(const [name,value] of [
      ['APPWRITE_FUNCTION_PROJECT_ID','6ae9599c002ab812f9c3'],
      ['APPWRITE_FUNCTION_PROJECT_ID','6ae94a2100014d01f5ed'],
      ['MOSAIC_E2EE_ROOT_TX_CANDIDATE_ENABLED','false'],
      ['MOSAIC_E2EE_ROOT_TX_ALLOWED_OWNER_IDS','someone_else'],
    ]){
      vi.stubEnv(name,value);
      await expect(invoke(db)).rejects.toThrow('unavailable or unverified');
      vi.stubEnv(name,name==='APPWRITE_FUNCTION_PROJECT_ID'?PROJECT:
        name==='MOSAIC_E2EE_ROOT_TX_CANDIDATE_ENABLED'?'true':OWNER);
    }
    verify.mockResolvedValue(false);
    await expect(invoke(db)).rejects.toThrow();
    verify.mockResolvedValue(true);
    await expect(prospectiveScratchRootEpochTransaction(
      {...db,createTransaction:undefined},OWNER,'synthetic-jwt',verify,
      1,proposal,OLD,NEXT,syntheticProof,verifyRootAuthorization)).rejects.toThrow();
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('refuses missing proof, client-supplied booleans, absent verifier and untrusted key assertion before any transaction',async()=>{
    const db=fakeDb(),args=[
      db,OWNER,'synthetic-jwt',verify,1,proposal,OLD,NEXT,
    ] as const;
    for(const [provided,verifier] of [
      [undefined,verifyRootAuthorization],[true,verifyRootAuthorization],
      [' ',verifyRootAuthorization],['c'.repeat(2048),verifyRootAuthorization],
      [syntheticProof,undefined],
    ] as const){
      await expect(prospectiveScratchRootEpochTransaction(
        ...args,provided,verifier)).rejects.toThrow('unavailable or unverified');
    }
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.createTransaction).not.toHaveBeenCalled();
    verifyRootAuthorization.mockResolvedValue(false);
    await expect(invoke(db)).rejects.toThrow('unavailable or unverified');
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.root().generation).toBe(1);
  });
  it('denies revoked/expired root authorization immediately before commit and rolls back both stages',async()=>{
    const db=fakeDb();
    verifyRootAuthorization.mockReset()
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(invoke(db)).rejects.toThrow('unavailable or unverified');
    expect(verifyRootAuthorization).toHaveBeenCalledTimes(2);
    expect(db.createRow).toHaveBeenCalledOnce();
    expect(db.updateRow).toHaveBeenCalledOnce();
    expect(db.updateTransaction).toHaveBeenCalledWith({
      transactionId:'tx_1',rollback:true,
    });
    expect(db.updateTransaction).not.toHaveBeenCalledWith({
      transactionId:'tx_1',commit:true,
    });
    expect(db.root().generation).toBe(1);
    expect(db.claims.size).toBe(0);
  });
  it('refuses stale epoch, invalid server ACL, malformed ciphertext and arbitrary request fields',async()=>{
    const db=fakeDb();
    for(const patch of [
      {generation:2},{key_id:NEW_KEY},
      {$permissions:['read("any")']},{user_id:'foreign_owner'},
      {envelope:'{}'},{$id:'kr_wrong'},
    ]){
      const saved=db.root();
      db.setRoot({...saved,...patch});
      await expect(invoke(db)).rejects.toThrow();
      db.setRoot(saved);
    }
    for(const value of [
      ENVELOPE(OLD_KEY),ENVELOPE(NEW_KEY,'bad'),
      JSON.stringify({v:1,alg:'A256GCM',kid:NEW_KEY,iv:'BAD',ct:'B'.repeat(64)}),
    ])await expect(invoke(db,value)).rejects.toThrow();
    await expect(invoke(db,NEXT,'WRONG_ENVELOPE')).rejects.toThrow();
    await expect(invoke(db,NEXT,OLD,{...proposal,
      claimId:'client_provided_claim'})).rejects.toThrow();
    expect(db.createTransaction).not.toHaveBeenCalled();
  });
  it('prevents competing same-generation winners and does not overwrite the first root',async()=>{
    const db=fakeDb();
    const contender={...proposal,nextKeyId:'k_'+'d'.repeat(32),
      operationId:'o_'+'e'.repeat(32)};
    const outcomes=await Promise.allSettled([
      invoke(db),invoke(db,ENVELOPE(contender.nextKeyId,'C'.repeat(64)),OLD,contender),
    ]);
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.filter(x=>x.status==='rejected')).toHaveLength(1);
    const winner=outcomes[0].status==='fulfilled'?NEW_KEY:contender.nextKeyId;
    expect(db.root().key_id).toBe(winner);
    expect(db.claims.size).toBe(1);
  });
  it('rolls back on staging errors or MFA expiry; never commits partial records',async()=>{
    const db=fakeDb();
    db.updateRow.mockRejectedValueOnce(Error('staging denied'));
    await expect(invoke(db)).rejects.toThrow();
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'tx_1',rollback:true});
    expect(db.root().generation).toBe(1);
    expect(db.claims.size).toBe(0);
    verify.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(invoke(db)).rejects.toThrow();
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'tx_2',rollback:true});
    expect(db.root().generation).toBe(1);
  });
  it('treats lost/indeterminate commit receipts as failure, never acknowledges an unsafe success',async()=>{
    const db=fakeDb(),original=db.updateTransaction.getMockImplementation()!;
    db.updateTransaction.mockImplementation(async(args:{transactionId:string;commit?:boolean;rollback?:boolean})=>{
      const result=await original(args);
      if(args.commit)return {status:'pending'};
      return result;
    });
    await expect(invoke(db)).rejects.toThrow();
    // The model actually committed. A later authenticated reconciliation must
    // decide outcome; caller MUST NOT retry with a fresh operation ID.
    expect(db.root().generation).toBe(2);
    expect(db.claims.size).toBe(1);
    expect(db.updateTransaction).not.toHaveBeenCalledWith({transactionId:'tx_1',rollback:true});
  });
});
