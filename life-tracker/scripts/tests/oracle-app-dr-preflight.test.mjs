import test from 'node:test';
import { readBackupConfig } from '../../appwrite-functions/dr-backup/backup.mjs';
import { oracleDrVariableOverrides, diffFunctionVariables } from '../lib/appwrite-backend.mjs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  TARGETS, parseOracleDrArgs, inspectOracleDr,
  formatOracleDrReport, runOracleDrPreflight,
} from '../oracle-app-dr-preflight.mjs';

const required = [
  'users.read', 'databases.read', 'tables.read', 'columns.read',
  'indexes.read', 'rows.read', 'buckets.read', 'files.read',
];
const variable = (key, value, secret=false) => ({key, value, secret});
const secrets = [
  variable('R2_ACCOUNT_ID', 'account'),
  variable('R2_BUCKET', 'bucket'),
  variable('R2_ACCESS_KEY_ID', 'NEVER_PRINT_ID', true),
  variable('R2_SECRET_ACCESS_KEY', 'NEVER_PRINT_SECRET', true),
  variable('DR_ENCRYPTION_KEY_B64', 'NEVER_PRINT_ENCRYPTION_KEY', true),
  variable('DR_ALLOW_MANUAL_EXECUTION', 'false'),
];
const base = {
  $id:'dr_backup', runtime:'node-22', enabled:true, timeout:900,
  execute:[], scopes:required, schedule:'',
};

function fake({profile='scratch', dr=base, variables, messages}={}) {
  return {
    async get({functionId}) {
      assert.equal(functionId, 'dr_backup');
      return dr;
    },
    async listVariables({functionId}) {
      if (functionId==='dr_backup') return {
        variables: variables || [...secrets, variable('DR_PREFIX', TARGETS[profile].prefix)],
      };
      assert.equal(functionId,'6aa8057f002a4c306fdd');
      return {variables: messages || [
        variable('DR_PRIVACY_DELETION_REQUIRED','true'),
        variable('DR_BACKUP_FUNCTION_ID','dr_backup'),
      ]};
    },
  };
}

test('both Oracle profiles are hard pinned and cannot select Cloud or other project',()=>{
  for (const profile of Object.keys(TARGETS)) {
    const parsed = parseOracleDrArgs(['--profile',profile],{APPWRITE_API_KEY:'a'});
    assert.equal(parsed.projectId,TARGETS[profile].projectId);
    assert.equal(parsed.prefix,TARGETS[profile].prefix);
    assert.ok(parsed.endpoint.endsWith('/v1'));
  }
  assert.notEqual(TARGETS.scratch.prefix,TARGETS.production.prefix);
  for(const profile of ['cloud','unknown','']) {
    assert.throws(()=>parseOracleDrArgs(['--profile',profile],{APPWRITE_API_KEY:'a'}));
  }
  assert.throws(()=>parseOracleDrArgs(['--profile','production'],{}));
  assert.throws(()=>parseOracleDrArgs(['--profile','production','--project','other'],{APPWRITE_API_KEY:'a'}));
});

test('read-only identity, secret scope, dedicated prefix and deletion markers',async()=>{
  for (const profile of Object.keys(TARGETS)) {
    const status=await inspectOracleDr({functions:fake({profile}),profile});
    assert.deepEqual(status,{
      function:'READ_ONLY',variables:'CONFIGURED',
      schedule:'DISABLED',privacy:'GUARDED',
    });
    const output=formatOracleDrReport(status);
    assert.match(output,/DR_READINESS=BLOCKED/);
    assert.match(output,/RECOVERY=NOT_VERIFIED/);
    for(const literal of ['NEVER_PRINT','dr_backup','account','bucket',TARGETS[profile].prefix]){
      assert.equal(output.includes(literal),false);
    }
  }
});

test('untrusted roles, schedule and unrelated Cloud prefix fail closed', async()=>{
  const wrongScope=await inspectOracleDr({
    functions:fake({dr:{...base,scopes:[...required,'rows.write']}}),profile:'scratch',
  });
  assert.equal(wrongScope.function,'INVALID');
  const wrongClient=await inspectOracleDr({
    functions:fake({dr:{...base,execute:['users']}}),profile:'scratch',
  });
  assert.equal(wrongClient.function,'INVALID');
  const enabledSchedule=await inspectOracleDr({
    functions:fake({dr:{...base,schedule:'0 11 * * *'}}),profile:'scratch',
  });
  assert.equal(enabledSchedule.schedule,'ENABLED');

  const collision=await inspectOracleDr({
    functions:fake({variables:[...secrets,variable('DR_PREFIX','mosaic-dr/v1')]}),
    profile:'scratch',
  });
  assert.equal(collision.variables,'WRONG_PREFIX');
  const exposed=await inspectOracleDr({
    functions:fake({variables:[
      ...secrets.filter(v=>v.key!=='DR_ENCRYPTION_KEY_B64'),
      variable('DR_ENCRYPTION_KEY_B64','x',false),
      variable('DR_PREFIX',TARGETS.scratch.prefix),
    ]}),profile:'scratch',
  });
  assert.equal(exposed.variables,'INCOMPLETE');
  const unsafe=await inspectOracleDr({
    functions:fake({variables:[
      ...secrets.filter(v=>v.key!=='DR_ALLOW_MANUAL_EXECUTION'),
      variable('DR_ALLOW_MANUAL_EXECUTION','true'),
      variable('DR_PREFIX',TARGETS.scratch.prefix),
    ]}),profile:'scratch',
  });
  assert.equal(unsafe.variables,'MANUAL_EXECUTION_ENABLED');
  const marker=await inspectOracleDr({
    functions:fake({messages:[variable('DR_PRIVACY_DELETION_REQUIRED','false')]}),
    profile:'scratch',
  });
  assert.equal(marker.privacy,'NOT_VERIFIED');
});

test('preflight never leaks SDK errors, environment secrets, or false recovery PASS',async()=>{
  const transcript=[];
  const rc=await runOracleDrPreflight({
    argv:['--profile','production'],env:{APPWRITE_API_KEY:'NEVER_PRINT_API_KEY'},
    functions:{ async get(){throw new Error('DO_NOT_PRINT_STACKTRACE_SECRET');} },
    log:(message)=>transcript.push(message),
  });
  assert.equal(rc,2);
  assert.deepEqual(transcript,['MOSAIC_ORACLE_APP_DR_PREFLIGHT=BLOCKED']);
  assert.equal(transcript.join('').includes('DO_NOT_PRINT'),false);

  const accepted=[];
  const checked=await runOracleDrPreflight({
    argv:['--profile','scratch'],env:{APPWRITE_API_KEY:'x'},functions:fake(),
    log:(line)=>accepted.push(line),
  });
  assert.equal(checked,2);
  assert.match(accepted.join(''),/CONFIG_REVIEWED/);
  assert.match(accepted.join(''),/DR_READINESS=BLOCKED/);
  assert.doesNotMatch(accepted.join(''),/RECOVERY=VERIFIED/);
});

test('runtime backup cannot write Oracle snapshots to Cloud or the other Oracle prefix',()=>{
  const baseEnv = {
    APPWRITE_FUNCTION_API_ENDPOINT:'http://127.0.0.1/v1',
    R2_ACCOUNT_ID:'dummy',
    R2_ACCESS_KEY_ID:'dummy',
    R2_SECRET_ACCESS_KEY:'dummy',
    R2_BUCKET:'dummy',
    DR_ENCRYPTION_KEY_B64: Buffer.alloc(32, 1).toString('base64'),
  };
  for (const profile of Object.keys(TARGETS)) {
    const expected = TARGETS[profile];
    const env = {...baseEnv, APPWRITE_FUNCTION_PROJECT_ID:expected.projectId};
    assert.throws(()=>readBackupConfig(env), /Oracle DR prefix/);
    assert.throws(()=>readBackupConfig({...env,DR_PREFIX:'mosaic-dr/v1'}), /Oracle DR prefix/);
    for (const other of Object.values(TARGETS)) {
      if (other === expected) continue;
      assert.throws(()=>readBackupConfig({...env,DR_PREFIX:other.prefix}),/Oracle DR prefix/);
    }
    const accepted=readBackupConfig({...env,DR_PREFIX:expected.prefix+'/'});
    assert.equal(accepted.prefix,expected.prefix);
  }
  // Unchanged legacy Cloud source remains on the original logical format/prefix.
  const cloud = readBackupConfig({...baseEnv,
    APPWRITE_FUNCTION_PROJECT_ID:'6a9703c50016b37110ff'});
  assert.equal(cloud.prefix,'mosaic-dr/v1');
});

test('managed backend drift checks honor only the exact destination backup prefix',()=>{
  for (const profile of Object.keys(TARGETS)) {
    const overrides=oracleDrVariableOverrides(TARGETS[profile].projectId,'dr-backup');
    assert.deepEqual(overrides,{DR_PREFIX:TARGETS[profile].prefix});
    const expected={
      name:'dr-backup',nonSecretVariables:{DR_PREFIX:'mosaic-dr/v1'},
      requiredNonSecretVariables:[],requiredSecretVariables:[],
    };
    const deployed={vars:[{key:'DR_PREFIX',value:TARGETS[profile].prefix,secret:false}]};
    assert.deepEqual(diffFunctionVariables(deployed,expected,{nonSecretOverrides:overrides}),[]);
    const unsafe={vars:[{key:'DR_PREFIX',value:'mosaic-dr/v1',secret:false}]};
    assert.ok(diffFunctionVariables(unsafe,expected,{nonSecretOverrides:overrides}).length>0);
  }
  assert.deepEqual(oracleDrVariableOverrides('6a9703c50016b37110ff','dr-backup'),{});
  assert.deepEqual(oracleDrVariableOverrides(TARGETS.production.projectId,'message-action'),{});
});

test('Cloud and Oracle monitoring are independent and Oracle watch starts disabled',async()=>{
  const wf=await readFile(new URL('../../../.github/workflows/dr-backup-watch.yml',import.meta.url),'utf8');
  assert.match(wf,/DR_BACKUP_WATCH_ENABLED/);
  assert.match(wf,/DR_ORACLE_WATCH_ENABLED/);
  assert.match(wf,/DR_PREFIX: mosaic-dr\/v1/);
  assert.match(wf,/DR_PREFIX: mosaic-oracle-dr\/v1/);
  assert.match(wf,/DR_ORACLE_R2_RECOVERY_ACCESS_KEY_ID/);
  assert.match(wf,/DR_ORACLE_R2_RECOVERY_SECRET_ACCESS_KEY/);
});

test('Oracle Production target matches the separate Git-owned backend overlay', async()=>{
  const overlay = JSON.parse(
    await readFile(new URL('../../appwrite.config.json', import.meta.url), 'utf8')
  );
  assert.equal(TARGETS.production.projectId, overlay.projectId);
  assert.equal(TARGETS.production.prefix, 'mosaic-oracle-dr/v1');
  assert.notEqual(TARGETS.production.projectId, TARGETS.scratch.projectId);
});
