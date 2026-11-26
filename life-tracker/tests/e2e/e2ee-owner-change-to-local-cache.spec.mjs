import { expect, test } from '@playwright/test';

// Synthetic, authenticated-in-memory Appwrite-like remote response, no real backend.
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('E2EE owner cache integration requires a local Vite origin');
test.use({ignoreHTTPSErrors:true});

test('AEAD owner changes persist ciphertext before cursor CAS; lost ack safely replays, then resumes after reload',async({page})=>{
  let backendWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))backendWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {prepareEncryptedOwnerMutation}=await import('/src/lib/e2ee/ownerCiphertextTransport.ts');
    const {stageEncryptedOwnerChangeFeed}=await import('/src/lib/e2ee/ownerChangeFeedCheckpoint.ts');
    const {indexedDbOwnerFeedCheckpoints:checkpoints}=await import('/src/lib/e2ee/ownerFeedIndexedDbCheckpoint.ts');
    const {makeLocalCipherMirrorPageApplier,readLocalCipherOwnerRecord}=
      await import('/src/lib/e2ee/ownerLocalCipherMirror.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_verified_pipeline'};
    const session={root:new Uint8Array(32).fill(26),
      keyId:'k_'+'a'.repeat(32),generation:1};
    const plain={id:'private_original_row',userId:owner.ownerId,
      title:'PRIVATE OWNER TITLE E2EE PIPELINE',date:'2025-01-12',
      visibility:'private',isDeleted:false};
    const mutation=await prepareEncryptedOwnerMutation(owner,session,'tasks',plain,null);
    const stamp='2026-11-26T02:00:00.000Z';
    const cursor={updatedAt:stamp,rowId:mutation.record.rowId};
    const encryptedRow={...mutation.record,deleted:false,updatedAt:stamp};
    const calls=[];
    const rpc={send:async(operation,args)=>{
      calls.push({operation,after:args?.after??null});
      if(operation!=='changes')throw new Error('Unexpected remote operation');
      if(args?.after)return {ok:true,rows:[],after:args.after,hasMore:false};
      return {ok:true,rows:[{record:encryptedRow,serverUpdatedAt:stamp}],
        after:cursor,hasMore:false};
    }};
    const gate={assertReady:async who=>{
      if(who.projectId!==owner.projectId||who.ownerId!==owner.ownerId)
        throw new Error('Incorrect account');
    }};
    const applier=makeLocalCipherMirrorPageApplier(session);
    let failOnce=true;
    const localStore={
      read:(...args)=>checkpoints.read(...args),
      compareAndSet:async(...args)=>{
        if(failOnce){failOnce=false;return false;}
        return checkpoints.compareAndSet(...args);
      },
    };
    let failed=false;
    try {
      await stageEncryptedOwnerChangeFeed(owner,session,'tasks',rpc,gate,
        localStore,applier,()=>true);
    }catch{failed=true;}
    if(!failed)throw new Error('Expected lost checkpoint acknowledgement');
    const pending=await readLocalCipherOwnerRecord(owner,session,'tasks',cursor.rowId);
    const before=await checkpoints.read(owner,'tasks');
    if(!pending || before!==null)
      throw new Error('Partial checkpoint or missing ciphertext mirror');
    const retried=await stageEncryptedOwnerChangeFeed(owner,session,'tasks',rpc,gate,
      localStore,applier,()=>true);
    const saved=await checkpoints.read(owner,'tasks');
    const resumed=await stageEncryptedOwnerChangeFeed(owner,session,'tasks',rpc,gate,
      localStore,applier,()=>true);
    return {failed,pending:pending.document.title,after:retried.lastCursor,
      checkpoint:saved?.after,resumed,calls,rowId:cursor.rowId};
  });
  expect(result.failed).toBe(true);
  expect(result.pending).toBe('PRIVATE OWNER TITLE E2EE PIPELINE');
  expect(result.after).toEqual(result.checkpoint);
  expect(result.calls.map(c=>c.after===null)).toEqual([true,true,false]);
  expect(result.resumed).toMatchObject({records:0,moreMayRemain:false});
  await page.reload({waitUntil:'domcontentloaded'});
  const afterReload=await page.evaluate(async(rowId)=>{
    const {indexedDbOwnerFeedCheckpoints:checkpoints}=await import('/src/lib/e2ee/ownerFeedIndexedDbCheckpoint.ts');
    const {readLocalCipherOwnerRecord}=await import('/src/lib/e2ee/ownerLocalCipherMirror.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_verified_pipeline'};
    const session={root:new Uint8Array(32).fill(26),
      keyId:'k_'+'a'.repeat(32),generation:1};
    const restored=await readLocalCipherOwnerRecord(owner,session,'tasks',rowId);
    const cursor=await checkpoints.read(owner,'tasks');
    const other=await readLocalCipherOwnerRecord(
      {...owner,ownerId:'not_the_owner'},session,'tasks',rowId);
    return {restored,cursor,other};
  },result.rowId);
  expect(afterReload.restored.document.id).toBe('private_original_row');
  expect(afterReload.cursor.after).toEqual(result.checkpoint);
  expect(afterReload.other).toBeNull();
  expect(backendWrites).toBe(0);
});
