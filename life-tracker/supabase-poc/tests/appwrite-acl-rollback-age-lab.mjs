// Real age X25519 ACL escrow test. Synthetic records ONLY, no backend calls.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, chmod, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MOSAIC_DATABASE, MOSAIC_BUCKET } from '../../infrastructure/mosaic-backend.mjs';
import {
  buildOwnerAclRollbackEnvelope, encryptOwnerAclRollback,
  verifyOwnerAclRollbackArchive,
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
  const recipient=cli('/usr/bin/age-keygen',['-y',identityPath']).toString('utf8').trim();
  const archivePath=join(root,'pre-cutoff-grants.age');
  const encrypted=await encryptOwnerAclRollback(scanned,{
    sourceWitnessSha256,recipient,destination:archivePath,
  });
  const original=await readFile(archivePath);
  assert.equal(encrypted.cipherSha256,hash(original));
  assert.equal(encrypted.adminGrantSnapshotSha256,scanned.adminGrantSnapshotSha256);
  assert.equal((await stat(archivePath)).mode&0o777,0o600);
  const source=buildOwnerAclRollbackEnvelope(scanned,sourceWitnessSha256);
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
