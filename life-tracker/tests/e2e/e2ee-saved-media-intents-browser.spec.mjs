import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Saved owner media proof requires localhost');
test.use({ignoreHTTPSErrors:true,acceptDownloads:true});

test('actual saved encrypted photos stage durable original bytes and reject new-randomized retries',async({page})=>{
  let serverWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))
      serverWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const original=await page.evaluate(async()=>{
    const {buildOwnerLocalRescueFile}=await import(
      '/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_saved_media_owner'};
    const root=new Uint8Array(32).fill(151),keyId='k_'+'e'.repeat(32);
    const images=[
      {id:'localimg_'+'a'.repeat(26),ownerUserId:owner.ownerId,
        blob:new Blob(['SYNTHETIC PRIVATE PHOTO A'],{type:'image/png'}),
        createdAt:'2026-11-26T00:00:00.000Z'},
      {id:'localimg_'+'b'.repeat(26),ownerUserId:owner.ownerId,
        blob:new Blob(['SYNTHETIC PRIVATE PHOTO B'],{type:'image/webp'}),
        createdAt:'2026-11-26T00:00:00.001Z'},
      {id:'localimg_'+'c'.repeat(26),ownerUserId:'foreign',
        blob:new Blob(['SYNTHETIC FOREIGN PHOTO'],{type:'image/png'}),
        createdAt:'2026-11-26T00:00:00.002Z'},
    ];
    const gate={assertReady:async scope=>{
      if(scope.projectId!==owner.projectId||scope.ownerId!==owner.ownerId)
        throw Error('Synthetic owner MFA denied');
    }};
    const sources={
      rows:{readAll:async()=>[]},
      images:{readAll:async()=>images},
      queues:{length:0,key:()=>null,getItem:()=>null},
    };
    const saved=await buildOwnerLocalRescueFile(
      owner,root,keyId,gate,sources);
    const raw=await saved.file.text();
    if(saved.rows!==0||saved.media!==2||saved.pending!==0||
       ['SYNTHETIC PRIVATE PHOTO A','SYNTHETIC PRIVATE PHOTO B',
        'SYNTHETIC FOREIGN PHOTO','localimg_','synthetic_saved_media_owner',
        'image/png','image/webp'].some(s=>raw.includes(s)))
      throw Error('Saved photo manifest leaked or incomplete');
    const url=URL.createObjectURL(saved.file);
    const anchor=document.createElement('a');
    anchor.id='saved-e2ee-media-download';
    anchor.href=url;anchor.download=saved.filename;
    anchor.textContent='Download original encrypted photos';
    document.body.appendChild(anchor);
    return {name:saved.filename,bytes:saved.file.size,media:saved.media};
  });
  expect(original).toMatchObject({name:'mosaic-local-rescue-v2.enc',media:2});
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#saved-e2ee-media-download').click(),
  ]);
  const directory=await mkdtemp(join(tmpdir(),'mosaic-e2ee-media-'));
  const filename=join(directory,download.suggestedFilename());
  try{
    await download.saveAs(filename);
    const bytes=await readFile(filename);
    expect(bytes.byteLength).toBe(original.bytes);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      const input=document.createElement('input');
      input.id='saved-e2ee-media-input';input.type='file';
      document.body.appendChild(input);
    });
    await page.locator('#saved-e2ee-media-input').setInputFiles(filename);
    const result=await page.evaluate(async()=>{
      const {stageSelectedSavedOwnerEncryptedMedia,
        readStagedOwnerEncryptedMedia}=await import(
        '/src/lib/e2ee/ownerSavedMediaIntentStore.ts');
      const {buildOwnerLocalRescueFile}=await import(
        '/src/lib/e2ee/ownerLocalRescueBundle.ts');
      const owner={projectId:'6b00671500279e901846',
        ownerId:'synthetic_saved_media_owner'};
      const root=new Uint8Array(32).fill(151),keyId='k_'+'e'.repeat(32);
      const file=document.querySelector('#saved-e2ee-media-input').files[0];
      const gate={assertReady:async scope=>{
        if(scope.ownerId!==owner.ownerId||scope.projectId!==owner.projectId)
          throw Error('Synthetic owner MFA denied');
      }};
      const stage=()=>stageSelectedSavedOwnerEncryptedMedia(
        root,owner,file,keyId,gate);
      const first=await stage();
      const retry=await stage();
      const original=await readStagedOwnerEncryptedMedia(root,owner);
      const entries=await Promise.all(original.map(async e=>({
        localId:e.localId,mediaId:e.encrypted.sealedMedia.manifest.mediaId,
        cipher:Array.from(new Uint8Array(
          await e.encrypted.sealedMedia.ciphertext.arrayBuffer())),
      })));
      let serverSeen=null;
      const upload=async e=>{
        const ciphertext=new Uint8Array(await
          e.encrypted.sealedMedia.ciphertext.arrayBuffer());
        const mediaId=e.encrypted.sealedMedia.manifest.mediaId;
        if(serverSeen&&serverSeen.mediaId!==mediaId)
          throw Error('Randomized upload ID incorrectly changed');
        if(!serverSeen)serverSeen={mediaId,bytes:[...ciphertext]};
        if(JSON.stringify(serverSeen.bytes)!==JSON.stringify([...ciphertext]))
          throw Error('Original ciphertext changed');
        throw Error('Synthetic response lost after ciphertext put');
      };
      const lost=await upload(original[0]).then(()=>false,()=>true);
      const after=await readStagedOwnerEncryptedMedia(root,owner);
      const lostRetry=await upload(after[0]).then(()=>false,()=>true);
      const sameBytes=entries.every(x=>after.some(y=>
        x.localId===y.localId&&x.mediaId===
          y.encrypted.sealedMedia.manifest.mediaId));
      const wrongRoot=await stageSelectedSavedOwnerEncryptedMedia(
        new Uint8Array(32).fill(152),owner,file,keyId,gate)
        .then(()=>false,()=>true);
      const wrongOwner=await stageSelectedSavedOwnerEncryptedMedia(
        root,{...owner,ownerId:'synthetic_foreign'},file,keyId,gate)
        .then(()=>false,()=>true);
      const changed=JSON.parse(await file.text());
      changed.media[0].ciphertextBase64='A'+
        changed.media[0].ciphertextBase64.slice(1);
      const altered=new File([JSON.stringify(changed)],file.name);
      const tampered=await stageSelectedSavedOwnerEncryptedMedia(
        root,owner,altered,keyId,gate).then(()=>false,()=>true);
      const photos=[
        {id:'localimg_'+'a'.repeat(26),ownerUserId:owner.ownerId,
          blob:new Blob(['SYNTHETIC PRIVATE PHOTO A'],{type:'image/png'}),
          createdAt:'2026-11-26T00:00:00.000Z'},
        {id:'localimg_'+'b'.repeat(26),ownerUserId:owner.ownerId,
          blob:new Blob(['SYNTHETIC PRIVATE PHOTO B'],{type:'image/webp'}),
          createdAt:'2026-11-26T00:00:00.001Z'},
      ];
      const newBundle=await buildOwnerLocalRescueFile(
        owner,root,keyId,gate,{rows:{readAll:async()=>[]},
          images:{readAll:async()=>photos},
          queues:{length:0,key:()=>null,getItem:()=>null}});
      const randomized=new File([await newBundle.file.arrayBuffer()],file.name);
      const refuseRandomized=await stageSelectedSavedOwnerEncryptedMedia(
        root,owner,randomized,keyId,gate).then(()=>false,()=>true);
      // This IDB table must contain no original photo ID or clear source MIME.
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('mosaic-e2ee-encrypted-owner-media-v1',1);
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      const saved=await new Promise((resolve,reject)=>{
        const rows=[],tx=db.transaction('sealed-photo-intents','readonly');
        const req=tx.objectStore('sealed-photo-intents').openCursor();
        req.onsuccess=()=>{
          const row=req.result;
          if(!row)return;
          rows.push({key:row.primaryKey,
            data:{...row.value,ciphertext:Array.from(row.value.ciphertext)}});
          row.continue();
        };
        tx.oncomplete=()=>resolve(rows);
        tx.onerror=tx.onabort=()=>reject(tx.error);
      });
      db.close();
      const raw=JSON.stringify(saved);
      const noPlaintext=!['localimg_','synthetic_saved_media_owner',
        'SYNTHETIC PRIVATE PHOTO A','SYNTHETIC PRIVATE PHOTO B',
        'image/png','image/webp'].some(s=>raw.includes(s));
      return {first,retry,lost,lostRetry,sameBytes,wrongRoot,wrongOwner,
        tampered,refuseRandomized,noPlaintext,photos:saved.length,
        original:entries.map(e=>({id:e.localId,mediaId:e.mediaId,
          cipher:e.cipher})).sort((a,b)=>a.id.localeCompare(b.id))};
    });
    expect(result).toMatchObject({
      first:{stored:2,reused:0,total:2,status:'local-ciphertext-staged-not-uploaded'},
      retry:{stored:0,reused:2,total:2},lost:true,lostRetry:true,
      sameBytes:true,wrongRoot:true,wrongOwner:true,tampered:true,
      refuseRandomized:true,noPlaintext:true,photos:2,
    });
    await page.reload({waitUntil:'domcontentloaded'});
    const final=await page.evaluate(async()=>{
      const {readStagedOwnerEncryptedMedia}=await import(
        '/src/lib/e2ee/ownerSavedMediaIntentStore.ts');
      const owner={projectId:'6b00671500279e901846',
        ownerId:'synthetic_saved_media_owner'};
      const root=new Uint8Array(32).fill(151);
      const data=await readStagedOwnerEncryptedMedia(root,owner);
      return Promise.all(data.map(async e=>({
        id:e.localId,mediaId:e.encrypted.sealedMedia.manifest.mediaId,
        cipher:Array.from(new Uint8Array(
          await e.encrypted.sealedMedia.ciphertext.arrayBuffer())),
      })));
    });
    expect(final.sort((a,b)=>a.id.localeCompare(b.id))).toEqual(result.original);
    expect(serverWrites).toBe(0);
  }finally{await rm(directory,{recursive:true,force:true});}
});
