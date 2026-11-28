import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Owner ciphertext port rehearsal requires localhost');
test.use({ignoreHTTPSErrors:true});

test('synthetic Function-shaped port verifies exact saved task+diary ciphertext without ack',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const first=await page.evaluate(async()=>{
    const {buildOwnerLocalRescueFile}=await import(
      '/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const {stageAuthenticatedScratchRescueFileV2}=await import(
      '/src/lib/e2ee/ownerRescueV2Staging.ts');
    const {listV2OwnerMigrationIntents}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const {rehearsePersistedOwnerV2RoundTrip}=await import(
      '/src/lib/e2ee/ownerV2TransportRehearsal.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_owner_remote_roundtrip'};
    const root=new Uint8Array(32).fill(123),keyId='k_'+'a'.repeat(32);
    const rows={
      tasks:[{id:'tombstone_saved',userId:owner.ownerId,isDeleted:false,
        _deleted:true,_rev:'2-t',_meta:{lwt:1795665000000},_attachments:{},
        title:'PRIVATE-DELETED-SECRET',visibility:'private',date:'2045-02-03'}],
      diary:[{id:'entry_saved',userId:owner.ownerId,isDeleted:false,
        _deleted:false,_rev:'1-d',_meta:{lwt:1795665000001},_attachments:{},
        content:'PRIVATE-DIARY-SECRET',visibility:'private',date:'2045-02-03'}],
    };
    const gate={assertReady:async(scope)=>{
      if(scope.ownerId!==owner.ownerId||scope.projectId!==owner.projectId)
        throw Error('Wrong owner session');
    }};
    const sources={rows:{readAll:async c=>rows[c]||[]},
      images:{readAll:async()=>[]},
      queues:{length:0,key:()=>null,getItem:()=>null}};
    const file=(await buildOwnerLocalRescueFile(
      owner,root,keyId,gate,sources)).file;
    const staged=await stageAuthenticatedScratchRescueFileV2(
      root,owner,file,keyId,1);
    if(staged.stored!==2)throw Error('Incomplete original local staging');
    const initial=await listV2OwnerMigrationIntents(root,owner);
    const remote=new Map(),sent=[];
    let lostFirst=true;
    const port={
      put:async p=>{
        const current=remote.get(p.record.rowId);
        sent.push(JSON.stringify(p));
        if(current&&JSON.stringify(current.record)!==JSON.stringify(p.record))
          return {status:409,body:{error:'conflict'}};
        if(!current)remote.set(p.record.rowId,{
          opId:p.opId,record:structuredClone(p.record),generation:p.expectedGeneration,
        });
        if(lostFirst){lostFirst=false;throw Error('synthetic reply lost after PUT');}
        return {status:200,body:{ok:true,status:current?'duplicate':'created',
          revision:p.record.envelope.revision}};
      },
      get:async s=>{
        const row=remote.get(s.rowId);
        if(!row||row.opId!==s.expectedOpId)
          return {status:409,body:{error:'unknown op'}};
        return {status:200,body:{ok:true,record:structuredClone(row.record),
          opId:row.opId,keyGeneration:row.generation}};
      },
    };
    const firstPlan=staged.plans[0];
    const lostDenied=await rehearsePersistedOwnerV2RoundTrip(
      root,owner,firstPlan.rowId,keyId,1,port,gate).then(()=>false,()=>true);
    const retried=await rehearsePersistedOwnerV2RoundTrip(
      root,owner,firstPlan.rowId,keyId,1,port,gate);
    const other=await rehearsePersistedOwnerV2RoundTrip(
      root,owner,staged.plans[1].rowId,keyId,1,port,gate);
    const after=await listV2OwnerMigrationIntents(root,owner);
    const snapshots=(plans)=>plans.map(p=>({
      rowId:p.rowId,ct:p.record.envelope.ct,opId:p.opId,
      revision:p.record.envelope.revision,
    })).sort((a,b)=>a.rowId.localeCompare(b.rowId));
    const unchanged=JSON.stringify(snapshots(initial))===
      JSON.stringify(snapshots(after));
    const identicalRetry=sent.length===3&&sent[0]===sent[1];
    const portText=JSON.stringify(sent);
    const secretsAbsent=!['PRIVATE-DELETED-SECRET','PRIVATE-DIARY-SECRET',
      'tombstone_saved','entry_saved','2045-02-03','visibility']
      .some(secret=>portText.includes(secret));
    const failed={};
    const bad=(portOverride,key=root,scope=owner,gen=1,required=gate)=>
      rehearsePersistedOwnerV2RoundTrip(
        key,scope,firstPlan.rowId,keyId,gen,portOverride,required)
        .then(()=>false,()=>true);
    failed.wrongRoot=await bad(port,new Uint8Array(32).fill(1));
    failed.wrongOwner=await bad(port,root,{...owner,ownerId:'intruder'});
    failed.wrongEpoch=await bad(port,root,owner,2);
    failed.lostAck=lostDenied;
    failed.forced403=await bad({...port,put:async()=>({
      status:403,body:{error:'unauthorized'}})});
    failed.falsePut=await bad({...port,put:async()=>({
      status:200,body:{ok:true,status:'created',revision:'r_'+'0'.repeat(32)}})});
    failed.fakeOpId=await bad({...port,get:async s=>({
      status:200,body:{ok:true,record:remote.get(s.rowId).record,
        opId:'o_'+'0'.repeat(32),keyGeneration:1}})});
    failed.fakeGeneration=await bad({...port,get:async s=>({
      status:200,body:{ok:true,record:remote.get(s.rowId).record,
        opId:remote.get(s.rowId).opId,keyGeneration:2}})});
    failed.fakeCiphertext=await bad({...port,get:async s=>{
      const row=remote.get(s.rowId),record=structuredClone(row.record);
      record.envelope.ct='A'+record.envelope.ct.slice(1);
      return {status:200,body:{ok:true,record,
        opId:row.opId,keyGeneration:row.generation}};
    }});
    failed.extraPlaintext=await bad({...port,get:async s=>({
      status:200,body:{ok:true,record:remote.get(s.rowId).record,
        opId:remote.get(s.rowId).opId,keyGeneration:1,
        plaintext:'SECRET-LEAK'}})});
    failed.gateDenied=await bad(port,root,owner,1,{
      assertReady:async()=>{throw Error('MFA expired');},
    });

    const {rehearsePersistedOwnerV2TwoPassParity}=await import(
      '/src/lib/e2ee/ownerV2ScanParity.ts');
    let scanCalls=0;
    const scan=async request=>{
      scanCalls++;
      const records=[...remote.values()]
        .filter(v=>v.record.collection===request.collection)
        .sort((a,b)=>a.record.rowId.localeCompare(b.record.rowId));
      const next=records.filter(v=>
        request.cursor===null||v.record.rowId>request.cursor)
        .slice(0,request.limit).map(v=>({
          rowId:v.record.rowId,record:structuredClone(v.record),
          opId:v.opId,keyGeneration:v.generation,
          serverUpdatedAt:'2026-11-28T07:00:00.000Z',
        }));
      return {status:200,body:{
        ok:true,rows:next,complete:false,
        nextCursor:next.length===request.limit?next.at(-1).rowId:null,
      }};
    };
    const parity=await rehearsePersistedOwnerV2TwoPassParity(
      root,owner,keyId,1,1,{scan},gate);
    const parityObserved=parity.status===
      'two-pass-original-ciphertext-observed-not-acknowledged'&&
      parity.complete===false&&parity.rows===2&&
      parity.collections===2&&parity.pages===8&&scanCalls===8;
    const cannotProve=async adapter=>
      rehearsePersistedOwnerV2TwoPassParity(
        root,owner,keyId,1,1,{scan:adapter},gate)
        .then(()=>false,()=>true);
    const missingRemote=await cannotProve(async request=>
      request.collection==='tasks'?
        {status:200,body:{ok:true,rows:[],complete:false,nextCursor:null}}:
        scan(request));
    const foreignCiphertext=await cannotProve(async request=>{
      const response=await scan(request);
      if(response.body.rows.length&&request.collection==='tasks')
        response.body.rows[0].rowId='p_'+'e'.repeat(32);
      return response;
    });
    const changedCiphertext=await cannotProve(async request=>{
      const response=await scan(request);
      if(response.body.rows.length&&request.collection==='tasks')
        response.body.rows[0].record.envelope.ct=
          (response.body.rows[0].record.envelope.ct.startsWith('A')?'B':'A')+
          response.body.rows[0].record.envelope.ct.slice(1);
      return response;
    });
    const changedOp=await cannotProve(async request=>{
      const response=await scan(request);
      if(response.body.rows.length&&request.collection==='tasks')
        response.body.rows[0].opId='o_'+'0'.repeat(32);
      return response;
    });
    let secondPassCall=0;
    const changedSecondPass=await cannotProve(async request=>{
      const response=await scan(request);
      secondPassCall++;
      if(secondPassCall>4&&response.body.rows.length)
        response.body.rows[0].serverUpdatedAt='2026-11-28T07:01:00.000Z';
      return response;
    });
    const wrongScanRoot=await rehearsePersistedOwnerV2TwoPassParity(
      new Uint8Array(32).fill(1),owner,keyId,1,1,{scan},gate)
      .then(()=>false,()=>true);
    const wrongScanEpoch=await rehearsePersistedOwnerV2TwoPassParity(
      root,owner,keyId,2,1,{scan},gate)
      .then(()=>false,()=>true);
    const deniedParity=[missingRemote,foreignCiphertext,changedCiphertext,
      changedOp,changedSecondPass,wrongScanRoot,wrongScanEpoch]
      .every(Boolean);
    const final=await listV2OwnerMigrationIntents(root,owner);
    return {
      retried,other,lostDenied,identicalRetry,secretsAbsent,unchanged,
      parityObserved,deniedParity,
      allFailed:Object.values(failed).every(Boolean),
      pendingStillTwo:final.length===2&&JSON.stringify(snapshots(final))===
        JSON.stringify(snapshots(initial)),
      originals:snapshots(initial),remoteCount:remote.size,
    };
  });
  expect(first).toMatchObject({
    lostDenied:true,identicalRetry:true,secretsAbsent:true,unchanged:true,
    allFailed:true,pendingStillTwo:true,remoteCount:2,
    parityObserved:true,deniedParity:true,
    retried:{status:'readback-verified-not-acknowledged',putStatus:'duplicate'},
    other:{status:'readback-verified-not-acknowledged',putStatus:'created'},
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const after=await page.evaluate(async()=>{
    const {listV2OwnerMigrationIntents}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_owner_remote_roundtrip'};
    const root=new Uint8Array(32).fill(123);
    const plans=await listV2OwnerMigrationIntents(root,owner);
    return plans.map(p=>({rowId:p.rowId,ct:p.record.envelope.ct,
      opId:p.opId,revision:p.record.envelope.revision}))
      .sort((a,b)=>a.rowId.localeCompare(b.rowId));
  });
  expect(after).toEqual(first.originals);
  expect(writes).toBe(0);
});
