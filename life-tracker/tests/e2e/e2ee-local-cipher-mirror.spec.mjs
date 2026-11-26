import {expect,test} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Local encrypted mirror test requires local Vite host');
test.use({ignoreHTTPSErrors:true});

test('owner-only ciphertext mirror survives browser reload, rejects stale revisions, and never persists plaintext',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const first=await page.evaluate(async()=>{
    const {deriveMigratedOwnerRowId}=await import('/src/lib/e2ee/coreCrypto.ts');
    const {applyVerifiedPageToLocalCipherMirror,readLocalCipherOwnerRecord}=
      await import('/src/lib/e2ee/ownerLocalCipherMirror.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_local_mirror_owner'};
    const session={root:new Uint8Array(32).fill(27),
      keyId:'k_'+'a'.repeat(32),generation:1};
    const document={id:'PRIVATE-SEMANTIC-ID',userId:owner.ownerId,
      title:'PRIVATE-TITLE-CACHE-SENTINEL',date:'2025-01-17',memo:'private-notes',
      visibility:'private',isDeleted:false,__e2eeRevision:'r_'+'b'.repeat(32)};
    const rowId=await deriveMigratedOwnerRowId(session.root,owner,'task',document.id);
    const change={rowId,document,serverUpdatedAt:'2026-11-26T02:00:00.000Z'};
    await applyVerifiedPageToLocalCipherMirror(owner,session,'tasks',[change]);
    const decoded=await readLocalCipherOwnerRecord(owner,session,'tasks',rowId);
    const req=indexedDB.open('mosaic-e2ee-owner-local-cipher-mirror-v1',1);
    const persisted=await new Promise((resolve,reject)=>{
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('ciphertext-rows','readonly');
        const rows=tx.objectStore('ciphertext-rows').getAll();
        rows.onsuccess=()=>resolve(rows.result);
        rows.onerror=()=>reject(new Error('read failed'));
        tx.oncomplete=()=>db.close();
      };
      req.onerror=()=>reject(new Error('db failed'));
    });
    const serialized=JSON.stringify(persisted);
    for(const secret of ['PRIVATE-SEMANTIC-ID','PRIVATE-TITLE-CACHE-SENTINEL','private-notes','2025-01-17']){
      if(serialized.includes(secret))throw new Error('Private content persisted in plaintext');
    }
    const localRevision=persisted[0]?.localRevision;
    await applyVerifiedPageToLocalCipherMirror(owner,session,'tasks',[change]);
    const again=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('mosaic-e2ee-owner-local-cipher-mirror-v1',1);
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('ciphertext-rows','readonly');
        const rows=tx.objectStore('ciphertext-rows').getAll();
        rows.onsuccess=()=>resolve(rows.result);
        tx.oncomplete=()=>db.close();
      };
      req.onerror=()=>reject(new Error('read failed'));
    });
    return {rowId,decoded,localRevision,againRevision:again[0]?.localRevision,rows:persisted.length};
  });
  expect(first.rows).toBe(1);
  expect(first.decoded.document.title).toBe('PRIVATE-TITLE-CACHE-SENTINEL');
  expect(first.localRevision).toBe(first.againRevision);
  await page.reload({waitUntil:'domcontentloaded'});
  const second=await page.evaluate(async(rowId)=>{
    const {readLocalCipherOwnerRecord,applyVerifiedPageToLocalCipherMirror}=
      await import('/src/lib/e2ee/ownerLocalCipherMirror.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_local_mirror_owner'};
    const session={root:new Uint8Array(32).fill(27),
      keyId:'k_'+'a'.repeat(32),generation:1};
    const decoded=await readLocalCipherOwnerRecord(owner,session,'tasks',rowId);
    const other=await readLocalCipherOwnerRecord({...owner,ownerId:'another'},session,'tasks',rowId);
    const wrongRoot=await readLocalCipherOwnerRecord(owner,
      {...session,root:new Uint8Array(32).fill(7)},'tasks',rowId)
      .then(()=>false,()=>true);
    const oldChange={...decoded,serverUpdatedAt:'2026-11-26T01:00:00.000Z'};
    const staleRejected=await applyVerifiedPageToLocalCipherMirror(
      owner,session,'tasks',[oldChange]).then(()=>false,()=>true);
    return {decoded,other,wrongRoot,staleRejected};
  },first.rowId);
  expect(second.decoded.document.id).toBe('PRIVATE-SEMANTIC-ID');
  expect(second.other).toBeNull();
  expect(second.wrongRoot).toBe(true);
  expect(second.staleRejected).toBe(true);
  expect(writes).toBe(0);
});


test('a tampered cached ciphertext cannot be silently replaced by a newer feed page',async({page})=>{
  let backendWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))backendWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {deriveMigratedOwnerRowId}=await import('/src/lib/e2ee/coreCrypto.ts');
    const {applyVerifiedPageToLocalCipherMirror,readLocalCipherOwnerRecord}=
      await import('/src/lib/e2ee/ownerLocalCipherMirror.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_corrupt_cache_owner'};
    const session={root:new Uint8Array(32).fill(39),
      keyId:'k_'+'b'.repeat(32),generation:1};
    const original={id:'hidden_original',userId:owner.ownerId,
      title:'PRIVATE FIRST TITLE',date:'2025-02-14',visibility:'private',
      isDeleted:false,__e2eeRevision:'r_'+'b'.repeat(32)};
    const rowId=await deriveMigratedOwnerRowId(session.root,owner,'task',original.id);
    await applyVerifiedPageToLocalCipherMirror(owner,session,'tasks',[{
      rowId,document:original,serverUpdatedAt:'2026-11-26T02:00:00.000Z',
    }]);
    const key=JSON.stringify([owner.projectId,owner.ownerId,'tasks',rowId]);
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('mosaic-e2ee-owner-local-cipher-mirror-v1',1);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(new Error('IDB open failed'));
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('ciphertext-rows','readwrite');
      const store=tx.objectStore('ciphertext-rows');
      const read=store.get(key);
      read.onsuccess=()=>{
        const old=read.result;
        store.put({...old,envelope:{...old.envelope,ct:'AAAA'}},key);
      };
      tx.oncomplete=()=>resolve();
      tx.onabort=tx.onerror=()=>reject(new Error('synthetic tamper failed'));
    });
    db.close();
    const newer={...original,title:'PRIVATE SECOND TITLE',
      __e2eeRevision:'r_'+'c'.repeat(32)};
    const denied=await applyVerifiedPageToLocalCipherMirror(owner,session,'tasks',[{
      rowId,document:newer,serverUpdatedAt:'2026-11-26T02:01:00.000Z',
    }]).then(()=>false,()=>true);
    const readDenied=await readLocalCipherOwnerRecord(owner,session,'tasks',rowId)
      .then(()=>false,()=>true);
    return {denied,readDenied};
  });
  expect(result).toEqual({denied:true,readDenied:true});
  expect(backendWrites).toBe(0);
});
