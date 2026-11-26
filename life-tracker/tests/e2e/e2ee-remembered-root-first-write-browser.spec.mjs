import {test,expect} from '@playwright/test';

const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Remembered-root regression requires isolated localhost');
test.use({ignoreHTTPSErrors:true});

test('remembered owner root is first-write-wins, scope isolated and monotonic across concurrent browser IndexedDB transactions',async({page})=>{
  let networkWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))networkWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {indexedDbRememberedRoots}=await import(
      '/src/lib/e2ee/rememberedRootIndexedDb.ts');
    const {generateAccountRoot}=await import('/src/lib/e2ee/coreCrypto.ts');
    const root=generateAccountRoot();
    const otherRoot=generateAccountRoot();
    const keyId='k_'+'a'.repeat(32),differentKeyId='k_'+'b'.repeat(32);
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_remembered_first_write'};
    const otherOwner={...owner,ownerId:'synthetic_remembered_other_owner'};
    const original=root.slice();
    const readEnvelope=async subject=>{
      const db=await new Promise((resolve,reject)=>{
        const q=indexedDB.open('mosaic-e2ee-account-keyring-v1',1);
        q.onsuccess=()=>resolve(q.result);
        q.onerror=()=>reject(q.error);
      });
      try{
        return await new Promise((resolve,reject)=>{
          let entry;
          const tx=db.transaction('remembered-roots','readonly');
          const q=tx.objectStore('remembered-roots')
            .get(JSON.stringify([subject.projectId,subject.ownerId]));
          q.onsuccess=()=>entry=q.result;
          tx.oncomplete=()=>resolve(entry&&{
            envelope:structuredClone(entry.envelope),generation:entry.generation,
            keyId:entry.keyId,
          });
          tx.onabort=tx.onerror=()=>reject(tx.error);
        });
      }finally{db.close();}
    };
    await indexedDbRememberedRoots.remember(owner,root,keyId,1);
    const first=await readEnvelope(owner);
    await indexedDbRememberedRoots.remember(owner,root,keyId,1);
    const unchanged=JSON.stringify(await readEnvelope(owner))===
      JSON.stringify(first);
    const wrongRoot=await indexedDbRememberedRoots.remember(
      owner,otherRoot,keyId,1).then(()=>false,()=>true);
    const wrongKey=await indexedDbRememberedRoots.remember(
      owner,root,differentKeyId,1).then(()=>false,()=>true);
    const rollback=await indexedDbRememberedRoots.remember(
      owner,root,keyId,0).then(()=>false,()=>true);
    const refusedAdvance=await indexedDbRememberedRoots.remember(
      owner,otherRoot,keyId,2).then(()=>false,()=>true);
    const stillOriginal=(await indexedDbRememberedRoots.unlock(owner)).root
      .every((v,i)=>v===original[i]);
    await indexedDbRememberedRoots.remember(otherOwner,otherRoot,keyId,1);
    const scoped=(await indexedDbRememberedRoots.unlock(otherOwner)).root
      .every((v,i)=>v===otherRoot[i]);
    const unaffected=(await indexedDbRememberedRoots.unlock(owner)).root
      .every((v,i)=>v===original[i]);
    await indexedDbRememberedRoots.remember(owner,root,keyId,2);
    const raised=(await indexedDbRememberedRoots.unlock(owner));
    const advanced=raised.generation===2&&raised.keyId===keyId&&
      raised.root.every((v,i)=>v===original[i]);
    const postAdvanceStale=await indexedDbRememberedRoots.remember(
      owner,root,keyId,1).then(()=>false,()=>true);
    const noRewrite=await readEnvelope(owner);
    await indexedDbRememberedRoots.remember(owner,root,keyId,2);
    const stableHigher=JSON.stringify(await readEnvelope(owner))===
      JSON.stringify(noRewrite);
    const mutationOwner={...owner,ownerId:'synthetic_remembered_mutation'};
    const source=generateAccountRoot(),capture=source.slice();
    const pending=indexedDbRememberedRoots.remember(
      mutationOwner,source,keyId,1);
    source.fill(0); // Caller-owned bytes change while WebCrypto is pending.
    await pending;
    const copiedBeforeAwait=(await indexedDbRememberedRoots.unlock(
      mutationOwner)).root.every((v,i)=>v===capture[i]);
    const racingOwner={...owner,ownerId:'synthetic_remembered_race'};
    const raceA=generateAccountRoot(),raceB=generateAccountRoot();
    const race=await Promise.allSettled([
      indexedDbRememberedRoots.remember(racingOwner,raceA,keyId,1),
      indexedDbRememberedRoots.remember(racingOwner,raceB,keyId,1),
    ]);
    const winners=race.filter(x=>x.status==='fulfilled').length;
    const rootRead=(await indexedDbRememberedRoots.unlock(racingOwner)).root;
    const winnerRoot=rootRead.every((v,i)=>v===raceA[i])||
      rootRead.every((v,i)=>v===raceB[i]);
    const rejected=await indexedDbRememberedRoots.remember(
      racingOwner,rootRead.every((v,i)=>v===raceA[i])?raceB:raceA,
      keyId,1).then(()=>false,()=>true);
    return {unchanged,wrongRoot,wrongKey,rollback,refusedAdvance,
      stillOriginal,scoped,unaffected,advanced,postAdvanceStale,
      stableHigher,copiedBeforeAwait,winners,winnerRoot,rejected,
      envelopeCiphertext:first.envelope.ct!=='',
    };
  });
  expect(result).toEqual({
    unchanged:true,wrongRoot:true,wrongKey:true,rollback:true,
    refusedAdvance:true,stillOriginal:true,scoped:true,unaffected:true,
    advanced:true,postAdvanceStale:true,stableHigher:true,
    copiedBeforeAwait:true,winners:1,winnerRoot:true,rejected:true,
    envelopeCiphertext:true,
  });
  expect(networkWrites).toBe(0);
});
