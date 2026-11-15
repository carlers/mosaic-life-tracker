import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertReviewedScratchDrift, assertPinnedSharedFunction, assertPendingPilotVariables, upsertVariable } from '../prepare-e2ee-scratch.mjs';

const DR = 'function message-action variable DR_PRIVACY_DELETION_REQUIRED: expected "false", got "true"';
const MEDIA = 'table media_uploads.reference_epoch: unexpected column';
const TASKS = 'table tasks permissions differ';
const CATEGORIES = 'table categories permissions differ';
const PENDING = 'function message-action has no live deployment';
const ACTIVE_ID = '6aeb6de15de54a8da174';

function requestWith({
  tasks=[],categories=[],column={key:'reference_epoch',type:'integer',required:false,default:0,min:0,status:'available'},
  dr={key:'DR_PRIVACY_DELETION_REQUIRED',value:'true',secret:false},
  active={deploymentId:ACTIVE_ID,live:false,enabled:true,schedule:'',interval:0},
}={}) {
  return async (method,path)=>{
    assert.equal(method,'GET');
    if(path.endsWith('/media_uploads')) return {columns:[column]};
    if(path.endsWith('/tasks')) return {$permissions:tasks};
    if(path.endsWith('/categories')) return {$permissions:categories};
    if(path.endsWith('/6aa8057f002a4c306fdd')) return {...active,vars:[dr]};
    throw Error('Unexpected admin request '+path);
  };
}

test('allows only read-back-verified, strictly less permissive Scratch drift',async()=>{
  await assertReviewedScratchDrift({
    request:requestWith(),diffs:[DR,MEDIA,TASKS,CATEGORIES],
  });
});

test('retains exact expected pilot missing resources only before migration',async()=>{
  await assertReviewedScratchDrift({
    request:requestWith(),
    diffs:['table private_diary_ciphertexts: missing'],
    allowedMissing:['table private_diary_ciphertexts: missing'],
  });
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith(),
    diffs:['table private_diary_ciphertexts: missing'],
  }),/Unreviewed Scratch drift/);
});

test('rejects all unrelated structural and ACL drift',async()=>{
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith(),
    diffs:['table diary permissions differ'],
  }),/Unreviewed Scratch drift/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({tasks:['read("any")']}),
    diffs:[TASKS],
  }),/only stricter/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({categories:['create("any")']}),
    diffs:[CATEGORIES],
  }),/only stricter/);
});

test('rejects incompatible extra columns and unknown metadata',async()=>{
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:true}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:false,default:1}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'varchar',required:false,default:0}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:false,default:0,min:-1}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:false,default:0,status:'processing'}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
});

test('requires proof that the privacy-deletion fence remains enabled',async()=>{
  for(const dr of [
    {key:'DR_PRIVACY_DELETION_REQUIRED',value:'false',secret:false},
    {key:'DR_PRIVACY_DELETION_REQUIRED',value:'true',secret:true},
    {key:'OTHER',value:'true',secret:false},
  ]){
    await assert.rejects(()=>assertReviewedScratchDrift({
      request:requestWith({dr}),diffs:[DR],
    }),/privacy deletion flag/);
  }
});


test('Appwrite live=false is allowed only during pinned, explicitly staged deployment',async()=>{
  const pinned={deploymentId:ACTIVE_ID,live:false,enabled:true,schedule:'',interval:0};
  assert.equal(assertPinnedSharedFunction(pinned,{allowPendingConfiguration:true}),pinned);
  assert.throws(()=>assertPinnedSharedFunction(pinned),/deployment, enabled state or timer/);
  assertPinnedSharedFunction({...pinned,live:true});
  for(const bad of [
    {...pinned,deploymentId:'other'},
    {...pinned,deploymentId:''},
    {...pinned,enabled:false},
    {...pinned,schedule:'* * * * *'},
    {...pinned,interval:60},
  ]){
    assert.throws(()=>assertPinnedSharedFunction(bad,{allowPendingConfiguration:true}),/refusing rollout/);
  }
});

test('staging-only live=false drift requires independent exact active deployment readback',async()=>{
  const args={request:requestWith(),diffs:[PENDING,DR]};
  await assert.rejects(()=>assertReviewedScratchDrift(args),/Unreviewed Scratch drift/);
  await assertReviewedScratchDrift({...args,allowPendingDeployment:true});
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({active:{deploymentId:'other',live:false,enabled:true}}),
    diffs:[PENDING],allowPendingDeployment:true,
  }),/refusing rollout/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({active:{deploymentId:ACTIVE_ID,live:true,enabled:true}}),
    diffs:[PENDING],allowPendingDeployment:true,
  }),/live-state readback mismatch/);
});

test('pending restart requires disabled pilot and empty allowlist only',()=>{
  const ok=[
    {key:'MOSAIC_E2EE_PILOT_ENABLED',value:'false',secret:false},
    {key:'MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS',value:'',secret:false},
  ];
  assert.doesNotThrow(()=>assertPendingPilotVariables(ok));
  for(const invalid of [
    ok.slice(1),
    [...ok,ok[0]],
    ok.map(v=>v.key==='MOSAIC_E2EE_PILOT_ENABLED'?{...v,value:'true'}:v),
    ok.map(v=>v.key==='MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS'?{...v,value:'user1'}:v),
    ok.map(v=>v.key==='MOSAIC_E2EE_PILOT_ENABLED'?{...v,secret:true}:v),
  ]){
    assert.throws(()=>assertPendingPilotVariables(invalid),/disabled and allowlist empty/);
  }
});

test('idempotent Function variable upserts never write unchanged values',async()=>{
  const variables=[
    {$id:'pilot-flag',key:'MOSAIC_E2EE_PILOT_ENABLED',value:'false',secret:false},
    {$id:'pilot-allow',key:'MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS',value:'',secret:false},
  ];
  let writes=0,reads=0;
  const funcs={
    listVariables:async()=>{reads++;return {variables,total:variables.length};},
    updateVariable:async()=>{writes++;throw Error('unexpected update');},
    createVariable:async()=>{writes++;throw Error('unexpected create');},
  };
  await upsertVariable(funcs,'MOSAIC_E2EE_PILOT_ENABLED','false');
  await upsertVariable(funcs,'MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS','');
  assert.equal(writes,0);
  assert.equal(reads,4);
});
