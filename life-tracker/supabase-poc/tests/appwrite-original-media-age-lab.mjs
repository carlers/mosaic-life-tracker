// #1027 real disposable age X25519 owner-private original byte roundtrip.
// Synthetic data only, no Appwrite API, production credential or user content.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chmod,mkdtemp,mkdir,readFile,readdir,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {encryptAppwriteOriginalOwnerMedia,verifyAppwriteOriginalOwnerMedia}
  from '../appwrite-original-media-age.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.match(process.env.RUNNER_TEMP??'',/^\/home\/runner\/work\/_temp$/);
const hash=x=>createHash('sha256').update(x).digest('hex');
const age=(bin,args,options={})=>{
  const output=spawnSync(bin,args,{encoding:'buffer',maxBuffer:1024*1024,
    env:{PATH:'/usr/bin:/bin'},...options});
  assert.equal(output.status,0,'Disposable age tool failed');
  return output.stdout;
};
const owner='fixture_owner';
const deployment='https://fra.cloud.appwrite.io/v1|scratch|life_tracker|fixture';
const originals={
  file_1:Buffer.from([82,73,70,70,8,0,0,0,87,69,66,80,86,80,56,32,1,2,3]),
  file_2:Buffer.from([82,73,70,70,9,0,0,0,87,69,66,80,86,80,56,32,7,8,9,10]),
  orphan_file_3:Buffer.from([82,73,70,70,10,0,0,0,87,69,66,80,86,80,56,32,11,12,13,14,15]),
};
const objects=Object.entries(originals).map(([id,b])=>({
  id,ownerId:owner,bytes:b.length,sha256:hash(b),
})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const input={ownerLegacyId:owner,sourceDeploymentId:deployment,
  sourceArchiveCipherSha256:'a'.repeat(64),
  sevenDomainScanSha256:'b'.repeat(64),
  sourceAclWitnessSha256:'c'.repeat(64),
  expectedOwnerFileCount:objects.length,
  expectedOwnerInventorySha256:hash(JSON.stringify(objects)),objects};
const root=await mkdtemp(join(process.env.RUNNER_TEMP,'mosaic-original-owner-media-'));
await chmod(root,0o700);
try{
  const inputDir=join(root,'input'),secure=join(root,'secure');
  await mkdir(inputDir,{mode:0o700});await mkdir(secure,{mode:0o700});
  for(const [id,bytes] of Object.entries(originals))
    await writeFile(join(inputDir,id+'.webp'),bytes,{flag:'wx',mode:0o600});
  const identity=join(secure,'identity.agekey');
  age('/usr/bin/age-keygen',['-o',identity]);await chmod(identity,0o600);
  const recipient=age('/usr/bin/age-keygen',['-y',identity]).toString('utf8').trim();
  const destination=join(secure,'complete-original-media.age');
  const options={sourceDirectory:inputDir,destination,recipient};
  const encrypted=await encryptAppwriteOriginalOwnerMedia(input,options);
  const expectedBytes=Object.values(originals).reduce((n,b)=>n+b.length,0);
  assert.equal(encrypted.originalBytes,expectedBytes);
  assert.equal(encrypted.objects,3);
  assert.equal(encrypted.providerCutoverEligible,false);
  const ciphertext=await readFile(destination);
  assert.equal(encrypted.cipherSha256,hash(ciphertext));
  assert.equal((await stat(destination)).mode&0o777,0o600);
  const expectedSource=Object.fromEntries(
    Object.entries(input).filter(([key])=>key!=='objects'));
  const pins={archivePath:destination,identityPath:identity,
    expectedCipherSha256:encrypted.cipherSha256,
    expectedPlainSha256:encrypted.plainSha256,
    expectedSource,expectedOriginalBytes:expectedBytes};
  const proof=await verifyAppwriteOriginalOwnerMedia(pins);
  assert.equal(proof.nonemptyOriginalMediaLocallyVerified,true);
  assert.equal(proof.originalMembershipIndependentlyAuthenticated,false);
  assert.equal(proof.actualServerFreezeProven,false);
  assert.equal(proof.providerCutoverEligible,false);
  const decrypted=JSON.parse(
    age('/usr/bin/age',['-d','-i',identity,destination]).toString('utf8'));
  assert.deepEqual(decrypted.objects.map(x=>x.id),objects.map(x=>x.id));
  for(const file of decrypted.objects)
    assert.deepEqual(Buffer.from(file.dataBase64,'base64'),originals[file.id]);
  await assert.rejects(encryptAppwriteOriginalOwnerMedia(input,options),{code:'EEXIST'});
  assert.deepEqual(await readFile(destination),ciphertext);
  for(const [change,reason] of [
    [{expectedCipherSha256:'0'.repeat(64)},/encrypted media bytes/],
    [{expectedPlainSha256:'0'.repeat(64)},/decrypted original media/],
    [{expectedOriginalBytes:1},/differs from pins/],
    [{expectedSource:{...expectedSource,ownerLegacyId:'foreign'}},/differs from pins/],
    [{expectedSource:{...expectedSource,sourceAclWitnessSha256:'0'.repeat(64)}},/differs from pins/],
  ]){
    await assert.rejects(verifyAppwriteOriginalOwnerMedia({...pins,...change}),reason);
  }
  for(const [mutate,reason] of [
    [x=>{x.objects[0].ownerId='foreign';},/foreign/],
    [x=>{x.objects.pop();x.expectedOwnerFileCount=2;},/independent witness/],
    [x=>{x.objects[0].sha256='0'.repeat(64);},/independent witness/],
    [x=>{x.objects[0].id=x.objects[1].id;},/duplicate/],
  ]){
    const modified=structuredClone(input);mutate(modified);
    await assert.rejects(encryptAppwriteOriginalOwnerMedia(modified,{
      ...options,destination:join(secure,'rejected.age'),
    }),reason);
  }
  // A re-encrypted, syntactically valid age archive with recalculated pins
  // must still refuse any foreign owner inside the decrypted object ledger.
  decrypted.objects[0].ownerId='foreign';
  const forged=Buffer.from(JSON.stringify(decrypted),'utf8');
  const forgedCipher=age('/usr/bin/age',['-r',recipient],{input:forged});
  const forgedPath=join(secure,'forged.age');
  await writeFile(forgedPath,forgedCipher,{flag:'wx',mode:0o600});
  await assert.rejects(verifyAppwriteOriginalOwnerMedia({...pins,
    archivePath:forgedPath,expectedCipherSha256:hash(forgedCipher),
    expectedPlainSha256:hash(forged),
  }),/foreign/);
  await rm(forgedPath);
  await writeFile(join(inputDir,'unknown.webp'),Buffer.from([1]),{
    flag:'wx',mode:0o600});
  await assert.rejects(encryptAppwriteOriginalOwnerMedia(input,{
    ...options,destination:join(secure,'rejected.age'),
  }),/incomplete or extra/);
  await rm(join(inputDir,'unknown.webp'));
  await rm(join(inputDir,'file_1.webp'));
  await symlink(join(inputDir,'file_2.webp'),join(inputDir,'file_1.webp'));
  await assert.rejects(encryptAppwriteOriginalOwnerMedia(input,{
    ...options,destination:join(secure,'rejected.age'),
  }),/private owner directory\/file refused/);
  assert.deepEqual((await readdir(secure)).sort(),
    ['identity.agekey','complete-original-media.age'].sort());
  console.log('MOSAIC_APPWRITE_ORIGINAL_OWNER_MEDIA_AGE_BYTES_PASS');
}finally{await rm(root,{recursive:true,force:true});}
