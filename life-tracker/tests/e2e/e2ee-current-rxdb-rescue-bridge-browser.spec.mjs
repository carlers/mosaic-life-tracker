import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Actual RxDB E2EE rescue integration requires localhost');
test.use({ignoreHTTPSErrors:true,acceptDownloads:true});

test('actual RxDB internal deletion -> saved encrypted rescue -> original intents -> verified mock server readback',async({page})=>{
  let appwriteWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))
      appwriteWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const captured=await page.evaluate(async()=>{
    const {runActualRxDbEncryptedRescueFixture}=await import(
      '/tests/e2e/fixtures/e2eeCurrentOriginRxDbBridgeFixture.ts'
    );
    return runActualRxDbEncryptedRescueFixture();
  });
  expect(captured).toMatchObject({
    rows:3,media:0,pending:0,name:'mosaic-local-rescue-v2.enc',
  });
  expect(captured.checks).toBeGreaterThanOrEqual(3);
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#rxdb-e2ee-saved-file').click(),
  ]);
  expect(download.suggestedFilename()).toBe(captured.name);
  const directory=await mkdtemp(join(tmpdir(),'mosaic-actual-rxdb-e2ee-'));
  const downloaded=join(directory,download.suggestedFilename());
  try{
    await download.saveAs(downloaded);
    const fileBytes=await readFile(downloaded);
    expect(fileBytes.byteLength).toBe(captured.bytes);
    const encrypted=fileBytes.toString('utf8');
    for(const plaintext of ['SECRET-RXDB-ALIVE','SECRET-RXDB-DELETED',
      'SECRET-RXDB-DIARY','SECRET-FOREIGN-OWNER','original_alive',
      'original_deleted','original_diary','foreign_task','2045-02-11'])
      expect(encrypted).not.toContain(plaintext);
    // Do NOT stage from the in-memory Blob: a distinct user-selected
    // downloaded file must make the complete authenticated trip.
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      const input=document.createElement('input');
      input.type='file';input.id='rxdb-e2ee-selected-file';
      document.body.appendChild(input);
    });
    await page.locator('#rxdb-e2ee-selected-file').setInputFiles(downloaded);
    const staged=await page.evaluate(async()=>{
      const {stageSelectedScratchOwnerRescueFile}=await import(
        '/src/lib/e2ee/ownerCurrentOriginRescueBridge.ts'
      );
      const {listV2OwnerMigrationIntents}=await import(
        '/src/lib/e2ee/ownerV2PendingIntentStore.ts'
      );
      const {openV2PrivateOwnerDocument,V2_OWNER_DOMAIN}=await import(
        '/src/lib/e2ee/ownerPrivateV2Contract.ts'
      );
      const {rehearsePersistedOwnerV2RoundTrip}=await import(
        '/src/lib/e2ee/ownerV2TransportRehearsal.ts'
      );
      const scope={projectId:'6b00671500279e901846',
        ownerId:'synthetic_real_rxdexie_owner'};
      const root=new Uint8Array(32).fill(128),keyId='k_'+'f'.repeat(32);
      const file=document.querySelector('#rxdb-e2ee-selected-file').files[0];
      if(!file)throw new Error('No real selected saved file');
      const gate={assertReady:async owner=>{
        if(owner.projectId!==scope.projectId||owner.ownerId!==scope.ownerId)
          throw new Error('Synthetic current unlocked MFA rejected');
      }};
      const wrongProject=await stageSelectedScratchOwnerRescueFile(
        root,{...scope,projectId:'6ae94a2100014d01f5ed'},
        file,keyId,1,gate).then(()=>false,()=>true);
      const wrongRoot=await stageSelectedScratchOwnerRescueFile(
        new Uint8Array(32).fill(99),scope,
        file,keyId,1,gate).then(()=>false,()=>true);
      const wrongFile=new File([await file.arrayBuffer()],
        'wrong-saved-file.enc');
      const wrongName=await stageSelectedScratchOwnerRescueFile(
        root,scope,wrongFile,keyId,1,gate).then(()=>false,()=>true);
      const first=await stageSelectedScratchOwnerRescueFile(
        root,scope,file,keyId,1,gate);
      const again=await stageSelectedScratchOwnerRescueFile(
        root,scope,file,keyId,1,gate);
      const plans=await listV2OwnerMigrationIntents(root,scope);
      const opened=await Promise.all(plans.map(plan=>
        openV2PrivateOwnerDocument(root,scope,{
          ...scope,rowId:plan.rowId,
          keyId,revision:plan.record.envelope.revision,
          payloadDomain:V2_OWNER_DOMAIN[plan.collection],
        },plan.collection,plan.record)));
      const deleted=opened.some(doc=>doc.id==='original_deleted'&&
        doc.isDeleted===true&&doc.title==='SECRET-RXDB-DELETED');
      const alive=opened.some(doc=>doc.id==='original_alive'&&
        doc.isDeleted===false&&doc.title==='SECRET-RXDB-ALIVE');
      const diary=opened.some(doc=>doc.id==='original_diary'&&
        doc.content==='SECRET-RXDB-DIARY');
      const originals=plans.map(plan=>({
        id:plan.rowId,opId:plan.opId,ct:plan.record.envelope.ct,
      })).sort((a,b)=>a.id.localeCompare(b.id));
      const remote=new Map(),writes=[];
      let loseResponse=true;
      const port={
        put:async input=>{
          const old=remote.get(input.record.rowId);
          writes.push(JSON.stringify(input));
          if(old&&(old.opId!==input.opId||
             JSON.stringify(old.record)!==JSON.stringify(input.record)))
            return {status:409,body:{error:'conflict'}};
          if(!old)remote.set(input.record.rowId,{
            opId:input.opId,record:structuredClone(input.record),
            generation:input.expectedGeneration,
          });
          if(loseResponse){
            loseResponse=false;
            throw new Error('Synthetic response lost after original remote PUT');
          }
          return {status:200,body:{ok:true,status:old?'duplicate':'created',
            revision:input.record.envelope.revision}};
        },
        get:async selector=>{
          const row=remote.get(selector.rowId);
          if(!row||row.opId!==selector.expectedOpId)
            return {status:409,body:{error:'conflict'}};
          return {status:200,body:{
            ok:true,record:structuredClone(row.record),
            opId:row.opId,keyGeneration:row.generation,
          }};
        },
      };
      const lost=await rehearsePersistedOwnerV2RoundTrip(
        root,scope,plans[0].rowId,keyId,1,port,gate).then(()=>false,()=>true);
      const retried=await rehearsePersistedOwnerV2RoundTrip(
        root,scope,plans[0].rowId,keyId,1,port,gate);
      const rest=await Promise.all(plans.slice(1).map(p=>
        rehearsePersistedOwnerV2RoundTrip(
          root,scope,p.rowId,keyId,1,port,gate)));
      const current=await listV2OwnerMigrationIntents(root,scope);
      const after=current.map(p=>({
        id:p.rowId,opId:p.opId,ct:p.record.envelope.ct,
      })).sort((a,b)=>a.id.localeCompare(b.id));
      const plainPort=JSON.stringify(writes);
      return {
        wrongProject,wrongRoot,wrongName,
        stored:first.stored,reused:again.reused,
        lost,identicalRetry:writes[0]===writes[1],
        retried:retried.status,retryType:retried.putStatus,
        accepted:rest.length,remoteCount:remote.size,
        deleted,alive,diary,
        noForeign:opened.every(doc=>doc.id!=='foreign_task'),
        noPlaintextInRemote:!['SECRET-RXDB-ALIVE','SECRET-RXDB-DELETED',
          'SECRET-RXDB-DIARY','original_alive','original_deleted',
          'original_diary','2045-02-11'].some(s=>plainPort.includes(s)),
        unchanged:JSON.stringify(after)===JSON.stringify(originals),
        originals,
      };
    });
    expect(staged).toMatchObject({
      wrongProject:true,wrongRoot:true,wrongName:true,
      stored:3,reused:3,lost:true,identicalRetry:true,
      retried:'readback-verified-not-acknowledged',retryType:'duplicate',
      accepted:2,remoteCount:3,deleted:true,alive:true,diary:true,
      noForeign:true,noPlaintextInRemote:true,unchanged:true,
    });
    // Exact HMAC/authenticated ciphertext and original op IDs survive reload.
    await page.reload({waitUntil:'domcontentloaded'});
    const persisted=await page.evaluate(async()=>{
      const {listV2OwnerMigrationIntents}=await import(
        '/src/lib/e2ee/ownerV2PendingIntentStore.ts'
      );
      const owner={projectId:'6b00671500279e901846',
        ownerId:'synthetic_real_rxdexie_owner'};
      const root=new Uint8Array(32).fill(128);
      const plans=await listV2OwnerMigrationIntents(root,owner);
      return plans.map(p=>({
        id:p.rowId,opId:p.opId,ct:p.record.envelope.ct,
      })).sort((a,b)=>a.id.localeCompare(b.id));
    });
    expect(persisted).toEqual(staged.originals);
    expect(appwriteWrites).toBe(0);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});
