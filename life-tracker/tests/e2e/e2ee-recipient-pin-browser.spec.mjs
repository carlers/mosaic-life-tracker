import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Recipient pin persistence proof requires localhost');
test.use({ignoreHTTPSErrors:true});

test('manual recipient identity pin is root-encrypted and stable after reload',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const proof=await page.evaluate(async()=>{
    const gate=await import('/src/lib/e2ee/recipientIdentityGate.ts');
    const pins=await import('/src/lib/e2ee/recipientPinPersistence.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_recipient_pin_owner'};
    const root=new Uint8Array(32).fill(85),keyId='k_'+'c'.repeat(32);
    const pair=await crypto.subtle.generateKey(
      {name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
    const publicKey=btoa(String.fromCharCode(...raw)).replace(/\+/g,'-')
      .replace(/\//g,'_').replace(/=+$/,'');
    const recipient={projectId:owner.projectId,recipientId:'synthetic_friend',
      deviceId:'synthetic_browser_device',algorithm:'P-256',
      publicKey,identityEpoch:1};
    const before=await pins.readPinnedRecipientIdentity(root,owner,recipient,keyId);
    const manuallyEntered=await gate.candidateIdentityFingerprint(owner,recipient);
    const first=await pins.stageManuallyVerifiedRecipientPin(
      root,owner,recipient,manuallyEntered,keyId);
    const second=await pins.stageManuallyVerifiedRecipientPin(
      root,owner,recipient,manuallyEntered,keyId);
    const newEpoch=await pins.readPinnedRecipientIdentity(
      root,owner,{...recipient,identityEpoch:2},keyId)
      .then(()=>false,()=>true);
    const wrongKid=await pins.readPinnedRecipientIdentity(
      root,owner,recipient,'k_'+'d'.repeat(32))
      .then(()=>false,()=>true);
    const wrongRoot=await pins.readPinnedRecipientIdentity(
      new Uint8Array(32).fill(84),owner,recipient,keyId);
    const foreign=await pins.readPinnedRecipientIdentity(root,
      {...owner,ownerId:'synthetic_other'},recipient,keyId);
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('mosaic-e2ee-recipient-trust-pins-v1',1);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    let stored=[];
    try{
      stored=await new Promise((resolve,reject)=>{
        const entries=[],tx=db.transaction('recipient-pins','readonly');
        const req=tx.objectStore('recipient-pins').openCursor();
        req.onsuccess=()=>{
          const cursor=req.result;
          if(!cursor)return;
          entries.push({key:cursor.primaryKey,value:cursor.value});
          cursor.continue();
        };
        tx.oncomplete=()=>resolve(entries);
        tx.onerror=tx.onabort=()=>reject(tx.error);
      });
    }finally{db.close();}
    const serialized=JSON.stringify(stored);
    const metadataPrivate=![
      owner.ownerId,recipient.recipientId,recipient.deviceId,
      recipient.publicKey,manuallyEntered,
    ].some(secret=>serialized.includes(secret));
    return {recipient,firstState:first.state,secondState:second.state,
      firstPin:first.pin,secondPin:second.pin,
      beforeAbsent:before===null,newEpoch,wrongKid,
      wrongRootAbsent:wrongRoot===null,foreignAbsent:foreign===null,
      count:stored.length,metadataPrivate};
  });
  expect(proof).toMatchObject({firstState:'stored',secondState:'reused',
    beforeAbsent:true,newEpoch:true,wrongKid:true,wrongRootAbsent:true,
    foreignAbsent:true,count:1,metadataPrivate:true});
  expect(proof.firstPin).toEqual(proof.secondPin);
  await page.reload({waitUntil:'domcontentloaded'});
  const resumed=await page.evaluate(async recipient=>{
    const pins=await import('/src/lib/e2ee/recipientPinPersistence.ts');
    const gate=await import('/src/lib/e2ee/recipientIdentityGate.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_recipient_pin_owner'};
    const root=new Uint8Array(32).fill(85),keyId='k_'+'c'.repeat(32);
    const remembered=await pins.readPinnedRecipientIdentity(
      root,owner,recipient,keyId);
    const changedPair=await crypto.subtle.generateKey(
      {name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',
      changedPair.publicKey));
    const changedPublicKey=btoa(String.fromCharCode(...raw)).replace(/\+/g,'-')
      .replace(/\//g,'_').replace(/=+$/,'');
    const changed={...recipient,publicKey:changedPublicKey};
    const changedFingerprint=await gate.candidateIdentityFingerprint(owner,changed);
    const changedDenied=await pins.stageManuallyVerifiedRecipientPin(
      root,owner,changed,changedFingerprint,keyId).then(()=>false,()=>true);
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('mosaic-e2ee-recipient-trust-pins-v1',1);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    let original,storageKey;
    const change=mutate=>new Promise((resolve,reject)=>{
      const tx=db.transaction('recipient-pins','readwrite');
      const req=tx.objectStore('recipient-pins').openCursor();
      req.onsuccess=()=>{
        const cursor=req.result;
        if(cursor){
          storageKey=cursor.primaryKey;original=cursor.value;
          cursor.update(mutate(original));
        }
      };
      tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);
    });
    try{
      await change(row=>({...row,envelope:{
        ...row.envelope,ct:row.envelope.ct.replace(/^./,
          row.envelope.ct[0]==='A'?'B':'A'),
      }}));
      const tamperedDenied=await pins.readPinnedRecipientIdentity(
        root,owner,recipient,keyId).then(()=>false,()=>true);
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('recipient-pins','readwrite');
        tx.objectStore('recipient-pins').put(original,storageKey);
        tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);
      });
      const restored=await pins.readPinnedRecipientIdentity(
        root,owner,recipient,keyId);
      return {remembered,changedDenied,tamperedDenied,
        restored:JSON.stringify(restored)===JSON.stringify(remembered)};
    }finally{db.close();}
  },proof.recipient);
  expect(resumed.remembered).toEqual(proof.firstPin);
  expect(resumed).toMatchObject({changedDenied:true,tamperedDenied:true,
    restored:true});
  expect(writes).toBe(0);
});

test('racing recipient trust pins cannot silently overwrite a different key',async({page,context})=>{
  let writes=0;
  await context.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  const second=await context.newPage();
  await Promise.all([
    page.goto(BASE+'/login',{waitUntil:'domcontentloaded'}),
    second.goto(BASE+'/login',{waitUntil:'domcontentloaded'}),
  ]);
  const stage=p=>p.evaluate(async()=>{
    const gate=await import('/src/lib/e2ee/recipientIdentityGate.ts');
    const pins=await import('/src/lib/e2ee/recipientPinPersistence.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_recipient_race_owner'};
    const root=new Uint8Array(32).fill(86),keyId='k_'+'e'.repeat(32);
    const pair=await crypto.subtle.generateKey(
      {name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
    const publicKey=btoa(String.fromCharCode(...raw)).replace(/\+/g,'-')
      .replace(/\//g,'_').replace(/=+$/,'');
    const identity={projectId:owner.projectId,recipientId:'synthetic_friend',
      deviceId:'synthetic_racing_device',algorithm:'P-256',
      publicKey,identityEpoch:1};
    const fingerprint=await gate.candidateIdentityFingerprint(owner,identity);
    try{
      const saved=await pins.stageManuallyVerifiedRecipientPin(
        root,owner,identity,fingerprint,keyId);
      return {identity,status:saved.state,fingerprint};
    }catch{return {identity,status:'blocked',fingerprint};}
  });
  const [first,other]=await Promise.all([stage(page),stage(second)]);
  const winners=[first,other].filter(x=>x.status==='stored');
  const denied=[first,other].filter(x=>x.status==='blocked');
  expect(winners).toHaveLength(1);
  expect(denied).toHaveLength(1);
  const after=await page.evaluate(async input=>{
    const pins=await import('/src/lib/e2ee/recipientPinPersistence.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_recipient_race_owner'};
    const root=new Uint8Array(32).fill(86),keyId='k_'+'e'.repeat(32);
    const chosen=await pins.readPinnedRecipientIdentity(
      root,owner,input.winner.identity,keyId);
    const rejected=await pins.readPinnedRecipientIdentity(
      root,owner,input.loser.identity,keyId).then(()=>false,()=>true);
    return {chosen,rejected};
  },{winner:winners[0],loser:denied[0]});
  expect(after.chosen.fingerprint).toBe(winners[0].fingerprint);
  expect(after.rejected).toBe(true);
  expect(writes).toBe(0);
  await second.close();
});
