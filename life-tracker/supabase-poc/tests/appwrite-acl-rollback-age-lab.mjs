// Real age X25519 ACL escrow test. Synthetic records ONLY, no backend calls.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, chmod, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MOSAIC_DATABASE, MOSAIC_BUCKET } from '../../infrastructure/mosaic-backend.mjs';
import {
  buildOwnerAclRollbackEnvelope, buildAppwriteFreezeDryRunPlan,
  encryptOwnerAclRollback, verifyOwnerAclRollbackArchive,
} from '../appwrite-acl-rollback-archive.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.match(process.env.RUNNER_TEMP??'',/^\/home\/runner\/work\/_temp$/);
const hash=data=>createHash('sha256').update(data).digest('hex');
const env={PATH:'/usr/bin:/bin'};
const cli=(cmd,args,options={})=>{
  const res=spawnSync(cmd,args,{encoding:'buffer',maxBuffer:4*1024*1024,env,...options});
  assert.equal(res.status,0,'Synthetic age tool failed');
  return res.stdout;
};
const owner='disposable_owner';
const deployment='https://fra.cloud.appwrite.io/v1|scratch-project|'+
  MOSAIC_DATABASE.id+'|acl-fixture';
const ids=['tasks','categories','diary','settings','bucket_list_items','bucket_task_links'];
const perms=['read("user:disposable_owner")','update("user:disposable_owner")'];
const tableGrants=ids.map(id=>({
  id,enabled:true,rowSecurity:true,
  permissions:['create("users")'],
  ownerRows:[{id:id+'_row1',ownerId:owner,permissions:[...perms]}],
}));
const photoBucket={
  id:MOSAIC_BUCKET.id,enabled:true,fileSecurity:true,
  permissions:['create("users")'],
  ownerFiles:[{id:'file_a',ownerId:owner,permissions:[...perms]}],
};
const expectedOwnerCounts=Object.fromEntries(
  [...ids,MOSAIC_BUCKET.id].map(id=>[id,1]));
const functionGrants=[
  {id:'dr-backup',enabled:true,scopes:['rows.read','files.read']},
  {id:'message-action',enabled:true,scopes:['rows.write']},
];
const state={
  tableGrants,photoBucket,expectedOwnerCounts,
  functionGrants,expectedFunctionCount:2,
  completeBucketObjectCount:2,unattributedBucketFileCount:1,
};
const scanned={
  ownerLegacyId:owner,sourceDeploymentId:deployment,...state,
  signedOldClientDenials:[],
  adminGrantSnapshotSha256:hash(JSON.stringify(state)),
  ownerFileMembershipIndependentlyAuthenticated:false,
  authenticatedSourceLeaseIssued:false,
  privilegedWriterKeysRevoked:false,providerCutoverEligible:false,
};
const sourceWitnessSha256='a'.repeat(64);
const root=await mkdtemp(join(process.env.RUNNER_TEMP,'mosaic-private-acl-'));
await chmod(root,0o700);
try{
  const identityPath=join(root,'identity.agekey');
  cli('/usr/bin/age-keygen',['-o',identityPath]);
  await chmod(identityPath,0o600);
  const recipient=cli('/usr/bin/age-keygen',['-y',identityPath]).toString('utf8').trim();
  const archivePath=join(root,'pre-cutoff-grants.age');
  const encrypted=await encryptOwnerAclRollback(scanned,{
    sourceWitnessSha256,recipient,destination:archivePath,
  });
  const original=await readFile(archivePath);
  assert.equal(encrypted.cipherSha256,hash(original));
  assert.equal(encrypted.adminGrantSnapshotSha256,scanned.adminGrantSnapshotSha256);
  assert.equal((await stat(archivePath)).mode&0o777,0o600);
  const source=buildOwnerAclRollbackEnvelope(scanned,sourceWitnessSha256);

  // Global and owner-row permissions plus every enabled Function are
  // represented as reversible proposed changes, NEVER issued as API calls.
  const originalReadbackJson=JSON.stringify(scanned);
  const dryRun=buildAppwriteFreezeDryRunPlan(scanned,sourceWitnessSha256);
  assert.equal(dryRun.plannedChanges,16);
  assert.equal(dryRun.steps.filter(x=>x.resource==='table').length,6);
  assert.equal(dryRun.steps.filter(x=>x.resource==='owner-row').length,6);
  assert.equal(dryRun.steps.filter(x=>x.resource==='bucket').length,1);
  assert.equal(dryRun.steps.filter(x=>x.resource==='owner-file').length,1);
  assert.equal(dryRun.steps.filter(x=>x.resource==='function').length,2);
  assert.deepEqual(dryRun.steps.find(x=>x.resource==='owner-row').after.permissions,
    ['read("user:disposable_owner")']);
  for(const step of dryRun.steps){
    if(step.after.permissions)
      assert.equal(step.after.permissions.some(p=>
        /^(?:create|update|delete|write)\("/.test(p)),false);
    if(step.resource==='function')assert.equal(step.after.enabled,false);
  }
  assert.equal(dryRun.originalAdminGrantSnapshotSha256,
    scanned.adminGrantSnapshotSha256);
  assert.match(dryRun.planSha256,/^[a-f0-9]{64}$/);
  assert.equal(dryRun.approvedForExecution,false);
  assert.equal(dryRun.approvedForRollback,false);
  assert.equal(dryRun.serverWriteFenceAuthenticated,false);
  assert.equal(dryRun.oldClient403Proved,false);
  assert.equal(dryRun.providerCutoverEligible,false);
  assert.equal(JSON.stringify(scanned),originalReadbackJson);
  assert.deepEqual(buildAppwriteFreezeDryRunPlan(scanned,sourceWitnessSha256),
    dryRun);
  // An already read-only original inventory never becomes a cutover permit.
  const alreadyFrozen=structuredClone(scanned);
  for(const table of alreadyFrozen.tableGrants){
    table.permissions=[];
    for(const row of table.ownerRows)
      row.permissions=['read("user:disposable_owner")'];
  }
  alreadyFrozen.photoBucket.permissions=[];
  for(const file of alreadyFrozen.photoBucket.ownerFiles)
    file.permissions=['read("user:disposable_owner")'];
  for(const fn of alreadyFrozen.functionGrants)fn.enabled=false;
  const readOnlyState={
    tableGrants:alreadyFrozen.tableGrants,
    photoBucket:alreadyFrozen.photoBucket,
    expectedOwnerCounts:alreadyFrozen.expectedOwnerCounts,
    functionGrants:alreadyFrozen.functionGrants,
    expectedFunctionCount:alreadyFrozen.expectedFunctionCount,
    completeBucketObjectCount:alreadyFrozen.completeBucketObjectCount,
    unattributedBucketFileCount:alreadyFrozen.unattributedBucketFileCount,
  };
  alreadyFrozen.adminGrantSnapshotSha256=hash(JSON.stringify(readOnlyState));
  const emptyPlan=buildAppwriteFreezeDryRunPlan(alreadyFrozen,sourceWitnessSha256);
  assert.equal(emptyPlan.plannedChanges,0);
  assert.equal(emptyPlan.providerCutoverEligible,false);
  const forgedPlanSource=structuredClone(scanned);
  forgedPlanSource.tableGrants[0].ownerRows[0].permissions.push('write("users")');
  assert.throws(()=>buildAppwriteFreezeDryRunPlan(
    forgedPlanSource,sourceWitnessSha256),/changed after double scan/);
  assert.deepEqual(cli('/usr/bin/age',['-d','-i',identityPath,archivePath]),
    Buffer.from(JSON.stringify(source),'utf8'));
  const proof={
    archivePath,identityPath,expectedCipherSha256:encrypted.cipherSha256,
    expectedPlainSha256:encrypted.plainSha256,
    expectedSourceWitnessSha256:sourceWitnessSha256,
    expectedAdminGrantSnapshotSha256:scanned.adminGrantSnapshotSha256,
    expectedOwnerLegacyId:owner,expectedSourceDeploymentId:deployment,
  };
  const verified=await verifyOwnerAclRollbackArchive(proof);
  assert.equal(verified.ownerRowGrants,6);
  assert.equal(verified.ownerFileGrants,1);
  assert.equal(verified.functionScopes,2);
  assert.equal(verified.aclRestoreAuthorized,false);
  assert.equal(verified.providerCutoverEligible,false);
  await assert.rejects(encryptOwnerAclRollback(scanned,{
    sourceWitnessSha256,recipient,destination:archivePath,
  }),{code:'EEXIST'});
  assert.deepEqual(await readFile(archivePath),original);
  for(const mutation of [
    {expectedCipherSha256:'0'.repeat(64),expected:'ciphertext'},
    {expectedPlainSha256:'0'.repeat(64),expected:'manifest'},
    {expectedSourceWitnessSha256:'0'.repeat(64),expected:'source evidence'},
    {expectedAdminGrantSnapshotSha256:'0'.repeat(64),expected:'owner/source evidence'},
    {expectedOwnerLegacyId:'another_owner',expected:'owner/source evidence'},
    {expectedSourceDeploymentId:deployment+'-other',expected:'owner/source evidence'},
  ]) {
    const {expected,...overrides}=mutation;
    await assert.rejects(verifyOwnerAclRollbackArchive({...proof,...overrides}),
      new RegExp(expected));
  }
  const wrongOriginal=structuredClone(scanned);
  wrongOriginal.tableGrants[0].permissions.push('delete("users")');
  assert.throws(()=>buildOwnerAclRollbackEnvelope(wrongOriginal,sourceWitnessSha256),
    /changed after double scan/);
  const foreign=structuredClone(scanned);
  foreign.photoBucket.ownerFiles[0].ownerId='foreign';
  assert.throws(()=>buildOwnerAclRollbackEnvelope(foreign,sourceWitnessSha256),
    /foreign or duplicate/);
  const short=structuredClone(scanned);
  short.tableGrants[0].ownerRows=[];
  assert.throws(()=>buildOwnerAclRollbackEnvelope(short,sourceWitnessSha256),
    /partial owner/);
  const duplicated=structuredClone(scanned);
  duplicated.functionGrants[1].id=duplicated.functionGrants[0].id;
  assert.throws(()=>buildOwnerAclRollbackEnvelope(duplicated,sourceWitnessSha256),
    /duplicate Function/);
  // Valid X25519 ciphertext + valid matching plaintext SHA cannot sneak
  // a forged foreign owner row past decrypted structural validation.
  const forged=structuredClone(source);
  forged.state.tableGrants[0].ownerRows[0].ownerId='other_owner';
  forged.adminGrantSnapshotSha256=hash(JSON.stringify(forged.state));
  const forgedCipher=cli('/usr/bin/age',['-r',recipient],{
    input:Buffer.from(JSON.stringify(forged),'utf8'),
  });
  const forgedPath=join(root,'malicious.acl.age');
  await writeFile(forgedPath,forgedCipher,{flag:'wx',mode:0o600});
  await assert.rejects(verifyOwnerAclRollbackArchive({
    ...proof,archivePath:forgedPath,
    expectedCipherSha256:hash(forgedCipher),
    expectedPlainSha256:hash(JSON.stringify(forged)),
    expectedAdminGrantSnapshotSha256:forged.adminGrantSnapshotSha256,
  }),/foreign or duplicate owner object/);
  await rm(forgedPath);
  const remaining=(await readdir(root)).sort();
  assert.deepEqual(remaining,['identity.agekey','pre-cutoff-grants.age'].sort());
  console.log('MOSAIC_PRIVATE_APPWRITE_ACL_AGE_ROLLBACK_ROUNDTRIP_PASS');
}finally{
  await rm(root,{recursive:true,force:true});
}
