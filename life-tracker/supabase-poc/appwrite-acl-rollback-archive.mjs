/**
 * #1027 OFFLINE ACL rollback escrow for a reviewed Appwrite source snapshot.
 * Contains the ORIGINAL per-object write grants for later authorised reversal.
 * No network, cloud actions, admin credentials, plaintext disk or auto-restore.
 *
 * A caller-supplied SHA is not a server signature. External authority, frozen
 * row counts, API-key revocation and signed old-PWA denial remain separate.
 */
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { open, lstat, realpath, readFile, link, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, isAbsolute } from 'node:path';
import { MOSAIC_DATABASE, MOSAIC_BUCKET } from '../infrastructure/mosaic-backend.mjs';

const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;
const RECIPIENT=/^age1[a-z0-9]{58}$/;
const GRANT=/^(create|read|update|delete|write)\("[^"\n]+"\)$/;
const TABLES=['tasks','categories','diary','settings','bucket_list_items','bucket_task_links'];
const MAX_CLEAR=32*1024*1024, MAX_CIPHER=48*1024*1024;
const MAX_ROWS=250000, MAX_FILES=100000, MAX_FUNCTIONS=2000;
const hash=x=>createHash('sha256').update(x).digest('hex');
const keys=(o,k)=>!!o && typeof o==='object' && !Array.isArray(o) &&
  Object.keys(o).sort().join('|')===[...k].sort().join('|');
const validCount=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
function deny(reason){ throw new Error('Owner ACL rollback archive: '+reason); }
function validateGrants(value){
  if(!Array.isArray(value)||value.length>100||
    value.some(x=>typeof x!=='string'||x.length>256||!GRANT.test(x))||
    new Set(value).size!==value.length) deny('unreviewed or duplicated permission');
}
function validateRows(rows,owner,expected,max){
  if(!Array.isArray(rows)||!validCount(expected,max)||rows.length!==expected)
    deny('partial owner object inventory');
  const seen=new Set();
  for(const row of rows){
    if(!keys(row,['id','ownerId','permissions'])||
      typeof row.id!=='string'||!ID.test(row.id)||seen.has(row.id)||
      row.ownerId!==owner) deny('foreign or duplicate owner object');
    seen.add(row.id);
    validateGrants(row.permissions);
  }
}
function capturedGrantState(readback){
  if(!keys(readback,[
    'ownerLegacyId','sourceDeploymentId','tableGrants','photoBucket',
    'expectedOwnerCounts','functionGrants','expectedFunctionCount',
    'completeBucketObjectCount','unattributedBucketFileCount',
    'signedOldClientDenials','adminGrantSnapshotSha256',
    'ownerFileMembershipIndependentlyAuthenticated','authenticatedSourceLeaseIssued',
    'privilegedWriterKeysRevoked','providerCutoverEligible',
  ]) || !ID.test(readback.ownerLegacyId)||
  typeof readback.sourceDeploymentId!=='string'||
  !readback.sourceDeploymentId.startsWith('https://')||
  !readback.sourceDeploymentId.includes('|'+MOSAIC_DATABASE.id+'|')||
  !SHA.test(readback.adminGrantSnapshotSha256)||
  readback.ownerFileMembershipIndependentlyAuthenticated!==false||
  readback.authenticatedSourceLeaseIssued!==false||
  readback.privilegedWriterKeysRevoked!==false||
  readback.providerCutoverEligible!==false||
  !Array.isArray(readback.signedOldClientDenials)||
  readback.signedOldClientDenials.length!==0)
    deny('unproven source target or unsupported audit envelope');
  const owner=readback.ownerLegacyId, counts=readback.expectedOwnerCounts;
  if(!keys(counts,[...TABLES,MOSAIC_BUCKET.id])||
    !Array.isArray(readback.tableGrants)||readback.tableGrants.length!==TABLES.length)
    deny('missing complete original table and owner counts');
  const seenTables=new Set();
  for(const table of readback.tableGrants) {
    if(!keys(table,['id','enabled','rowSecurity','permissions','ownerRows'])||
      !TABLES.includes(table.id)||seenTables.has(table.id)||
      typeof table.enabled!=='boolean'||typeof table.rowSecurity!=='boolean')
      deny('unreviewed original table');
    seenTables.add(table.id);
    validateGrants(table.permissions);
    validateRows(table.ownerRows,owner,counts[table.id],MAX_ROWS);
  }
  const bucket=readback.photoBucket;
  if(!keys(bucket,['id','enabled','fileSecurity','permissions','ownerFiles'])||
    bucket.id!==MOSAIC_BUCKET.id||
    typeof bucket.enabled!=='boolean'||typeof bucket.fileSecurity!=='boolean')
    deny('unreviewed original private photo bucket');
  validateGrants(bucket.permissions);
  validateRows(bucket.ownerFiles,owner,counts[MOSAIC_BUCKET.id],MAX_FILES);
  if(!validCount(readback.completeBucketObjectCount,MAX_FILES)||
    readback.completeBucketObjectCount<bucket.ownerFiles.length||
    readback.unattributedBucketFileCount!==
      readback.completeBucketObjectCount-bucket.ownerFiles.length)
    deny('incomplete global Storage count');
  if(!Array.isArray(readback.functionGrants)||
    !validCount(readback.expectedFunctionCount,MAX_FUNCTIONS)||
    readback.functionGrants.length!==readback.expectedFunctionCount)
    deny('incomplete privileged Function inventory');
  const functions=new Set();
  for(const fn of readback.functionGrants) {
    if(!keys(fn,['id','enabled','scopes'])||typeof fn.id!=='string'||
      !ID.test(fn.id)||functions.has(fn.id)||typeof fn.enabled!=='boolean'||
      !Array.isArray(fn.scopes)||fn.scopes.length>100||
      fn.scopes.some(x=>typeof x!=='string'||x.length>128)||
      new Set(fn.scopes).size!==fn.scopes.length)
      deny('unreviewed or duplicate Function scope');
    functions.add(fn.id);
  }
  // Reproduce the *exact* admin scanner object's ordered JSON. This is
  // additional tamper detection, NOT independent provenance.
  const state={
    tableGrants:readback.tableGrants,
    photoBucket:readback.photoBucket,
    expectedOwnerCounts:counts,
    functionGrants:readback.functionGrants,
    expectedFunctionCount:readback.expectedFunctionCount,
    completeBucketObjectCount:readback.completeBucketObjectCount,
    unattributedBucketFileCount:readback.unattributedBucketFileCount,
  };
  // Seal a private copy synchronously before any subsequent async I/O:
  // callers cannot mutate the original objects between validation and age.
  const sealed=JSON.parse(JSON.stringify(state));
  if(hash(JSON.stringify(sealed))!==readback.adminGrantSnapshotSha256)
    deny('admin readback fields changed after double scan');
  return {state:sealed,owner,sourceDeploymentId:readback.sourceDeploymentId,
    adminGrantSnapshotSha256:readback.adminGrantSnapshotSha256};
}
export function buildOwnerAclRollbackEnvelope(readback,sourceWitnessSha256){
  if(!SHA.test(sourceWitnessSha256))
    deny('independent source authority witness missing');
  const {state,owner,sourceDeploymentId,adminGrantSnapshotSha256}=
    capturedGrantState(readback);
  return {
    format:'mosaic-appwrite-owner-acl-rollback',version:1,
    ownerLegacyId:owner,sourceDeploymentId,
    sourceWitnessSha256,adminGrantSnapshotSha256,
    state,
    autoRestorePermitted:false,
  };
}
async function privateItem(path,isDir){
  if(typeof path!=='string'||!isAbsolute(path)) deny('absolute private path required');
  const info=await lstat(path);
  if((isDir?!info.isDirectory():!info.isFile())||
    (info.mode&0o077)!==0||(process.getuid&&info.uid!==process.getuid())||
    await realpath(path)!==path) deny('file or directory is not privately owned');
  return info;
}
export async function encryptOwnerAclRollback(readback,options){
  const payload=buildOwnerAclRollbackEnvelope(readback,options?.sourceWitnessSha256);
  const {recipient,destination}=options??{};
  const binary=options?.ageExecutable??'/usr/bin/age';
  if(typeof recipient!=='string'||!RECIPIENT.test(recipient)||
    typeof destination!=='string'||!isAbsolute(destination)||
    !/^[a-zA-Z0-9_.-]+\.age$/.test(basename(destination))||
    typeof binary!=='string'||!isAbsolute(binary)||basename(binary)!=='age')
    deny('invalid recipient, archive destination or age executable');
  const dir=dirname(destination);
  await privateItem(dir,true);
  const clear=Buffer.from(JSON.stringify(payload),'utf8');
  if(!clear.length||clear.length>MAX_CLEAR){
    clear.fill(0); deny('owner ACL archive exceeds bounded memory');
  }
  const temporary=dir+'/.mosaic-acl-'+randomBytes(12).toString('hex')+'.tmp';
  let handle;
  try {
    handle=await open(temporary,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY,0o600);
    await new Promise((resolve,reject)=>{
      const child=spawn(binary,['-r',recipient],{
        stdio:['pipe',handle.fd,'ignore'],env:{PATH:'/usr/bin:/bin'},
      });
      child.on('error',()=>reject(new Error('Owner ACL age encryption unavailable')));
      child.on('close',code=>code===0?resolve():reject(
        new Error('Owner ACL age encryption failed')));
      child.stdin?.on('error',()=>{});
      child.stdin?.end(clear);
    });
    await handle.sync();
    await handle.close();handle=undefined;
    const ciphertext=await readFile(temporary);
    let digest;
    try {
      if(ciphertext.length<32||ciphertext.length>MAX_CIPHER||
         !ciphertext.subarray(0,22).toString().startsWith('age-encryption.org/v1'))
        deny('age ciphertext header or length invalid');
      digest=hash(ciphertext);
    }finally{ciphertext.fill(0);}
    // Atomic no-overwrite publication; never rename() over an older snapshot.
    await link(temporary,destination);
    await unlink(temporary);
    const dirHandle=await open(dir,constants.O_RDONLY);
    try{await dirHandle.sync();}finally{await dirHandle.close();}
    return {cipherSha256:digest,plainSha256:hash(JSON.stringify(payload)),
      adminGrantSnapshotSha256:payload.adminGrantSnapshotSha256};
  }finally{
    clear.fill(0);
    if(handle)await handle.close().catch(()=>{});
    await unlink(temporary).catch(()=>{});
  }
}
/** Does not emit decrypted ACL values, invoke writes or restore any grants. */
export async function verifyOwnerAclRollbackArchive(options){
  const {
    archivePath,identityPath,expectedCipherSha256,expectedPlainSha256,
    expectedSourceWitnessSha256,expectedAdminGrantSnapshotSha256,
    expectedOwnerLegacyId,expectedSourceDeploymentId,
  }=options??{};
  const binary=options?.ageExecutable??'/usr/bin/age';
  if(![expectedCipherSha256,expectedPlainSha256,expectedSourceWitnessSha256,
    expectedAdminGrantSnapshotSha256].every(s=>typeof s==='string'&&SHA.test(s))||
    typeof expectedOwnerLegacyId!=='string'||!ID.test(expectedOwnerLegacyId)||
    typeof expectedSourceDeploymentId!=='string'||!expectedSourceDeploymentId||
    typeof binary!=='string'||!isAbsolute(binary)||basename(binary)!=='age')
    deny('independently pinned owner/source checksum evidence required');
  const info=await privateItem(archivePath,false);
  await privateItem(dirname(archivePath),true);
  await privateItem(identityPath,false);
  await privateItem(dirname(identityPath),true);
  if(!info.size||info.size>MAX_CIPHER) deny('archive exceeds bounded encrypted size');
  const encrypted=await readFile(archivePath);
  try {
    if(encrypted.length!==info.size||hash(encrypted)!==expectedCipherSha256||
      !encrypted.subarray(0,22).toString().startsWith('age-encryption.org/v1'))
      deny('ciphertext differs from independent evidence');
  }finally{encrypted.fill(0);}
  const result=spawnSync(binary,['-d','-i',identityPath,archivePath],{
    encoding:'buffer',maxBuffer:MAX_CLEAR,timeout:30000,
    env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','ignore'],
  });
  const plain=Buffer.isBuffer(result.stdout)?result.stdout:Buffer.alloc(0);
  let payload;
  try{
    if(result.error||result.status!==0||!plain.length||plain.length>MAX_CLEAR)
      deny('age ciphertext decrypt refused');
    if(hash(plain)!==expectedPlainSha256)
      deny('decrypted ACL rollback manifest disagrees with independent pin');
    try{payload=JSON.parse(plain.toString('utf8'));}
    catch{deny('decrypted ACL rollback JSON invalid');}
  }finally{plain.fill(0);}
  if(!keys(payload,[
    'format','version','ownerLegacyId','sourceDeploymentId',
    'sourceWitnessSha256','adminGrantSnapshotSha256','state','autoRestorePermitted',
  ])||payload.format!=='mosaic-appwrite-owner-acl-rollback'||
     payload.version!==1||payload.autoRestorePermitted!==false||
     payload.ownerLegacyId!==expectedOwnerLegacyId||
     payload.sourceDeploymentId!==expectedSourceDeploymentId||
     payload.sourceWitnessSha256!==expectedSourceWitnessSha256||
     payload.adminGrantSnapshotSha256!==expectedAdminGrantSnapshotSha256)
    deny('rollback manifest owner/source evidence changed');
  const state=payload.state;
  // Revalidate full original grants, duplicate/foreign rows and counts after
  // decrypt, even if a syntactically valid age archive has fresh matching pins.
  capturedGrantState({
    ownerLegacyId:payload.ownerLegacyId,
    sourceDeploymentId:payload.sourceDeploymentId,
    ...state,adminGrantSnapshotSha256:payload.adminGrantSnapshotSha256,
    signedOldClientDenials:[],ownerFileMembershipIndependentlyAuthenticated:false,
    authenticatedSourceLeaseIssued:false,privilegedWriterKeysRevoked:false,
    providerCutoverEligible:false,
  });
  return {
    ownerLegacyId:expectedOwnerLegacyId,sourceDeploymentId:expectedSourceDeploymentId,
    cipherSha256:expectedCipherSha256,plainSha256:expectedPlainSha256,
    adminGrantSnapshotSha256:expectedAdminGrantSnapshotSha256,
    sourceWitnessSha256:expectedSourceWitnessSha256,
    ownerRowGrants:state.tableGrants.reduce((n,t)=>n+t.ownerRows.length,0),
    ownerFileGrants:state.photoBucket.ownerFiles.length,
    functionScopes:state.functionGrants.length,
    // Even exact original ACLs do not authorize restoring or changing them.
    sourceLeaseAuthenticated:false,aclRestoreAuthorized:false,
    providerCutoverEligible:false,
  };
}
