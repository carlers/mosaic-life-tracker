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
    const {stageAuthenticatedScratchRescueFileV2}=await import(
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
    const first=await stageAuthenticatedScratchRescueFileV2(
      root,owner,backup.file,keyId,1);
    const second=await stageAuthenticatedScratchRescueFileV2(
      root,owner,backup.file,keyId,1);
    if(first.stored!==2||first.reused||second.stored||second.reused!==2)
      throw Error('Durable repeat staging not idempotent');
    if(first.plans.some(p=>JSON.stringify(p).includes('PRIVATE-'))||
       second.plans.some(p=>JSON.stringify(p).includes('PRIVATE-')))
      throw Error('Plaintext in pending ciphertext');
    const corrupt=JSON.parse(await backup.file.text());
    corrupt.rows[0].rowId='p_'+'f'.repeat(32);
    const tampered=new Blob([JSON.stringify(corrupt)]);
    const denied=await stageAuthenticatedScratchRescueFileV2(
      root,owner,tampered,keyId,1).then(()=>false,()=>true);
    const foreign=await stageAuthenticatedScratchRescueFileV2(
      root,{...owner,ownerId:'synthetic_other_owner'},backup.file,keyId,1)
      .then(()=>false,()=>true);
    const wrongKey=await stageAuthenticatedScratchRescueFileV2(
      new Uint8Array(32).fill(68),owner,backup.file,keyId,1)
      .then(()=>false,()=>true);
    // A valid owner-authenticated saved rescue can still contain photos or
    // queued actions we have no safe migration bridge for. Neither may be
    // silently dropped merely because all included owner rows are decodable.
    const pendingCommand={id:'synthetic_pending_profile',userId:owner.ownerId,
      action:'upsert_profile',op:{kind:'updateRow',bio:'PRIVATE-SOCIAL-QUEUE'},
      enqueuedAt:'2026-11-26T04:00:00Z',attempts:0};
    const pendingKey='mosaic_social_outbox:entry:'+
      encodeURIComponent(owner.ownerId)+':'+encodeURIComponent(pendingCommand.id);
    const pendingMap=new Map([[pendingKey,JSON.stringify(pendingCommand)]]);
    const queuedSources={...sources,queues:{
      get length(){return pendingMap.size;},
      key:(i)=>[...pendingMap.keys()][i]??null,
      getItem:(k)=>pendingMap.get(k)??null,
    }};
    const savedWithPending=await buildOwnerLocalRescueFile(
      owner,root,keyId,gate,queuedSources);
    const blockedPending=await stageAuthenticatedScratchRescueFileV2(
      root,owner,savedWithPending.file,keyId,1).then(()=>false,()=>true);
    const savedWithPhoto=await buildOwnerLocalRescueFile(
      owner,root,keyId,gate,{...sources,images:{readAll:async()=>[{
        id:'localimg_'+'f'.repeat(26),ownerUserId:owner.ownerId,
        blob:new Blob(['PRIVATE-UNPORTABLE-PHOTO'],{type:'image/png'}),
        createdAt:'2026-11-26T04:00:00.000Z',
      }]}});
    const blockedMedia=await stageAuthenticatedScratchRescueFileV2(
      root,owner,savedWithPhoto.file,keyId,1).then(()=>false,()=>true);
    // Existing pending task ciphertext conflicts with a later owner-authenticated
    // saved file that ALSO includes a new task first. Rejection must not leave
    // that new row partially staged before detecting the changed old row.
    const {listV2OwnerMigrationIntents}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const beforeConflict=await listV2OwnerMigrationIntents(root,owner);
    const extraTask={...rows.tasks[0],id:'raw_new_before_conflict',
      title:'PRIVATE NEW TASK',_deleted:false,_rev:'1-new',
      _meta:{lwt:1795665000010}};
    const alteredTask={...rows.tasks[0],title:'PRIVATE CHANGED TOMBSTONE'};
    const changedRows={...rows,tasks:[extraTask,alteredTask]};
    const changedSources={...sources,rows:{readAll:async c=>changedRows[c]||[]}};
    const changedBackup=await buildOwnerLocalRescueFile(
      owner,root,keyId,gate,changedSources);
    const blockedConflict=await stageAuthenticatedScratchRescueFileV2(
      root,owner,changedBackup.file,keyId,1).then(()=>false,()=>true);
    const afterConflict=await listV2OwnerMigrationIntents(root,owner);
    const sameRows=(values)=>values.map(p=>({
      rowId:p.rowId,opId:p.opId,ct:p.record.envelope.ct,
    })).sort((a,b)=>a.rowId.localeCompare(b.rowId));
    const unchangedIntents=JSON.stringify(sameRows(beforeConflict))===
      JSON.stringify(sameRows(afterConflict));
    return {stored:first.stored,reused:second.reused,denied,foreign,wrongKey,
      blockedPending,blockedMedia,pendingCount:savedWithPending.pending,
      mediaCount:savedWithPhoto.media,blockedConflict,unchangedIntents,
      plans:first.plans.map(p=>({rowId:p.rowId,opId:p.opId,ct:p.record.envelope.ct,
        deleted:p.record.routing.isDeleted,collection:p.collection}))};
  });
  expect(first).toMatchObject({stored:2,reused:2,denied:true,foreign:true,
    wrongKey:true,blockedPending:true,blockedMedia:true,pendingCount:1,
    mediaCount:1,blockedConflict:true,unchangedIntents:true});
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
