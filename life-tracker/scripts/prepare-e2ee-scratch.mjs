#!/usr/bin/env node
/** #1662 — fail-closed, synthetic-only Oracle Scratch operator. */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client, Functions, ID, Permission, Query, Role, TablesDB, Users } from 'node-appwrite';
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

async function upsertVariable(functions,key,value) {
  const variable=(await listVariables(functions)).find(v=>v.key===key);
  if(variable?.secret===true)fail('Pilot variable has unexpected secret classification');
  if(variable)await functions.updateVariable({
    functionId:FUNCTION,variableId:variable.$id,key,value,secret:false,
  });
  else await functions.createVariable({
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

export async function assertReviewedScratchDrift({request,diffs,allowedMissing=[]}) {
  const missing = new Set(allowedMissing);
  const unexpected=diffs.filter(item=>!KNOWN_SCRATCH_DRIFT.has(item)&&!missing.has(item));
  if(unexpected.length)fail('Unreviewed Scratch drift before write: '+unexpected.join('; '));

  const observations = new Set(diffs);
  if(observations.has('table media_uploads.reference_epoch: unexpected column')) {
    const table=await request('GET','/tablesdb/life_tracker/tables/media_uploads');
    const column=table?.columns?.find(c=>c.key==='reference_epoch');
    if(!column || column.required!==false ||
       !['integer','varchar','boolean'].includes(column.type) ||
       (column.status && column.status!=='available') ||
       (column.default!==null && column.default!==undefined)) {
      fail('Unexpected media_uploads.reference_epoch contract; non-nullable, unavailable or incompatible column');
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

async function inspect(request,enabled,ownerId) {
  const definitions=await readBackendDefinitions();
  definitions.functions['message-action'].config.nonSecretVariables[FLAG]=enabled?'true':'false';
  definitions.functions['message-action'].config.nonSecretVariables[ALLOW]=ownerId;
  const report=await inspectManagedBackend({request,definitions,includeDr:false});
  await assertReviewedScratchDrift({request,diffs:report.diffs});
  console.log('PASS: managed Scratch schema, indexes, Function and variable readiness');
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
  return user.$id;
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
  const getActive=async()=>{
    const current=await functions.get({functionId:FUNCTION});
    if(current.deploymentId!==EXPECTED_ACTIVE||current.live!==true||current.enabled!==true||
       (current.schedule??'')!==''||(current.interval??0)!==0)
      fail('Scratch shared Function deployment or timer changed; refusing rollout');
    const definition=await readFunctionDefinition('message-action');
    const drift=diffFunction(current,definition.config,'message-action');
    if(drift.length)fail('Shared Function config drift: '+drift.join('; '));
    return current;
  };
  await getActive();
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
  await inspect(request,false,'');
  const ownerId=await newDisposableAccount(users,tables);
  let activationAttempted=false;
  let stagedDeploymentId='';
  try{
    await upsertVariable(functions,ALLOW,ownerId);
    await upsertVariable(functions,FLAG,'true');
    const definition=await readFunctionDefinition('message-action');
    const deployed=await deployFunctionVersion({functions,definition,functionId:FUNCTION,gitSha:sha});
    stagedDeploymentId=deployed.deploymentId;
    console.log('PASS: inactive exact-SHA Function deployment READY: '+stagedDeploymentId);
    await getActive(); // concurrent rollout race fence
    activationAttempted=true;
    await activateFunctionVersion({functions,functionId:FUNCTION,deploymentId:stagedDeploymentId});
    const current=await functions.get({functionId:FUNCTION});
    if(current.deploymentId!==deployed.deploymentId||current.live!==true)
      fail('Function activation readback mismatched');
    await inspect(request,true,ownerId);
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
