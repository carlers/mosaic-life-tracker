import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Browser-backed source-only test for the current-origin *future* E2EE
// recovery helper. Not an installed older PWA, account migration or restore.
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Local rescue browser test must use a local Vite origin');
test.use({ignoreHTTPSErrors:true,acceptDownloads:true});

test('synthetic orphan photo and tombstone survive encrypted file save, reload, selection and AEAD readback',async({page})=>{
  let networkWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))networkWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const original=await page.evaluate(async()=>{
    const ID='localimg_'+'c'.repeat(26);
    const db=await new Promise((resolve,reject)=>{
      const q=indexedDB.open('mosaic_pending_images',1);
      q.onupgradeneeded=()=>{
        if(!q.result.objectStoreNames.contains('images'))
          q.result.createObjectStore('images',{keyPath:'id'});
      };
      q.onsuccess=()=>resolve(q.result);
      q.onerror=()=>reject(q.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('images','readwrite');
      tx.objectStore('images').put({
        id:ID,ownerUserId:'synthetic_browser_owner',
        createdAt:'2026-11-26T01:00:00.000Z',
        blob:new Blob(['SYNTHETIC-ONLY-ORPHAN-PHOTO'],{type:'image/png'}),
      });
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
    db.close();
    const owner={projectId:'synthetic_local_browser_only',ownerId:'synthetic_browser_owner'};
    const root=new Uint8Array(32).fill(71),keyId='k_'+'b'.repeat(32);
    localStorage.setItem('mosaic_social_outbox:entry:synthetic_browser_owner:offline_action',
      JSON.stringify({
        id:'offline_action',userId:owner.ownerId,action:'upsert_profile',
        op:{kind:'updateRow',secret:'SYNTHETIC-ONLY-SOCIAL-PENDING'},
        attempts:0,enqueuedAt:'2026-11-26T01:00:00.000Z',
      }));
    const {buildOwnerLocalRescueFile}=await import('/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const {indexedDbPendingImageSource}=await import('/src/lib/e2ee/ownerPendingImageRescue.ts');
    let gateChecks=0;
    const gate={assertReady:async subject=>{
      gateChecks++;
      if(subject.projectId!==owner.projectId || subject.ownerId!==owner.ownerId)
        throw new Error('Synthetic wrong account');
    }};
    const source={
      rows:{readAll:async(collection,userId)=>{
        if(userId!==owner.ownerId)throw new Error('Wrong owner row query');
        if(collection==='tasks')return [{
          id:'synthetic_tombstone',userId:owner.ownerId,isDeleted:true,
          date:'2045-01-03',title:'SYNTHETIC-ONLY-PRIVATE-TOMBSTONE',
        }];
        if(collection==='activityTaskLinks')return [{
          id:'synthetic_orphan_link',userId:owner.ownerId,isDeleted:true,
          activityId:'gone',taskId:'gone',
        }];
        return [];
      }},
      images:indexedDbPendingImageSource,queues:localStorage,
    };
    const result=await buildOwnerLocalRescueFile(owner,root,keyId,gate,source);
    if(gateChecks<3 || result.rows!==2 || result.media!==1 || result.pending!==1)
      throw new Error('Source count or authentication gate failure');
    const contents=await result.file.text();
    const secrets=['SYNTHETIC-ONLY-ORPHAN-PHOTO','SYNTHETIC-ONLY-SOCIAL-PENDING',
      'SYNTHETIC-ONLY-PRIVATE-TOMBSTONE','synthetic_tombstone',
      'synthetic_browser_owner','synthetic_orphan_link','2045-01-03'];
    if(secrets.some(s=>contents.includes(s)))throw new Error('Plaintext leaked into downloaded bytes');
    const anchor=document.createElement('a');
    const url=URL.createObjectURL(result.file);
    anchor.href=url;
    anchor.download=result.filename;
    anchor.textContent='Download synthetic encrypted rescue file';
    anchor.id='synthetic-file-download';
    document.body.appendChild(anchor);
    return {name:result.filename,rows:result.rows,media:result.media,pending:result.pending,
      ciphertextBytes:result.file.size,secretCount:secrets.length};
  });
  expect(original).toMatchObject({
    name:'mosaic-local-rescue-v2.enc',rows:2,media:1,pending:1,secretCount:7,
  });
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#synthetic-file-download').click(),
  ]);
  expect(download.suggestedFilename()).toBe(original.name);
  const folder=await mkdtemp(join(tmpdir(),'mosaic-e2ee-synthetic-rescue-'));
  const destination=join(folder,download.suggestedFilename());
  try{
    await download.saveAs(destination);
    const bytes=await readFile(destination);
    expect(bytes.byteLength).toBe(original.ciphertextBytes);
    const str=bytes.toString('utf8');
    for(const secret of ['SYNTHETIC-ONLY-ORPHAN-PHOTO','SYNTHETIC-ONLY-PRIVATE-TOMBSTONE',
      'SYNTHETIC-ONLY-SOCIAL-PENDING','synthetic_browser_owner'])expect(str).not.toContain(secret);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      const input=document.createElement('input');
      input.type='file';input.id='synthetic-rescue-selected-file';
      document.body.appendChild(input);
    });
    await page.locator('#synthetic-rescue-selected-file').setInputFiles(destination);
    const checked=await page.evaluate(async()=>{
      const selected=document.querySelector('#synthetic-rescue-selected-file').files[0];
      if(!selected)throw new Error('No downloaded file selected');
      const {verifyOwnerLocalRescueFile}=await import('/src/lib/e2ee/ownerLocalRescueBundle.ts');
      const owner={projectId:'synthetic_local_browser_only',ownerId:'synthetic_browser_owner'};
      const root=new Uint8Array(32).fill(71);
      const counts=await verifyOwnerLocalRescueFile(owner,root,selected);
      const {indexedDbPendingImageSource}=await import('/src/lib/e2ee/ownerPendingImageRescue.ts');
      const rows=await indexedDbPendingImageSource.readAll();
      if(!rows.some(r=>r.ownerUserId===owner.ownerId&&r.id==='localimg_'+'c'.repeat(26)))
        throw new Error('Reload discarded pending photo before separate readback');
      const denial=await verifyOwnerLocalRescueFile(
        {...owner,ownerId:'synthetic_wrong_owner'},root,selected).then(()=>false,()=>true);
      return {counts,denial,photoSurvived:true};
    });
    expect(checked).toEqual({
      counts:{rows:2,media:1,pending:1},denial:true,photoSurvived:true,
    });
    expect(networkWrites).toBe(0);
  }finally{
    await rm(folder,{recursive:true,force:true});
  }
});
