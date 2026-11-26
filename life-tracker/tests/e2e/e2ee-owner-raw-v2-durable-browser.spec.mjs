import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Encrypted owner staging test requires localhost');
test.use({ignoreHTTPSErrors:true});
test('raw owner plan survives retries, reload and same-row concurrent staging',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(async()=>{
    const {prepareAndStageScratchRawOwnerV2}=await import(
      '/src/lib/e2ee/ownerRawV2DurableIntent.ts'
    );
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_raw_durable_owner'};
    const root=new Uint8Array(32).fill(87),kid='k_'+'b'.repeat(32);
    const raw={id:'synthetic_durable_raw_task',userId:owner.ownerId,
      isDeleted:false,_deleted:true,_rev:'3-local',
      _meta:{lwt:1795663000000},_attachments:{},
      title:'SYNTHETIC-SECRET-DO-NOT-RESURRECT',
      date:'2045-11-09',visibility:'private'};
    const source=()=>({...raw,_meta:{...raw._meta},_attachments:{}});
    const [a,b]=await Promise.all([
      prepareAndStageScratchRawOwnerV2(root,owner,'tasks',source(),kid,4),
      prepareAndStageScratchRawOwnerV2(root,owner,'tasks',source(),kid,4),
    ]);
    const again=await prepareAndStageScratchRawOwnerV2(
      root,owner,'tasks',source(),kid,4);
    if([a,b].filter(x=>x.state==='stored').length!==1||
       [a,b].filter(x=>x.state==='reused').length!==1||
       again.state!=='reused')throw Error('Persistent first-write-wins failed');
    const stable=JSON.stringify(a.plan)===JSON.stringify(b.plan)&&
      JSON.stringify(a.plan)===JSON.stringify(again.plan);
    if(!stable||a.plan.record.routing.isDeleted!==true)
      throw Error('Original tombstone intent changed during retry');
    const changed={...source(),title:'CHANGED AFTER FIRST STAGE'};
    const changedDenied=await prepareAndStageScratchRawOwnerV2(
      root,owner,'tasks',changed,kid,4).then(()=>false,()=>true);
    const generationDenied=await prepareAndStageScratchRawOwnerV2(
      root,owner,'tasks',source(),kid,5).then(()=>false,()=>true);
    const ownerDenied=await prepareAndStageScratchRawOwnerV2(
      root,{...owner,ownerId:'other'},'tasks',source(),kid,4)
      .then(()=>false,()=>true);
    return {id:a.plan.rowId,ct:a.plan.record.envelope.ct,opId:a.plan.opId,
      stable,changedDenied,generationDenied,ownerDenied};
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const after=await page.evaluate(async rowId=>{
    const {prepareAndStageScratchRawOwnerV2}=await import(
      '/src/lib/e2ee/ownerRawV2DurableIntent.ts'
    );
    const {readV2OwnerMigrationIntent}=await import(
      '/src/lib/e2ee/ownerV2PendingIntentStore.ts'
    );
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_raw_durable_owner'};
    const root=new Uint8Array(32).fill(87),kid='k_'+'b'.repeat(32);
    const raw={id:'synthetic_durable_raw_task',userId:owner.ownerId,
      isDeleted:false,_deleted:true,_rev:'3-local',
      _meta:{lwt:1795663000000},_attachments:{},
      title:'SYNTHETIC-SECRET-DO-NOT-RESURRECT',
      date:'2045-11-09',visibility:'private'};
    const prior=await readV2OwnerMigrationIntent(root,owner,rowId);
    const next=await prepareAndStageScratchRawOwnerV2(root,owner,'tasks',raw,kid,4);
    if(!prior||next.state!=='reused')throw Error('Encrypted intent lost on reload');
    const stringified=JSON.stringify(next.plan);
    if(['SYNTHETIC-SECRET-DO-NOT-RESURRECT','synthetic_durable_raw_task',
      '2045-11-09'].some(secret=>stringified.includes(secret)))
      throw Error('Private value leaked');
    return {ct:prior.record.envelope.ct,opId:prior.opId,
      same:JSON.stringify(prior)===JSON.stringify(next.plan)};
  },before.id);
  expect(before).toMatchObject({stable:true,changedDenied:true,
    generationDenied:true,ownerDenied:true});
  expect(after).toEqual({ct:before.ct,opId:before.opId,same:true});
  expect(writes).toBe(0);
});
