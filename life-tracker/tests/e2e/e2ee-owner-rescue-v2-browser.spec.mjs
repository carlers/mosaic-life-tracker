import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Rescue-to-v2 source-only proof must run on localhost');
test.use({ignoreHTTPSErrors:true});
test('verified source-only rescue stages every owner tombstone with original retry bytes',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const first=await page.evaluate(async()=>{
    const {buildOwnerLocalRescueFile,unpackVerifiedOwnerLocalRescueFile}=await import(
      '/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const {stageVerifiedScratchRescueOwnerV2}=await import(
      '/src/lib/e2ee/ownerRescueV2Staging.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_browser_rescue_stage'};
    const root=new Uint8Array(32).fill(67),keyId='k_'+'a'.repeat(32);
    const rows={
      tasks:[{id:'raw_deleted_task',userId:owner.ownerId,isDeleted:false,
        _deleted:true,_rev:'2-r',_meta:{lwt:1795665000000},_attachments:{},
        title:'PRIVATE-TASK-KEEP-DELETED',visibility:'private',date:'2045-06-01'}],
      diary:[{id:'raw_live_diary',userId:owner.ownerId,isDeleted:false,
        _deleted:false,_rev:'1-a',_meta:{lwt:1795665000001},_attachments:{},
        content:'PRIVATE-DIARY-NEVER-LEAK',visibility:'private',date:'2045-06-01'}],
    };
    const gate={assertReady:async x=>{
      if(x.projectId!==owner.projectId||x.ownerId!==owner.ownerId)
        throw Error('Wrong synthetic owner');
    }};
    const sources={rows:{readAll:async(collection)=>rows[collection]||[]},
      images:{readAll:async()=>[]},
      queues:{length:0,key:()=>null,getItem:()=>null}};
    const backup=await buildOwnerLocalRescueFile(owner,root,keyId,gate,sources);
    const recovered=await unpackVerifiedOwnerLocalRescueFile(owner,root,backup.file);
    if(recovered.rows.length!==2||recovered.media.length||recovered.pending.length)
      throw Error('Incomplete synthetic roundtrip');
    const first=await stageVerifiedScratchRescueOwnerV2(
      root,owner,recovered,keyId,1);
    const second=await stageVerifiedScratchRescueOwnerV2(
      root,owner,recovered,keyId,1);
    if(first.stored!==2||first.reused||second.stored||second.reused!==2)
      throw Error('Durable repeat staging not idempotent');
    if(first.plans.some(p=>JSON.stringify(p).includes('PRIVATE-'))||
       second.plans.some(p=>JSON.stringify(p).includes('PRIVATE-')))
      throw Error('Plaintext in pending ciphertext');
    const bad={...recovered,media:[{localId:'pending_photo',blob:new Blob(['secret']),
      createdAt:'2026-11-26T00:00:00Z'}]};
    const denied=await stageVerifiedScratchRescueOwnerV2(root,owner,bad,keyId,1)
      .then(()=>false,()=>true);
    return {stored:first.stored,reused:second.reused,denied,
      plans:first.plans.map(p=>({rowId:p.rowId,opId:p.opId,ct:p.record.envelope.ct,
        deleted:p.record.routing.isDeleted,collection:p.collection}))};
  });
  expect(first).toMatchObject({stored:2,reused:2,denied:true});
  expect(first.plans.find(p=>p.collection==='tasks').deleted).toBe(true);
  expect(first.plans.find(p=>p.collection==='diary').deleted).toBe(false);
  await page.reload({waitUntil:'domcontentloaded'});
  const resumed=await page.evaluate(async()=>{
    const {listV2OwnerMigrationIntents}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_browser_rescue_stage'};
    return (await listV2OwnerMigrationIntents(new Uint8Array(32).fill(67),owner))
      .map(p=>({rowId:p.rowId,opId:p.opId,ct:p.record.envelope.ct,
        deleted:p.record.routing.isDeleted,collection:p.collection}));
  });
  expect(resumed.sort((a,b)=>a.rowId.localeCompare(b.rowId)))
    .toEqual(first.plans.sort((a,b)=>a.rowId.localeCompare(b.rowId)));
  expect(writes).toBe(0);
});
