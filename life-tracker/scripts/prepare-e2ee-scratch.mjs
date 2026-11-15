#!/usr/bin/env node
/** #1662 — fail-closed, synthetic-only Oracle Scratch operator. */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Account, Client, Functions, ID, Permission, Query, Role, TablesDB, Users } from 'node-appwrite';
import {
  createAppwriteAdminRequest, diffFunction, diffTable, flagValue,
  inspectManagedBackend, readBackendDefinitions, readFunctionDefinition,
} from './lib/appwrite-backend.mjs';
import { migrateE2eeDiaryPilotBackend } from './migrate-e2ee-pilot.mjs';
import { activateFunctionVersion, deployFunctionVersion } from './appwrite-function.mjs';
import { MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const PROJECT = '6ae94a2100014d01f5ed';
const ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
const FUNCTION = '6aa8057f002a4c306fdd';
const EXPECTED_ACTIVE = '6aeb6de15de54a8da174';
const RECOVER_FIXTURE_SUFFIX = 'bd0c80af4199';

const MANAGED = ['private_diary_ciphertexts','account_crypto_envelopes'];
const FLAG = 'MOSAIC_E2EE_PILOT_ENABLED';
const ALLOW = 'MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS';
const PREVIEW = 'https://mosaic-life-tracker-git-chatgpt-3aee12-carls-projects-72516fde.vercel.app/e2ee-pilot';
const fail = message => { throw new Error(message); };
const git = (...args) => execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const eq = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function verifyCode(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha) || git('rev-parse','HEAD')!==sha ||
      git('status','--porcelain','--','appwrite-functions/message-action')!=='')
    fail('Refusing unpinned SHA or dirty Function checkout');
  // Dev can advance for unrelated UI work; require byte-exact shared Function
  // compatibility against the fetched dev tip instead of a stale whole-tree SHA.
  const checkedDev = git('rev-parse','refs/remotes/origin/dev');
  if (!/^[a-f0-9]{40}$/.test(checkedDev)) fail('Invalid fetched dev SHA');
  const prefix='life-tracker/appwrite-functions/message-action/';
  const localPrefix='appwrite-functions/message-action/';
  const changed=git('diff','--name-only','refs/remotes/origin/dev','HEAD','--',localPrefix)
    .split('\n').filter(Boolean).sort();
  const expected=['account-deletion.js','e2ee-pilot.js','function.config.json','main.js']
    .map(file=>prefix+file).sort();
  if (!eq(changed,expected)) fail('Unreviewed shared Function file drift');
  const [main,deletion,config]=await Promise.all([
    readFile(localPrefix+'main.js','utf8'),
    readFile(localPrefix+'account-deletion.js','utf8'),
    readFile(localPrefix+'function.config.json','utf8'),
  ]);
  const baselineMain=git('show','refs/remotes/origin/dev:'+prefix+'main.js')+'\n';
  const strippedMain=main
    .replace("const { handleE2eeDiaryPilot } = require('./e2ee-pilot');\n",'')
    .replace("      case 'e2ee_diary_pilot':\n        result = await handleE2eeDiaryPilot(tablesDB, callerId, payload, req.headers['x-appwrite-user-jwt']);\n        break;\n",'');
  if (strippedMain!==baselineMain) fail('Shared handler differs from reviewed dev');
  const baselineDeletion=git('show','refs/remotes/origin/dev:'+prefix+'account-deletion.js')+'\n';
  const strippedDeletion=deletion.replace(
    "'diary', 'private_diary_ciphertexts', 'account_crypto_envelopes', 'settings'",
    "'diary', 'settings'");
  if (strippedDeletion!==baselineDeletion) fail('Account deletion differs from reviewed dev');
  const currentConfig=JSON.parse(config);
  delete currentConfig.nonSecretVariables[FLAG];
  delete currentConfig.nonSecretVariables[ALLOW];
  const baselineConfig=JSON.parse(git('show','refs/remotes/origin/dev:'+prefix+'function.config.json'));
  if (!eq(currentConfig,baselineConfig)) fail('Function config differs from reviewed dev');
  console.log('PASS: pinned Git source matches dev '+checkedDev.slice(0,12)+' shared Function + E2EE additions');
}

async function verifyPilotTables(request,tables) {
  for (const id of MANAGED) {
    const expected=MOSAIC_TABLES.find(item=>item.id===id);
    let drift=diffTable(await request('GET','/tablesdb/life_tracker/tables/'+id),expected);
    for(let attempt=0;drift.length&&attempt<60;attempt++){
      await sleep(1000);
      drift=diffTable(await request('GET','/tablesdb/life_tracker/tables/'+id),expected);
    }
    if(drift.length)fail('Ciphertext schema drift: '+drift.join('; '));
    const rows=await tables.listRows({databaseId:'life_tracker',tableId:id,queries:[Query.limit(1)]});
    if(rows.total!==0||rows.rows?.length!==0)fail('Pilot table is not empty');
  }
  console.log('PASS: owner-isolated E2EE tables exactly match schema and have zero rows');
}

async function listVariables(functions) {
  const data=await functions.listVariables({functionId:FUNCTION});
  if(!Array.isArray(data.variables)||(data.total??data.variables.length)!==data.variables.length)
    fail('Incomplete Function variable inventory');
  for(const key of [FLAG,ALLOW])if(data.variables.filter(v=>v.key===key).length>1)
    fail('Duplicate pilot variable');
  return data.variables;
}

export async function upsertVariable(functions,key,value) {
  const variable=(await listVariables(functions)).find(v=>v.key===key);
  if(variable?.secret===true)fail('Pilot variable has unexpected secret classification');
  // Appwrite invalidates live=true even when an unchanged environment
  // variable is updated. Make repeated Scratch preparation idempotent.
  if(variable&&variable.value!==value)await functions.updateVariable({
    functionId:FUNCTION,variableId:variable.$id,key,value,secret:false,
  });
  else if(!variable)await functions.createVariable({
    functionId:FUNCTION,variableId:ID.unique(),key,value,secret:false,
  });
  const result=(await listVariables(functions)).find(v=>v.key===key);
  if(!result||result.value!==value||result.secret===true)fail('Variable readback failed: '+key);
}


/**
 * The shared Scratch backend can have additive work from other Previews.
 * Permit only the four OBSERVED pre-existing differences after independently
 * checking their actual security-relevant metadata; never mutate them.
 * All other differences, including broadened table ACLs, fail closed.
 */
const KNOWN_SCRATCH_DRIFT = new Set([
  'table media_uploads.reference_epoch: unexpected column',
  'table tasks permissions differ',
  'table categories permissions differ',
  'function message-action variable DR_PRIVACY_DELETION_REQUIRED: expected "false", got "true"',
]);

const STALE_DEPLOYMENT = 'function message-action has no live deployment';

export function assertPinnedSharedFunction(current,{
  allowPendingConfiguration=false,expectedDeploymentId=EXPECTED_ACTIVE,
}={}) {
  if(current?.deploymentId!==expectedDeploymentId||current.enabled!==true||
     (current.schedule??'')!==''||(current.interval??0)!==0||
     (current.live!==true&&!(allowPendingConfiguration&&current.live===false)))
    fail('Scratch shared Function deployment, enabled state or timer changed; refusing rollout');
  return current;
}

export function assertPendingPilotVariables(variables) {
  const flag=variables.filter(v=>v.key===FLAG);
  const allow=variables.filter(v=>v.key===ALLOW);
  if(flag.length!==1||flag[0].secret===true||flag[0].value!=='false'||
     allow.length!==1||allow[0].secret===true||allow[0].value!=='')
    fail('Pending Function config cannot be resumed: pilot must be disabled and allowlist empty');
}

export async function assertReviewedScratchDrift({
  request,diffs,allowedMissing=[],allowPendingDeployment=false,
  expectedDeploymentId=EXPECTED_ACTIVE,
}) {
  const missing = new Set(allowedMissing);
  const unexpected=diffs.filter(item=>
    !KNOWN_SCRATCH_DRIFT.has(item)&&!missing.has(item)&&
    !(allowPendingDeployment&&item===STALE_DEPLOYMENT));
  if(unexpected.length)fail('Unreviewed Scratch drift before write: '+unexpected.join('; '));

  const observations = new Set(diffs);
  if(observations.has(STALE_DEPLOYMENT)) {
    // Appwrite's live=false means changes await redeployment, not that
    // the previously selected deployment ceased to exist.
    if(!allowPendingDeployment)fail('Pending Function configuration is not activated');
    const active=await request('GET','/functions/'+FUNCTION);
    assertPinnedSharedFunction(active,{
      allowPendingConfiguration:true,expectedDeploymentId,
    });
    if(active.live!==false)fail('Function live-state readback mismatch');
  }
  if(observations.has('table media_uploads.reference_epoch: unexpected column')) {
    const table=await request('GET','/tablesdb/life_tracker/tables/media_uploads');
    const column=table?.columns?.find(c=>c.key==='reference_epoch');
    // #1478 PR #1690 migrated an optional integer with default=0, min=0.
    // Its non-null default is intentional and must not be treated as drift.
    if(!column || column.type!=='integer' || column.required!==false ||
       column.default!==0 ||
       (column.min!==null && column.min!==undefined && column.min!==0) ||
       (column.status && column.status!=='available')) {
      fail('Unexpected media_uploads.reference_epoch contract; expected optional integer default=0, min=0, available');
    }
  }
  for(const tableId of ['tasks','categories']) {
    if(observations.has('table '+tableId+' permissions differ')) {
      const table=await request('GET','/tablesdb/life_tracker/tables/'+tableId);
      const permissions=table?.$permissions??table?.permissions;
      if(!Array.isArray(permissions)||permissions.length!==0) {
        fail('Unexpected '+tableId+' table permissions; only stricter [] permissions are acceptable');
      }
    }
  }
  const drFlag='function message-action variable DR_PRIVACY_DELETION_REQUIRED: expected "false", got "true"';
  if(observations.has(drFlag)){
    const current=await request('GET','/functions/'+FUNCTION);
    const matches=(current?.vars??[]).filter(v=>v.key==='DR_PRIVACY_DELETION_REQUIRED');
    if(matches.length!==1||matches[0].value!=='true'||matches[0].secret===true)
      fail('Scratch DR privacy deletion flag not verified as enforced true');
  }
  const known=[...observations].filter(item=>KNOWN_SCRATCH_DRIFT.has(item));
  if(known.length)console.log('PASS: '+known.length+' observed shared Scratch differences verified without altering them');
}

async function inspect(request,enabled,ownerId,{
  allowPendingDeployment=false,expectedDeploymentId=EXPECTED_ACTIVE,
}={}) {
  const definitions=await readBackendDefinitions();
  definitions.functions['message-action'].config.nonSecretVariables[FLAG]=enabled?'true':'false';
  definitions.functions['message-action'].config.nonSecretVariables[ALLOW]=ownerId;
  const report=await inspectManagedBackend({request,definitions,includeDr:false});
  await assertReviewedScratchDrift({
    request,diffs:report.diffs,allowPendingDeployment,expectedDeploymentId,
  });
  console.log('PASS: managed Scratch schema, indexes and Function config'+
    (allowPendingDeployment?' (redeploy pending)':' (deployment current)'));
}


export async function verifyActivatedPilot({
  functions,expectedDeploymentId,ownerId,probe,tries=4,sleepMs=250,
}) {
  if(!/^[A-Za-z0-9._-]{10,36}$/.test(expectedDeploymentId) ||
     !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(ownerId))
    fail('Invalid pinned deployment or owner');
  for(let attempt=0;attempt<tries;attempt++){
    const current=await functions.get({functionId:FUNCTION});
    if(current.deploymentId!==expectedDeploymentId||current.enabled!==true||
       (current.schedule??'')!==''||(current.interval??0)!==0||
       typeof current.live!=='boolean')
      fail('Activated Function does not match exact pinned deployment, enabled state and timer');
    const deployment=await functions.getDeployment({functionId:FUNCTION,deploymentId:expectedDeploymentId});
    if(!['ready','active'].includes(deployment.status))
      fail('Activated deployment is not ready/active');
    const vars=await listVariables(functions);
    const flag=vars.filter(v=>v.key===FLAG);
    const allowed=vars.filter(v=>v.key===ALLOW);
    if(flag.length!==1||flag[0].value!=='true'||flag[0].secret===true||
       allowed.length!==1||allowed[0].value!==ownerId||allowed[0].secret===true)
      fail('Activated pilot variables do not match one disposable owner');
    try {
      await probe(ownerId);
      return {deploymentId:expectedDeploymentId,live:current.live};
    }catch(error) {
      if(attempt+1===tries)throw error;
      await sleep(sleepMs);
    }
  }
  fail('Activated pilot was not verified');
}

export async function loadPreviousDisposableAccount(users,tables) {
  const file=join(homedir(),'.local','state','mosaic',
    'e2ee-pilot-'+RECOVER_FIXTURE_SUFFIX+'.txt');
  let st;
  try{st=await lstat(file);}catch(error){
    if(error?.code==='ENOENT')return null;
    throw error;
  }
  if(!st.isFile()||(st.mode&0o777)!==0o600||
     (typeof process.getuid==='function'&&st.uid!==process.getuid()))
    fail('Existing synthetic fixture permissions or owner mismatch');
  const content=await readFile(file,'utf8');
  const field=label=>content.split('\n').find(line=>line.startsWith(label+': '))?.slice(label.length+2);
  const email=field('Email'),password=field('Password'),ownerId=field('Appwrite owner ID');
  if(!content.startsWith('SCRATCH ONLY — never use personal data\n')||
     email!=='mosaic.e2ee.'+RECOVER_FIXTURE_SUFFIX+'@example.com'||
     !/^[A-Za-z0-9_-]{36}$/.test(password??'')||
     !/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(ownerId??'')||
     field('Preview')!==PREVIEW)
    fail('Existing synthetic fixture does not match reviewed Scratch owner');
  const user=await users.get({userId:ownerId});
  const profile=await tables.getRow({databaseId:'life_tracker',tableId:'profiles',rowId:'profile_'+ownerId});
  if(user.$id!==ownerId||user.email!==email||user.name!=='Mosaic E2EE Scratch Test'||
     profile?.user_id!==ownerId||profile?.deleted!==false||
     profile?.username!=='e2ee_'+RECOVER_FIXTURE_SUFFIX)
    fail('Existing synthetic owner/profile readback mismatch');
  console.log('PASS: existing disposable owner reused; no second account created');
  return {ownerId,email,password};
}

export async function probePilotExecution({ownerId,email,password}) {
  const response=await fetch(ENDPOINT+'/account/sessions/email',{
    method:'POST',redirect:'error',
    headers:{'x-appwrite-project':PROJECT,'content-type':'application/json'},
    body:JSON.stringify({email,password}),
  });
  if(!response.ok)fail('Disposable owner login denied by Scratch');
  const name='a_session_'+PROJECT;
  const cookies=response.headers.getSetCookie?.()??[];
  const cookie=cookies.find(x=>x.startsWith(name+'='));
  const sessionData=cookie?null:await response.json().catch(()=>null);
  const secret=cookie?decodeURIComponent(cookie.slice(name.length+1).split(';')[0]):
    (typeof sessionData?.secret==='string'?sessionData.secret:'');
  if(!secret||secret.length>8192)fail('Disposable owner login session unavailable');
  const client=new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setSession(secret);
  const account=new Account(client);
  try {
    const user=await account.get();
    if(user.$id!==ownerId||user.mfa!==false)
      fail('Disposable owner identity or MFA-disabled preflight mismatched');
    const r=await new Functions(client).createExecution({
      functionId:FUNCTION,
      body:JSON.stringify({action:'e2ee_diary_pilot',operation:'list'}),
      async:false,method:'POST',
    });
    let body;
    try{body=JSON.parse(r.responseBody??'');}catch{fail('Pilot runtime response was not JSON');}
    if(r.status!=='completed'||r.responseStatusCode!==401||
       body?.error!=='Fully authenticated session required')
      fail('Pilot runtime failed exact read-only MFA-denial verification');
  }finally{
    await account.deleteSession({sessionId:'current'}).catch(()=>{});
  }
}

async function newDisposableAccount(users,tables) {
  const suffix=randomBytes(6).toString('hex');
  const email='mosaic.e2ee.'+suffix+'@example.com';
  const password=randomBytes(27).toString('base64url');
  const user=await users.create({
    userId:ID.unique(),email,password,name:'Mosaic E2EE Scratch Test',
  });
  if(!user.$id||user.email!==email)fail('Disposable account readback failed');
  const now=new Date().toISOString();
  const profileId='profile_'+user.$id;
  if(profileId.length>36)fail('Generated fixture profile row ID too long');
  await tables.createRow({
    databaseId:'life_tracker',tableId:'profiles',rowId:profileId,
    data:{
      user_id:user.$id,username:'e2ee_'+suffix,
      display_name:'Mosaic E2EE Scratch Test',
      created_at:now,updated_at:now,deleted:false,
    },
    permissions:[
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ],
  });
  const directory=join(homedir(),'.local','state','mosaic');
  await mkdir(directory,{recursive:true,mode:0o700});
  const file=join(directory,'e2ee-pilot-'+suffix+'.txt');
  const handle=await open(file,'wx',0o600);
  try{
    await handle.writeFile([
      'SCRATCH ONLY — never use personal data',
      'Email: '+email,'Password: '+password,'Appwrite owner ID: '+user.$id,
      'Preview: '+PREVIEW,
      'Enable TOTP MFA on this disposable account before testing.',
      'Never enter real Diary content into this pilot.','',
    ].join('\n'));
  }finally{await handle.close();}
  console.log('Disposable test login: '+file+' (mode 0600; password not printed)');
  return {ownerId:user.$id,email,password};
}

async function main() {
  const argv=process.argv.slice(2);
  const sha=flagValue(argv,'--git-sha');
  if(flagValue(argv,'--project')!==PROJECT||flagValue(argv,'--endpoint')!==ENDPOINT||
     flagValue(argv,'--confirm-project')!==PROJECT||
     (process.env.APPWRITE_PROJECT_ID&&process.env.APPWRITE_PROJECT_ID!==PROJECT)||
     (process.env.APPWRITE_ENDPOINT&&process.env.APPWRITE_ENDPOINT!==ENDPOINT)||
     !process.env.APPWRITE_API_KEY)fail('Exact Scratch target, confirmation and API key required');
  await verifyCode(sha);
  const client=new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(process.env.APPWRITE_API_KEY);
  const functions=new Functions(client),users=new Users(client),tables=new TablesDB(client);
  const request=createAppwriteAdminRequest({
    endpoint:ENDPOINT,projectId:PROJECT,apiKey:process.env.APPWRITE_API_KEY,
  });
  const getActive=async({allowPendingConfiguration=false}={})=>{
    const current=await functions.get({functionId:FUNCTION});
    assertPinnedSharedFunction(current,{allowPendingConfiguration});
    const definition=await readFunctionDefinition('message-action');
    const drift=diffFunction(current,definition.config,'message-action');
    if(drift.length)fail('Shared Function config drift: '+drift.join('; '));
    return current;
  };
  const currentBefore=await getActive({allowPendingConfiguration:true});
  if(currentBefore.live===false) {
    // The preceding run configured disabled E2EE pilot variables, which
    // marks Appwrite's old deployment configuration stale until redeploy.
    assertPendingPilotVariables(await listVariables(functions));
    console.log('PASS: original shared deployment intact; disabled pilot vars await redeploy');
  }
  const preliminary=await inspectManagedBackend({
    request,definitions:await readBackendDefinitions(),includeDr:false,
  });
  const allowedMissing=new Set([
    ...MANAGED.map(id=>'table '+id+': missing'),
    'function message-action variable '+FLAG+': missing',
    'function message-action variable '+ALLOW+': missing',
  ]);
  await assertReviewedScratchDrift({
    request,diffs:preliminary.diffs,allowedMissing:[...allowedMissing],
    allowPendingDeployment:currentBefore.live===false,
  });
  const variables=await listVariables(functions);
  for(const key of [FLAG,ALLOW]){
    const old=variables.find(v=>v.key===key);
    if(old&&(old.secret||old.value!==(key===FLAG?'false':'')))
      fail('Pilot already active or variable drift');
  }
  console.log('PASS: shared Scratch Function pinned, pilot disabled, no unrelated drift');
  const existing=[];
  for(const id of MANAGED){
    try{existing.push((await request('GET','/tablesdb/life_tracker/tables/'+id)).$id);}
    catch(e){if(e.status!==404)throw e;}
  }
  if(existing.length===1)fail('Partially provisioned pilot schema: inspect manually');
  await migrateE2eeDiaryPilotBackend({request,log:console.log});
  await verifyPilotTables(request,tables);
  await upsertVariable(functions,FLAG,'false');
  await upsertVariable(functions,ALLOW,'');
  await inspect(request,false,'',{allowPendingDeployment:true});
  const fixture=(await loadPreviousDisposableAccount(users,tables))||
    (await newDisposableAccount(users,tables));
  const ownerId=fixture.ownerId;
  let activationAttempted=false;
  let stagedDeploymentId='';
  try{
    await upsertVariable(functions,ALLOW,ownerId);
    await upsertVariable(functions,FLAG,'true');
    const definition=await readFunctionDefinition('message-action');
    const deployed=await deployFunctionVersion({functions,definition,functionId:FUNCTION,gitSha:sha});
    stagedDeploymentId=deployed.deploymentId;
    console.log('PASS: inactive exact-SHA Function deployment READY: '+stagedDeploymentId);
    await getActive({allowPendingConfiguration:true}); // exact active deployment race fence
    activationAttempted=true;
    await activateFunctionVersion({functions,functionId:FUNCTION,deploymentId:stagedDeploymentId});
    const verified=await verifyActivatedPilot({
      functions,expectedDeploymentId:stagedDeploymentId,ownerId,
      probe:()=>probePilotExecution(fixture),
    });
    await inspect(request,true,ownerId,{
      allowPendingDeployment:verified.live===false,
      expectedDeploymentId:stagedDeploymentId,
    });
    if(verified.live===false)
      console.log('NOTE: stale Appwrite live flag; exact selected deployment and MFA-denial runtime verified');
    console.log('PASS: pilot activated for one disposable Scratch owner only');
    console.log('Preview: '+PREVIEW);
    console.log('PENDING MANUAL ACCEPTANCE: enroll TOTP and verify MFA-pending denial, recovery, sync and isolation.');
  }catch(error){
    if(activationAttempted){
      try{
        const current=await functions.get({functionId:FUNCTION});
        if(current.deploymentId===stagedDeploymentId){
          await activateFunctionVersion({functions,functionId:FUNCTION,deploymentId:EXPECTED_ACTIVE});
          console.error('Rolled back shared Function to '+EXPECTED_ACTIVE);
        } else if(current.deploymentId!==EXPECTED_ACTIVE){
          console.error('CRITICAL: Unknown concurrent Function deployment; operator will not override '+current.deploymentId);
        }
      }catch(e){console.error('CRITICAL: Function rollback/readback failed: '+e.message);}
    }
    try{
      await upsertVariable(functions,FLAG,'false');
      await upsertVariable(functions,ALLOW,'');
    }catch(e){console.error('CRITICAL: pilot variable reset failed: '+e.message);}
    throw error;
  }
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(e=>{
    console.error('E2EE Scratch preparation FAILED: '+e.message);
    process.exitCode=1;
  });
}
