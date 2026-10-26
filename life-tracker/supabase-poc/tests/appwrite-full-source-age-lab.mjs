// #1027 real age; synthetic owner and records ONLY, no cloud calls.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chmod,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {encryptAppwriteFullOwnerSource,verifyAppwriteFullOwnerSource} from '../appwrite-full-source-archive.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.match(process.env.RUNNER_TEMP??'',/^\/home\/runner\/work\/_temp$/);
const hash=x=>createHash('sha256').update(x).digest('hex');
const rowHash=rows=>{
  const h=createHash('sha256');
  for(const row of rows){const s=JSON.stringify(row);
    h.update(Buffer.byteLength(s,'utf8')+':');h.update(s);}
  return h.digest('hex');
};
const run=(cmd,args,options={})=>{
  const res=spawnSync(cmd,args,{encoding:'buffer',maxBuffer:4*1024*1024,
    env:{PATH:'/usr/bin:/bin'},...options});
  assert.equal(res.status,0,'Disposable age operation failed');
  return res.stdout;
};
const owner={legacyUserId:'synthetic_owner',
  supabaseUserId:'11111111-1111-4111-8111-111111111111'};
const source='https://fra.cloud.appwrite.io/v1|scratch|life_tracker|synthetic';
const leaseId='lease_1',generation='generation_1',ts='2026-10-26T00:00:00Z';
const personal=(id,isDeleted,columns)=>({
  id,userId:owner.legacyUserId,isDeleted,columns,
  serverCreatedAt:ts,serverUpdatedAt:ts,
  originalPermissions:['read("user:synthetic_owner")'],
});
const taskIdentities=[
  {id:'task_1',userId:owner.legacyUserId,isDeleted:false},
  {id:'task_2',userId:owner.legacyUserId,isDeleted:true},
];
const buckets=[{id:'bucket_1',userId:owner.legacyUserId,isDeleted:false,
  title:'Private bucket',description:'',achieved:false,achievedAt:'',
  createdAt:ts,updatedAt:ts}];
const links=[{id:'link_1',userId:owner.legacyUserId,isDeleted:true,
  bucketListId:'bucket_1',taskId:'a'.repeat(255),createdAt:ts,updatedAt:ts}];
const rows={
  tasks:[personal('task_1',false,{title:'Personal memo',memo:null,image:'file_1'}),
         personal('task_2',true,{title:'Deleted task',image:null})],
  categories:[personal('cat_1',false,{name:'Private'})],
  diary:[personal('diary_1',false,{content:'Diary',photos:'["file_2"]'})],
  settings:[personal('setting_1',false,{key:'color',value:'blue'})],
  taskIdentities,buckets,links,
};
const counts={tasks:2,categories:1,diary:1,settings:1,buckets:1,links:1};
const fp={
  personal:Object.fromEntries(['tasks','categories','diary','settings']
    .map(k=>[k,rowHash(rows[k])])),
  history:{tasks:rowHash(taskIdentities),buckets:rowHash(buckets),links:rowHash(links)},
};
const personalScanSha256=hash(JSON.stringify({
  deployment:source,owner:owner.legacyUserId,generation,
  originalOwnerCounts:{tasks:2,categories:1,diary:1,settings:1},
  sourceOwnerCounts:{tasks:2,buckets:1,links:1},
  fingerprintSha256:fp.personal,
}));
const sevenDomainScanSha256=hash(JSON.stringify({
  personal:personalScanSha256,historical:fp.history,
  leaseId,owner:owner.legacyUserId,generation,
}));
const payload={
  format:'mosaic-appwrite-full-owner-source',version:1,owner,
  sourceDeploymentId:source,leaseId,generation,counts,
  personalScanSha256,sevenDomainScanSha256,fingerprints:fp,rows,
  sourceServerAuthorityAuthenticated:false,storageBytesIncluded:false,
  providerCutoverEligible:false,
};
const root=await mkdtemp(join(process.env.RUNNER_TEMP,'mosaic-source-age-'));
await chmod(root,0o700);
try{
  const key=join(root,'identity.agekey');
  run('/usr/bin/age-keygen',['-o',key]);await chmod(key,0o600);
  const recipient=run('/usr/bin/age-keygen',['-y',key]).toString('utf8').trim();
  const file=join(root,'full-original-owner.age');
  const clear=JSON.stringify(payload);
  const encrypted=await encryptAppwriteFullOwnerSource(payload,{
    recipient,destination:file,
  });
  assert.equal(encrypted.plainSha256,hash(clear));
  const cipher=await readFile(file);
  assert.equal(encrypted.cipherSha256,hash(cipher));
  assert.equal((await stat(file)).mode&0o777,0o600);
  assert.deepEqual(run('/usr/bin/age',['-d','-i',key,file]),Buffer.from(clear));
  const pins={archivePath:file,identityPath:key,
    expectedCipherSha256:encrypted.cipherSha256,
    expectedPlainSha256:encrypted.plainSha256,
    expectedSevenDomainScanSha256:sevenDomainScanSha256,
    expectedOwner:owner,expectedSourceDeploymentId:source,
    expectedLeaseId:leaseId,expectedGeneration:generation,expectedCounts:counts};
  const proof=await verifyAppwriteFullOwnerSource(pins);
  assert.deepEqual(proof.counts,counts);
  assert.equal(proof.storageBytesIncluded,false);
  assert.equal(proof.providerCutoverEligible,false);
  await assert.rejects(encryptAppwriteFullOwnerSource(payload,{
    recipient,destination:file,
  }),{code:'EEXIST'});
  assert.deepEqual(await readFile(file),cipher);
  for(const [patch,reason] of [
    [{expectedCipherSha256:'0'.repeat(64)},/encrypted bytes/],
    [{expectedPlainSha256:'0'.repeat(64)},/plaintext pin/],
    [{expectedSevenDomainScanSha256:'0'.repeat(64)},/independent pins/],
    [{expectedOwner:{...owner,legacyUserId:'foreign'}},/independent pins/],
    [{expectedSourceDeploymentId:'wrong'},/independent pins/],
    [{expectedGeneration:'wrong'},/independent pins/],
    [{expectedCounts:{...counts,links:0}},/independent pins/],
  ]) await assert.rejects(verifyAppwriteFullOwnerSource({...pins,...patch}),reason);
  for(const [change,reason] of [
    [x=>{x.rows.tasks[1].isDeleted=false;},/fingerprint/],
    [x=>{x.rows.diary[0].userId='foreign';},/foreign/],
    [x=>{x.rows.taskIdentities[0].id='task_2';},/unordered/],
    [x=>{x.rows.links=[];},/count/],
    [x=>{x.rows.tasks[0].columns.memo='changed';},/fingerprint/],
    [x=>{x.providerCutoverEligible=true;},/privileged/],
  ]){
    const original=structuredClone(payload);change(original);
    await assert.rejects(encryptAppwriteFullOwnerSource(original,{
      recipient,destination:join(root,'bad.age'),
    }),reason);
  }
  const forged=structuredClone(payload);forged.rows.diary[0].userId='foreign';
  const original=Buffer.from(JSON.stringify(forged),'utf8');
  const badBytes=run('/usr/bin/age',['-r',recipient],{input:original});
  const badPath=join(root,'forged.age');
  await writeFile(badPath,badBytes,{flag:'wx',mode:0o600});
  await assert.rejects(verifyAppwriteFullOwnerSource({
    ...pins,archivePath:badPath,expectedCipherSha256:hash(badBytes),
    expectedPlainSha256:hash(original),
  }),/foreign/);
  await rm(badPath);
  assert.deepEqual((await readdir(root)).sort(),
    ['identity.agekey','full-original-owner.age'].sort());
  console.log('MOSAIC_FULL_OWNER_ORIGINAL_SOURCE_AGE_ROUNDTRIP_PASS');
}finally{await rm(root,{recursive:true,force:true});}
