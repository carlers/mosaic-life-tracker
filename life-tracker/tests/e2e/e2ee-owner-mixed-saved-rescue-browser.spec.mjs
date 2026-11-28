import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Mixed owner E2EE rescue test must run on localhost');
test.use({ignoreHTTPSErrors:true,acceptDownloads:true});

test('saved full owner row and photo ciphertext stages separately, recovers from partial local failure and never ACKs',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const initial=await page.evaluate(async()=>{
    const {buildOwnerLocalRescueFile}=await import(
      '/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_mixed_rescue_owner'};
    const root=new Uint8Array(32).fill(110),keyId='k_'+'a'.repeat(32);
    const row=(id,title,deleted=false)=>({
      id,userId:owner.ownerId,isDeleted:false,_deleted:deleted,
      _rev:'2-'+id,_meta:{lwt:1795665000000},_attachments:{},
      title,visibility:'private',date:'2045-06-01',
    });
    const docs={
      tasks:[row('mixed_task_deleted','SYNTHETIC PRIVATE MIXED TASK',true)],
      diary:[{id:'mixed_diary',userId:owner.ownerId,isDeleted:false,
        _deleted:false,_rev:'2-diary',_meta:{lwt:1795665000001},
        _attachments:{},content:'SYNTHETIC PRIVATE MIXED DIARY',
        visibility:'private',date:'2045-06-01'}],
    };
    const image={id:'localimg_'+'e'.repeat(26),ownerUserId:owner.ownerId,
      blob:new Blob(['SYNTHETIC PRIVATE MIXED PHOTO'],{type:'image/png'}),
      createdAt:'2026-11-26T04:00:00Z'};
    const gate={assertReady:async scope=>{
      if(scope.projectId!==owner.projectId||scope.ownerId!==owner.ownerId)
        throw Error('Wrong synthetic MFA owner');
    }};
    const sources={
      rows:{readAll:async collection=>docs[collection]??[]},
      images:{readAll:async()=>[image,{...image,id:'localimg_'+'f'.repeat(26),
        ownerUserId:'foreign'}]},
      queues:{length:0,key:()=>null,getItem:()=>null},
    };
    const saved=await buildOwnerLocalRescueFile(owner,root,keyId,gate,sources);
    if(saved.rows!==2||saved.media!==1||saved.pending!==0)
      throw Error('Mixed saved rescue missing domains');
    const contents=await saved.file.text();
    for(const leak of ['SYNTHETIC PRIVATE MIXED TASK',
      'SYNTHETIC PRIVATE MIXED DIARY','SYNTHETIC PRIVATE MIXED PHOTO',
      'synthetic_mixed_rescue_owner','localimg_'])
      if(contents.includes(leak))throw Error('Plaintext in saved file');
    const url=URL.createObjectURL(saved.file);
    const a=document.createElement('a');
    a.id='synthetic-mixed-rescue-download';a.href=url;
    a.download=saved.filename;a.textContent='Save encrypted backup';
    document.body.append(a);
    return {size:saved.file.size,filename:saved.filename};
  });
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#synthetic-mixed-rescue-download').click(),
  ]);
  expect(download.suggestedFilename()).toBe(initial.filename);
  const dir=await mkdtemp(join(tmpdir(),'mosaic-mixed-rescue-'));
  const filename=join(dir,download.suggestedFilename());
  try{
    await download.saveAs(filename);
    expect((await readFile(filename)).length).toBe(initial.size);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      const input=document.createElement('input');
      input.type='file';input.id='synthetic-mixed-rescue-selected';
      document.body.append(input);
    });
    await page.locator('#synthetic-mixed-rescue-selected').setInputFiles(filename);
    const result=await page.evaluate(async()=>{
      const {stageSelectedScratchOwnerRescueFileWithMedia}=await import(
        '/src/lib/e2ee/ownerCurrentOriginRescueBridge.ts');
      const {stageAuthenticatedScratchRescueFileV2,
        auditSavedScratchOwnerLocalIntentParity}=await import(
        '/src/lib/e2ee/ownerRescueV2Staging.ts');
      const {readStagedOwnerEncryptedMedia}=await import(
        '/src/lib/e2ee/ownerSavedMediaIntentStore.ts');
      const {listV2OwnerMigrationIntents}=await import(
        '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
      const {buildOwnerLocalRescueFile}=await import(
        '/src/lib/e2ee/ownerLocalRescueBundle.ts');
      const owner={projectId:'6b00671500279e901846',
        ownerId:'synthetic_mixed_rescue_owner'};
      const root=new Uint8Array(32).fill(110),keyId='k_'+'a'.repeat(32);
      const selected=document.querySelector('#synthetic-mixed-rescue-selected').files[0];
      let readyCalls=0;
      const gate={assertReady:async scope=>{
        readyCalls++;
        if(scope.projectId!==owner.projectId||scope.ownerId!==owner.ownerId)
          throw Error('Wrong synthetic owner');
      }};
      const invoke=(source=selected)=>stageSelectedScratchOwnerRescueFileWithMedia(
        root,owner,source,keyId,1,gate);
      const oldRowOnlyDenied=await stageAuthenticatedScratchRescueFileV2(
        root,owner,selected,keyId,1).then(()=>false,()=>true);
      const wrongOwner=await stageSelectedScratchOwnerRescueFileWithMedia(
        root,{...owner,ownerId:'another_owner'},selected,keyId,1,gate)
        .then(()=>false,()=>true);
      const wrongRoot=await stageSelectedScratchOwnerRescueFileWithMedia(
        new Uint8Array(32).fill(111),owner,selected,keyId,1,gate)
        .then(()=>false,()=>true);
      const wrongProject=await stageSelectedScratchOwnerRescueFileWithMedia(
        root,{...owner,projectId:'6ae9599c002ab812f9c3'},selected,keyId,1,gate)
        .then(()=>false,()=>true);
      // Inject failure on the SECOND row insert, after the photo queue has
      // committed; the owner-row transaction must roll back completely.
      const previousAdd=IDBObjectStore.prototype.add;
      let adds=0,partialDenied=false;
      try{
        IDBObjectStore.prototype.add=function(...args){
          if(this.name==='pending-migration-intents'&&++adds===2)
            throw Error('synthetic owner-row quota failure');
          return previousAdd.apply(this,args);
        };
        partialDenied=await invoke().then(()=>false,()=>true);
      }finally{IDBObjectStore.prototype.add=previousAdd;}
      const partialAuditDenied=await auditSavedScratchOwnerLocalIntentParity(
        root,owner,selected,keyId,1,gate).then(()=>false,()=>true);
      const mediaAfterFailure=await readStagedOwnerEncryptedMedia(root,owner);
      const rowsAfterFailure=await listV2OwnerMigrationIntents(root,owner);
      const recovered=await invoke();
      const again=await invoke();
      const localAudit=await auditSavedScratchOwnerLocalIntentParity(
        root,owner,selected,keyId,1,gate);
      const noExternalAuthority=await auditSavedScratchOwnerLocalIntentParity(
        root,owner,selected,keyId,1,{assertReady:async()=>{throw Error('No current MFA');}})
        .then(()=>false,()=>true);
      const wrongAuditRoot=await auditSavedScratchOwnerLocalIntentParity(
        new Uint8Array(32).fill(111),owner,selected,keyId,1,gate)
        .then(()=>false,()=>true);
      const plans=await listV2OwnerMigrationIntents(root,owner);
      const media=await readStagedOwnerEncryptedMedia(root,owner);
      const stableOps=plans.map(p=>[p.rowId,p.opId,p.record.envelope.ct]);
      const stableMedia=await Promise.all(media.map(async p=>({
        rowId:p.encrypted.rowId,mediaId:p.encrypted.sealedMedia.manifest.mediaId,
        bytes:Array.from(new Uint8Array(
          await p.encrypted.sealedMedia.ciphertext.arrayBuffer())),
      })));
      const queueEntry={id:'mixed_queued_social',userId:owner.ownerId,
        action:'upsert_profile',op:{kind:'updateRow',value:'PRIVATE PENDING'},
        attempts:0,enqueuedAt:'2026-11-26T04:00:00Z'};
      const queueKey='mosaic_social_outbox:entry:'+
        encodeURIComponent(owner.ownerId)+':'+encodeURIComponent(queueEntry.id);
      const pendingMap=new Map([[queueKey,JSON.stringify(queueEntry)]]);
      const rows={tasks:[{id:'another_task',userId:owner.ownerId,
        isDeleted:false,_deleted:false,_rev:'1-t',
        _meta:{lwt:1795665000020},_attachments:{},
        title:'PRIVATE SHOULD NOT STAGE',visibility:'private',date:'2045-06-01'}]};
      const pendingSaved=await buildOwnerLocalRescueFile(owner,root,keyId,gate,{
        rows:{readAll:async name=>rows[name]??[]},
        images:{readAll:async()=>[{id:'localimg_'+'a'.repeat(26),
          ownerUserId:owner.ownerId,
          blob:new Blob(['PRIVATE SOCIAL PHOTO'],{type:'image/png'}),
          createdAt:'2026-11-26T04:00:00Z'}]},
        queues:{get length(){return pendingMap.size;},
          key:i=>[...pendingMap.keys()][i]??null,
          getItem:k=>pendingMap.get(k)??null},
      });
      const pendingFile=new File([await pendingSaved.file.arrayBuffer()],selected.name);
      const pendingAuditDenied=await auditSavedScratchOwnerLocalIntentParity(
        root,owner,pendingFile,keyId,1,gate).then(()=>false,()=>true);
      const pendingDenied=await invoke(pendingFile).then(()=>false,()=>true);
      const afterPendingRows=await listV2OwnerMigrationIntents(root,owner);
      const afterPendingMedia=await readStagedOwnerEncryptedMedia(root,owner);
      return {
        oldRowOnlyDenied,wrongOwner,wrongRoot,wrongProject,partialDenied,
        adds,mediaAfterFailure:mediaAfterFailure.length,
        rowsAfterFailure:rowsAfterFailure.length,recovered,again,
        rowCount:plans.length,photoCount:media.length,stableOps,stableMedia,
        pendingDenied,pendingAuditDenied,partialAuditDenied,
        localAudit,noExternalAuthority,wrongAuditRoot,
        pendingCount:pendingSaved.pending,
        unchangedPending:afterPendingRows.length===plans.length&&
          afterPendingMedia.length===media.length,readyCalls,
      };
    });
    expect(result).toMatchObject({
      oldRowOnlyDenied:true,wrongOwner:true,wrongRoot:true,
      wrongProject:true,partialDenied:true,adds:2,
      mediaAfterFailure:1,rowsAfterFailure:0,
      recovered:{status:'local-mixed-ciphertext-staged-not-cutover',
        rows:2,photos:1,rowStored:2,rowReused:0,photoStored:0,photoReused:1},
      again:{status:'local-mixed-ciphertext-staged-not-cutover',
        rows:2,photos:1,rowStored:0,rowReused:2,photoStored:0,photoReused:1},
      rowCount:2,photoCount:1,pendingDenied:true,pendingAuditDenied:true,
      partialAuditDenied:true,noExternalAuthority:true,wrongAuditRoot:true,
      localAudit:{status:'verified-local-parity-only-no-cutover',rows:2,photos:1},
      pendingCount:1,
      unchangedPending:true,
    });
    expect(result.readyCalls).toBeGreaterThan(8);
    expect(JSON.stringify(result.stableOps)).not.toContain('PRIVATE');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      const input=document.createElement('input');
      input.type='file';input.id='synthetic-mixed-audit-selected';
      document.body.append(input);
    });
    await page.locator('#synthetic-mixed-audit-selected').setInputFiles(filename);
    const resumed=await page.evaluate(async()=>{
      const {readStagedOwnerEncryptedMedia}=await import(
        '/src/lib/e2ee/ownerSavedMediaIntentStore.ts');
      const {listV2OwnerMigrationIntents}=await import(
        '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
      const owner={projectId:'6b00671500279e901846',
        ownerId:'synthetic_mixed_rescue_owner'};
      const root=new Uint8Array(32).fill(110);
      const plans=await listV2OwnerMigrationIntents(root,owner);
      const media=await readStagedOwnerEncryptedMedia(root,owner);
      const {auditSavedScratchOwnerLocalIntentParity}=await import(
        '/src/lib/e2ee/ownerRescueV2Staging.ts');
      const file=document.querySelector('#synthetic-mixed-audit-selected').files[0];
      const audit=await auditSavedScratchOwnerLocalIntentParity(root,owner,
        file,'k_'+'a'.repeat(32),1,{assertReady:async()=>{}});
      return {audit,ops:plans.map(p=>[p.rowId,p.opId,p.record.envelope.ct]),
        photos:await Promise.all(media.map(async p=>({
          rowId:p.encrypted.rowId,mediaId:p.encrypted.sealedMedia.manifest.mediaId,
          bytes:Array.from(new Uint8Array(
            await p.encrypted.sealedMedia.ciphertext.arrayBuffer())),
        })))};
    });
    expect(resumed.audit).toEqual({
      status:'verified-local-parity-only-no-cutover',rows:2,photos:1,
    });
    expect(resumed.ops).toEqual(result.stableOps);
    expect(resumed.photos).toEqual(result.stableMedia);
    const localTamper=await page.evaluate(async()=>{
      const {auditSavedScratchOwnerLocalIntentParity}=await import(
        '/src/lib/e2ee/ownerRescueV2Staging.ts');
      const owner={projectId:'6b00671500279e901846',
        ownerId:'synthetic_mixed_rescue_owner'};
      const root=new Uint8Array(32).fill(110),keyId='k_'+'a'.repeat(32);
      const file=document.querySelector('#synthetic-mixed-audit-selected').files[0];
      const gate={assertReady:async scope=>{
        if(scope.projectId!==owner.projectId||scope.ownerId!==owner.ownerId)
          throw Error('MFA synthetic owner mismatch');
      }};
      const audit=()=>auditSavedScratchOwnerLocalIntentParity(
        root,owner,file,keyId,1,gate);
      const edit=(name,storeName,mutate)=>new Promise((resolve,reject)=>{
        const open=indexedDB.open(name);
        open.onerror=()=>reject(open.error);
        open.onsuccess=()=>{
          const db=open.result,tx=db.transaction(storeName,'readwrite');
          const req=tx.objectStore(storeName).openCursor();
          let prior;
          req.onsuccess=()=>{
            if(!req.result){tx.abort();return;}
            prior=structuredClone(req.result.value);
            const changed=structuredClone(prior);
            mutate(changed);
            req.result.update(changed);
          };
          req.onerror=()=>tx.abort();
          tx.oncomplete=()=>{db.close();resolve(prior);};
          tx.onabort=tx.onerror=()=>{db.close();reject(tx.error??Error('tamper failed'));};
        };
      });
      const mediaDb='mosaic-e2ee-encrypted-owner-media-v1';
      const original=await edit(mediaDb,'sealed-photo-intents',value=>{
        value.ciphertext[0]^=1;
      });
      const mediaRejected=await audit().then(()=>false,()=>true);
      // Test-only restoration of original bytes so the second negative
      // check reaches owner-row HMAC instead of failing on media again.
      await edit(mediaDb,'sealed-photo-intents',value=>{
        value.ciphertext=original.ciphertext;
      });
      const resumedAudit=await audit();
      await edit('mosaic-e2ee-owner-v2-migration-intents-v1',
        'pending-migration-intents',value=>{
          value.tag='0'.repeat(64);
        });
      const rowRejected=await audit().then(()=>false,()=>true);
      return {mediaRejected,rowRejected,resumedAudit};
    });
    expect(localTamper).toEqual({
      mediaRejected:true,rowRejected:true,
      resumedAudit:{status:'verified-local-parity-only-no-cutover',rows:2,photos:1},
    });
    expect(writes).toBe(0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
