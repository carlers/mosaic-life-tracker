import {expect,test} from '@playwright/test';
// This is synthetic localhost Chromium, not an installed PWA migration.
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Local encrypted intent rehearsal must use localhost');
test.use({ignoreHTTPSErrors:true});
test('persist exact v2 pending intent over reload, reject competing nonce and account',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const prepared=await page.evaluate(async()=>{
    const core=await import('/src/lib/e2ee/coreCrypto.ts');
    const migrate=await import('/src/lib/e2ee/ownerV1ToV2MigrationPlan.ts');
    const store=await import('/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_browser_intent_owner'};
    const root=new Uint8Array(32).fill(51);
    const c={...owner,payloadDomain:'task',rowId:core.generateOpaqueRowId(),
      keyId:core.generateKeyId(),revision:core.generateRevision(),
      publicRouting:{userId:owner.ownerId,isDeleted:false,visibility:'private',
        date:'2042-08-17',reminderTime:'06:29',createdAt:'2026-11-26T01:00:00Z',
        updatedAt:'2026-11-26T01:00:00Z'}};
    const envelope=await core.encryptPrivateRecord(root,c,{
      id:'synthetic_semantic_task',title:'SYNTHETIC-PRIVATE-PENDING',
      completed:false,categoryId:'synthetic_category',order:5});
    const legacy={projectId:owner.projectId,ownerId:owner.ownerId,
      rowId:c.rowId,collection:'tasks',domain:'task',
      routing:c.publicRouting,published:{},envelope};
    const intent=await migrate.prepareScratchOwnerV1ToV2(root,owner,legacy,1);
    const malformed={...intent,unencryptedLabel:'PLAINTEXT_INJECTED'};
    const malformedDenied=await store.stageV2OwnerMigrationIntent(root,owner,
      malformed).then(()=>false,()=>true);
    if(!malformedDenied)throw new Error('Unclassified intent metadata accepted');
    const mutable=structuredClone(intent);
    const mutableOwner={...owner};
    const mutableRoot=root.slice();
    const staging=store.stageV2OwnerMigrationIntent(mutableRoot,mutableOwner,mutable);
    // Deliberately mutate all inputs while asynchronous authentication is pending.
    mutable.unencryptedLabel='PLAINTEXT_AFTER_VALIDATION_START';
    mutable.opId='o_'+'a'.repeat(32);
    mutableOwner.ownerId='synthetic_other';
    mutableRoot.fill(0);
    const first=await staging;
    const second=await store.stageV2OwnerMigrationIntent(root,owner,intent);
    const competing=await migrate.prepareScratchOwnerV1ToV2(root,owner,legacy,1);
    const denied=await store.stageV2OwnerMigrationIntent(root,owner,competing)
      .then(()=>false,()=>true);
    if(first!=='stored'||second!=='unchanged'||!denied)
      throw new Error('Owner intent must be atomic and immutable');
    const all=await store.listV2OwnerMigrationIntents(root,owner);
    if(all.length!==1||JSON.stringify(all[0])!==JSON.stringify(intent))
      throw new Error('Owner intent readback failed');
    const raw=JSON.stringify(all);
    for(const secret of ['SYNTHETIC-PRIVATE-PENDING','synthetic_semantic_task',
      '2042-08-17','06:29','visibility']){
      if(raw.includes(secret))throw new Error('Private content leaked');
    }
    return {rowId:intent.rowId,opId:intent.opId,revision:intent.record.envelope.revision,
      ct:intent.record.envelope.ct};
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async rowId=>{
    const store=await import('/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_browser_intent_owner'};
    const root=new Uint8Array(32).fill(51);
    const entry=await store.readV2OwnerMigrationIntent(root,owner,rowId);
    if(!entry)throw new Error('Saved intent lost on reload');
    const wrongKey=await store.readV2OwnerMigrationIntent(new Uint8Array(32).fill(53),
      owner,rowId).then(()=>false,()=>true);
    const stranger=await store.listV2OwnerMigrationIntents(root,
      {...owner,ownerId:'synthetic_other'}).then(a=>a.length===0,()=>false);
    return {opId:entry.opId,revision:entry.record.envelope.revision,
      ct:entry.record.envelope.ct,wrongKey,stranger};
  },prepared.rowId);
  expect(result).toEqual({
    opId:prepared.opId,revision:prepared.revision,ct:prepared.ct,
    wrongKey:true,stranger:true,
  });
  expect(writes).toBe(0);
});
