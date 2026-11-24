import { expect, test } from '@playwright/test';

// Real Chromium IndexedDB + WebCrypto; no real Appwrite credentials or writes.
// This verifies the NEW ciphertext outbox's reload/retry semantics, not a
// shipped historical PWA or the old plaintext RxDB replication queue.
const BASE_URL=process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
const host=new URL(BASE_URL).hostname;
if(host!=='127.0.0.1' && host!=='localhost')
  throw new Error('E2EE offline outbox rehearsal must run on a local Vite host');

test.use({ignoreHTTPSErrors:true});

test('synthetic encrypted outbox preserves immutable intents through reload, conflict and lost readback',async({page})=>{
  let backendMutationRequests=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method())) backendMutationRequests++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE_URL+'/login',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Welcome Back'})).toBeVisible();

  const first=await page.evaluate(async()=>{
    const {prepareEncryptedOwnerMutation}=await import('/src/lib/e2ee/ownerCiphertextTransport.ts');
    const {queueEncryptedOwnerIntent,listEncryptedOwnerIntents}=await import('/src/lib/e2ee/encryptedOwnerOutbox.ts');
    const owner={projectId:'local_only_e2ee_rehearsal',ownerId:'disposable_owner_a'};
    const session={root:new Uint8Array(32).fill(37),keyId:'k_'+'a'.repeat(32),generation:1};
    const text='DISPOSABLE-ONLY-PRIVATE-TASK-RELOAD';
    const mutation=await prepareEncryptedOwnerMutation(owner,session,'tasks',{
      id:'test_offline_task',userId:owner.ownerId,visibility:'private',
      isDeleted:false,title:text,date:'2026-11-25',
    },null);
    await queueEncryptedOwnerIntent(owner,mutation);
    const pending=await listEncryptedOwnerIntents(owner);
    if(pending.length!==1 || pending[0].record.envelope.ct.includes(text) ||
       JSON.stringify(pending).includes(text) ||
       Object.keys(pending[0].record.published).length)
      throw new Error('Unsafe synthetic ciphertext outbox serialization');
    return {opId:mutation.opId,ct:mutation.record.envelope.ct,
      iv:mutation.record.envelope.iv,rowId:mutation.record.rowId};
  });
  expect(first.opId).toMatch(/^o_[a-f0-9]{32}$/);
  expect(first.rowId).toMatch(/^p_[a-f0-9]{32}$/);

  // Simulate an actual browser-document restart: module scope and connections
  // disappear. The isolated IndexedDB row must survive.
  await page.reload({waitUntil:'domcontentloaded'});
  const retained=await page.evaluate(async()=>{
    const {listEncryptedOwnerIntents,replayEncryptedOwnerIntents}=await import('/src/lib/e2ee/encryptedOwnerOutbox.ts');
    const owner={projectId:'local_only_e2ee_rehearsal',ownerId:'disposable_owner_a'};
    const session={root:new Uint8Array(32).fill(37),keyId:'k_'+'a'.repeat(32),generation:1};
    const gate={assertReady:async input=>{
      if(input.ownerId!==owner.ownerId || input.projectId!==owner.projectId)
        throw new Error('Simulated wrong owner');
    }};
    if((await listEncryptedOwnerIntents({projectId:owner.projectId,ownerId:'disposable_owner_b'})).length)
      throw new Error('Cross-owner pending intent exposed');
    if((await listEncryptedOwnerIntents({projectId:'other_local_project',ownerId:owner.ownerId})).length)
      throw new Error('Cross-project pending intent exposed');
    const original=(await listEncryptedOwnerIntents(owner))[0];
    if(!original)throw new Error('Reload discarded pending encrypted intent');
    let attempted=false;
    const rpc={send:async operation=>{
      if(operation!=='put') throw new Error('Unexpected remote operation');
      attempted=true;
      throw Object.assign(new Error('Synthetic rejected mutation'),{code:409});
    }};
    let failed=false;
    try{await replayEncryptedOwnerIntents(owner,session,rpc,gate)}
    catch(e){failed=e.code===409}
    if(!failed || !attempted)throw new Error('Simulated HTTP 409 was not propagated');
    const after=(await listEncryptedOwnerIntents(owner))[0];
    if(!after)throw new Error('HTTP 409 discarded pending ciphertext');
    return {before:original,after};
  });
  expect(retained.after).toEqual(retained.before);
  expect(retained.after.opId).toBe(first.opId);
  expect(retained.after.record.envelope.ct).toBe(first.ct);
  expect(retained.after.record.envelope.iv).toBe(first.iv);

  // A server may accept a write while the response/readback is lost.
  // The original intent must stay until a later duplicate acknowledgement
  // AND authenticated client-side readback of the identical ciphertext.
  const recovery=await page.evaluate(async()=>{
    const {listEncryptedOwnerIntents,replayEncryptedOwnerIntents}=await import('/src/lib/e2ee/encryptedOwnerOutbox.ts');
    const owner={projectId:'local_only_e2ee_rehearsal',ownerId:'disposable_owner_a'};
    const session={root:new Uint8Array(32).fill(37),keyId:'k_'+'a'.repeat(32),generation:1};
    const gate={assertReady:async()=>{}};
    const intent=(await listEncryptedOwnerIntents(owner))[0];
    let firstPut=0,firstGet=0;
    const lostReadback={send:async(operation,input)=>{
      if(operation==='put'){
        firstPut++;
        if(input.opId!==intent.opId || input.record.envelope.ct!==intent.record.envelope.ct)
          throw new Error('Retry changed original ciphertext');
        return {ok:true,status:'created',revision:intent.record.envelope.revision};
      }
      if(operation==='get'){
        firstGet++;
        throw new Error('Synthetic readback connection lost');
      }
      throw new Error('Unexpected operation');
    }};
    let failed=false;
    try{await replayEncryptedOwnerIntents(owner,session,lostReadback,gate)}
    catch(e){failed=e.message==='Synthetic readback connection lost'}
    if(!failed || firstPut!==1 || firstGet!==1 ||
       (await listEncryptedOwnerIntents(owner)).length!==1)
      throw new Error('Lost readback incorrectly discarded original ciphertext');
    const actions=[];
    const recovered={send:async(operation,input)=>{
      actions.push(operation);
      if(operation==='put'){
        if(input.opId!==intent.opId || input.record.envelope.ct!==intent.record.envelope.ct ||
           input.record.envelope.iv!==intent.record.envelope.iv)
          throw new Error('Duplicate replay changed envelope');
        return {ok:true,status:'duplicate',revision:intent.record.envelope.revision};
      }
      if(operation==='get')return {ok:true,row:intent.record};
      throw new Error('Unexpected operation');
    }};
    const acknowledged=await replayEncryptedOwnerIntents(owner,session,recovered,gate);
    const left=await listEncryptedOwnerIntents(owner);
    return {acknowledged,left:left.length,actions,original:intent.opId};
  });
  expect(recovery).toEqual({
    acknowledged:1,left:0,actions:['put','get'],original:first.opId,
  });
  // The rehearsal itself must not send any Appwrite request.
  expect(backendMutationRequests).toBe(0);
});
