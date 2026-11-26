import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Atomic E2EE rescue proof requires localhost');
test.use({ignoreHTTPSErrors:true});

test('a second IndexedDB add error aborts the entire owner rescue batch',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {buildOwnerLocalRescueFile}=await import(
      '/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const {stageAuthenticatedScratchRescueFileV2}=await import(
      '/src/lib/e2ee/ownerRescueV2Staging.ts');
    const {listV2OwnerMigrationIntents}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_atomic_rollback_owner'};
    const root=new Uint8Array(32).fill(88),keyId='k_'+'e'.repeat(32);
    const rows=[
      {id:'rollback_task_a',userId:owner.ownerId,isDeleted:false,
        _deleted:false,_rev:'1-a',_meta:{lwt:1795665000000},
        _attachments:{},title:'PRIVATE ATOMIC A',visibility:'private',
        date:'2045-06-01'},
      {id:'rollback_task_b',userId:owner.ownerId,isDeleted:false,
        _deleted:true,_rev:'2-b',_meta:{lwt:1795665000001},
        _attachments:{},title:'PRIVATE ATOMIC B',visibility:'private',
        date:'2045-06-01'},
    ];
    const sources={rows:{readAll:async collection=>collection==='tasks'?rows:[]},
      images:{readAll:async()=>[]},
      queues:{length:0,key:()=>null,getItem:()=>null}};
    const gate={assertReady:async requested=>{
      if(requested.ownerId!==owner.ownerId)throw Error('owner mismatch');
    }};
    const saved=await buildOwnerLocalRescueFile(owner,root,keyId,gate,sources);
    const originalAdd=IDBObjectStore.prototype.add;
    let count=0,denied=false;
    try{
      IDBObjectStore.prototype.add=function(...args){
        if(this.name==='pending-migration-intents'&&++count===2)
          throw new Error('synthetic second-row quota abort');
        return originalAdd.apply(this,args);
      };
      denied=await stageAuthenticatedScratchRescueFileV2(
        root,owner,saved.file,keyId,1).then(()=>false,()=>true);
    }finally{IDBObjectStore.prototype.add=originalAdd;}
    const emptyAfterAbort=(await listV2OwnerMigrationIntents(root,owner)).length===0;
    const first=await stageAuthenticatedScratchRescueFileV2(
      root,owner,saved.file,keyId,1);
    const second=await stageAuthenticatedScratchRescueFileV2(
      root,owner,saved.file,keyId,1);
    const savedPlans=await listV2OwnerMigrationIntents(root,owner);
    const matching=first.plans.every(p=>
      savedPlans.some(x=>x.rowId===p.rowId&&x.opId===p.opId&&
        x.record.envelope.ct===p.record.envelope.ct));
    const noPlaintext=!JSON.stringify(savedPlans).includes('PRIVATE ATOMIC');
    return {denied,count,emptyAfterAbort,firstStored:first.stored,
      secondReused:second.reused,firstReused:first.reused,
      secondStored:second.stored,savedCount:savedPlans.length,
      matching,noPlaintext};
  });
  expect(result).toMatchObject({denied:true,count:2,emptyAfterAbort:true,
    firstStored:2,firstReused:0,secondStored:0,secondReused:2,
    savedCount:2,matching:true,noPlaintext:true});
  expect(writes).toBe(0);
});

test('two racing tabs cannot mix distinct owner rescue batches',async({page,context})=>{
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
  const attempt=async(p,tag)=>p.evaluate(async tag=>{
    const {buildOwnerLocalRescueFile}=await import(
      '/src/lib/e2ee/ownerLocalRescueBundle.ts');
    const {stageAuthenticatedScratchRescueFileV2}=await import(
      '/src/lib/e2ee/ownerRescueV2Staging.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_atomic_multitab_owner'};
    const root=new Uint8Array(32).fill(89),keyId='k_'+'d'.repeat(32);
    const raw=id=>({id,userId:owner.ownerId,isDeleted:false,
      _deleted:false,_rev:'1-'+tag,_meta:{lwt:1795665000000},
      _attachments:{},title:'PRIVATE-'+tag+'-'+id,visibility:'private',
      date:'2045-06-01'});
    const sources={
      rows:{readAll:async collection=>collection==='tasks'?
        [raw('same_row'),raw('unique_'+tag)]:[]},
      images:{readAll:async()=>[]},
      queues:{length:0,key:()=>null,getItem:()=>null},
    };
    const gate={assertReady:async()=>{}};
    const file=(await buildOwnerLocalRescueFile(
      owner,root,keyId,gate,sources)).file;
    try{
      const answer=await stageAuthenticatedScratchRescueFileV2(
        root,owner,file,keyId,1);
      return {tag,status:'stored',stored:answer.stored};
    }catch{return {tag,status:'blocked'};}
  },tag);
  const [a,b]=await Promise.all([attempt(page,'a'),attempt(second,'b')]);
  const verified=await page.evaluate(async()=>{
    const {listV2OwnerMigrationIntents}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts');
    const {openV2PrivateOwnerDocument,V2_OWNER_DOMAIN}=await import(
      '/src/lib/e2ee/ownerPrivateV2Contract.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_atomic_multitab_owner'};
    const root=new Uint8Array(32).fill(89);
    const plans=await listV2OwnerMigrationIntents(root,owner);
    const docs=await Promise.all(plans.map(p=>
      openV2PrivateOwnerDocument(root,owner,{
        ...owner,payloadDomain:V2_OWNER_DOMAIN[p.collection],
        rowId:p.rowId,keyId:p.record.envelope.kid,
        revision:p.record.envelope.revision,
      },p.collection,p.record)));
    return {count:plans.length,documents:docs.map(x=>({id:x.id,title:x.title})),
      distinctOps:new Set(plans.map(p=>p.opId)).size};
  });
  const successes=[a,b].filter(v=>v.status==='stored');
  expect(successes).toHaveLength(1);
  expect([a,b].filter(v=>v.status==='blocked')).toHaveLength(1);
  expect(successes[0].stored).toBe(2);
  expect(verified.count).toBe(2);
  expect(verified.distinctOps).toBe(2);
  expect(verified.documents).toEqual(expect.arrayContaining([
    {id:'same_row',title:'PRIVATE-'+successes[0].tag+'-same_row'},
    {id:'unique_'+successes[0].tag,
      title:'PRIVATE-'+successes[0].tag+'-unique_'+successes[0].tag},
  ]));
  expect(writes).toBe(0);
  await second.close();
});
