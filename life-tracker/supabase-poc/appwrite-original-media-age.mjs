/**
 * #1027 OFFLINE source-only original Appwrite private-media byte escrow.
 * Input is an independently sourced, complete owner Storage inventory and
 * existing 0600 private WebP files. No API, importer, source signer or writer.
 * Caller pins require OUT-OF-BAND trusted authentication.
 */
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, realpath, open, readFile, readdir, link, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

const SHA=/^[a-f0-9]{64}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/;
const FILE=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;
const AGE=/^age1[a-z0-9]{58}$/;
const MAX_FILE=5*1024*1024,MAX_OBJECTS=100000;
const MAX_CLEAR=32*1024*1024,MAX_CIPHER=40*1024*1024;
const sha=x=>createHash('sha256').update(x).digest('hex');
const keys=(x,k)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).sort().join('|')===[...k].sort().join('|');
const deny=x=>{throw new Error('Appwrite original media escrow: '+x);};
const goodSha=x=>typeof x==='string'&&SHA.test(x);
const SOURCE=['ownerLegacyId','sourceDeploymentId','sourceArchiveCipherSha256',
  'sevenDomainScanSha256','sourceAclWitnessSha256','expectedOwnerFileCount',
  'expectedOwnerInventorySha256'];
function inventory(input){
  if(!keys(input,[...SOURCE,'objects'])||!OWNER.test(input.ownerLegacyId)||
    typeof input.sourceDeploymentId!=='string'||
    !input.sourceDeploymentId.startsWith('https://')||
    !input.sourceDeploymentId.includes('|life_tracker|')||
    ![input.sourceArchiveCipherSha256,input.sevenDomainScanSha256,
      input.sourceAclWitnessSha256,input.expectedOwnerInventorySha256].every(goodSha)||
    !Number.isSafeInteger(input.expectedOwnerFileCount)||
    input.expectedOwnerFileCount<0||input.expectedOwnerFileCount>MAX_OBJECTS||
    !Array.isArray(input.objects)||input.objects.length!==input.expectedOwnerFileCount)
    deny('complete owner inventory and independently pinned source evidence required');
  const sorted=[...input.objects].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  let previous='';
  for(const obj of sorted){
    if(!keys(obj,['id','ownerId','bytes','sha256'])||
      typeof obj.id!=='string'||!FILE.test(obj.id)||obj.id<=previous||
      obj.ownerId!==input.ownerLegacyId||
      !Number.isSafeInteger(obj.bytes)||obj.bytes<=0||obj.bytes>MAX_FILE||
      !goodSha(obj.sha256))
      deny('foreign, duplicate or unreviewed original owner file');
    previous=obj.id;
  }
  if(sha(JSON.stringify(sorted))!==input.expectedOwnerInventorySha256)
    deny('original owner inventory differs from independent witness');
  return sorted;
}
async function privatePath(path,directory){
  if(typeof path!=='string'||!isAbsolute(path))deny('absolute private path required');
  const info=await lstat(path);
  if(!(directory?info.isDirectory():info.isFile())||
    (info.mode&0o077)!==0||
    (process.getuid&&info.uid!==process.getuid())||
    await realpath(path)!==path)
    deny('private owner directory/file refused');
  return info;
}
function agePath(path){
  if(typeof path!=='string'||!isAbsolute(path)||basename(path)!=='age')
    deny('reviewed absolute age executable required');
}
function checkMedia(data){
  if(!keys(data,['format','version','source','objects',
    'actualServerFreezeProven','originalMembershipIndependentlyAuthenticated',
    'providerCutoverEligible'])||
    data.format!=='mosaic-appwrite-owner-private-media'||data.version!==1||
    data.actualServerFreezeProven!==false||
    data.originalMembershipIndependentlyAuthenticated!==false||
    data.providerCutoverEligible!==false||
    !keys(data.source,SOURCE)||!Array.isArray(data.objects))
    deny('unexpected or privileged decrypted media envelope');
  const list=[];
  for(const item of data.objects){
    if(!keys(item,['id','ownerId','bytes','sha256','dataBase64'])||
      typeof item.dataBase64!=='string'||
      item.dataBase64.length>4*Math.ceil(MAX_FILE/3))
      deny('unreviewed decrypted media object');
    const raw=Buffer.from(item.dataBase64,'base64');
    try{
      if(raw.length!==item.bytes||raw.toString('base64')!==item.dataBase64||
         sha(raw)!==item.sha256)
        deny('original file byte length, digest or encoding mismatch');
    }finally{raw.fill(0);}
    list.push({id:item.id,ownerId:item.ownerId,bytes:item.bytes,sha256:item.sha256});
  }
  inventory({...data.source,objects:list});
  return {source:data.source,count:list.length,
    totalBytes:list.reduce((n,f)=>n+f.bytes,0)};
}
/** Encrypt all staged originals, including unreferenced files, without truncation. */
export async function encryptAppwriteOriginalOwnerMedia(input,options){
  const objects=inventory(input);
  const {sourceDirectory,destination,recipient}=options??{};
  const binary=options?.ageExecutable??'/usr/bin/age';
  agePath(binary);
  if(typeof recipient!=='string'||!AGE.test(recipient)||
    typeof sourceDirectory!=='string'||typeof destination!=='string'||
    !isAbsolute(destination)||!/^[A-Za-z0-9_.-]+\.age$/.test(basename(destination)))
    deny('invalid media recipient or destination');
  await privatePath(sourceDirectory,true);
  await privatePath(dirname(destination),true);
  const expectedNames=objects.map(x=>x.id+'.webp').sort();
  if(JSON.stringify((await readdir(sourceDirectory)).sort())!==JSON.stringify(expectedNames))
    deny('incomplete or extra original owner files in staging directory');
  const media=[];let totalBytes=0;
  for(const item of objects){
    const path=join(sourceDirectory,item.id+'.webp');
    await privatePath(path,false);
    const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    let raw;
    try{
      const before=await h.stat();
      if(!before.isFile()||before.size!==item.bytes||
        (before.mode&0o077)!==0||
        (process.getuid&&before.uid!==process.getuid()))
        deny('original media ownership or length mismatch');
      raw=await h.readFile();
      const after=await h.stat();
      if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||
         after.ctimeMs!==before.ctimeMs||
         raw.length!==item.bytes||sha(raw)!==item.sha256)
        deny('original file changed or differs from pinned contents');
      totalBytes+=raw.length;
      if(totalBytes>MAX_CLEAR/2)deny('original bytes exceed bounded archive');
      media.push({...item,dataBase64:raw.toString('base64')});
    }finally{if(raw)raw.fill(0);await h.close();}
  }
  if(JSON.stringify((await readdir(sourceDirectory)).sort())!==JSON.stringify(expectedNames))
    deny('staged original owner file set changed during capture');
  const source={...input};delete source.objects;
  const payload={format:'mosaic-appwrite-owner-private-media',version:1,
    source,objects:media,actualServerFreezeProven:false,
    originalMembershipIndependentlyAuthenticated:false,providerCutoverEligible:false};
  const plain=Buffer.from(JSON.stringify(payload),'utf8');
  for(const item of media)item.dataBase64='';
  if(!plain.length||plain.length>MAX_CLEAR){plain.fill(0);deny('media archive bound exceeded');}
  const tmp=dirname(destination)+'/.mosaic-owner-media-'+randomBytes(12).toString('hex')+'.tmp';
  let handle;
  try{
    handle=await open(tmp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY,0o600);
    await new Promise((resolve,reject)=>{
      const child=spawn(binary,['-r',recipient],{
        stdio:['pipe',handle.fd,'ignore'],env:{PATH:'/usr/bin:/bin'},
      });
      child.once('error',()=>reject(new Error('Original media age encryption unavailable')));
      child.once('close',code=>code===0?resolve():reject(
        new Error('Original media age encryption failed')));
      child.stdin?.on('error',()=>{});
      child.stdin?.end(plain);
    });
    await handle.sync();await handle.close();handle=undefined;
    const encrypted=await readFile(tmp);let cipherSha;
    try{
      if(encrypted.length<32||encrypted.length>MAX_CIPHER||
         !encrypted.subarray(0,25).toString('utf8').startsWith('age-encryption.org/v1'))
        deny('missing original media age ciphertext header');
      cipherSha=sha(encrypted);
    }finally{encrypted.fill(0);}
    await link(tmp,destination);await unlink(tmp);
    const dirfd=await open(dirname(destination),constants.O_RDONLY);
    try{await dirfd.sync();}finally{await dirfd.close();}
    return {cipherSha256:cipherSha,plainSha256:sha(plain),
      sourceArchiveCipherSha256:source.sourceArchiveCipherSha256,
      originalOwnerInventorySha256:source.expectedOwnerInventorySha256,
      objects:objects.length,originalBytes:totalBytes,
      actualServerFreezeProven:false,providerCutoverEligible:false};
  }finally{
    plain.fill(0);if(handle)await handle.close().catch(()=>{});
    await unlink(tmp).catch(()=>{});
  }
}
/** Out-of-band pins required; returns only counts/checksums, never bytes. */
export async function verifyAppwriteOriginalOwnerMedia(options){
  const {archivePath,identityPath,expectedCipherSha256,expectedPlainSha256,
    expectedSource,expectedOriginalBytes}=options??{};
  const binary=options?.ageExecutable??'/usr/bin/age';
  agePath(binary);
  if(![expectedCipherSha256,expectedPlainSha256].every(goodSha)||
     !keys(expectedSource,SOURCE)||
     !Number.isSafeInteger(expectedOriginalBytes)||expectedOriginalBytes<0)
    deny('independent ciphertext, source, count and byte pins required');
  const info=await privatePath(archivePath,false);
  await privatePath(dirname(archivePath),true);
  await privatePath(identityPath,false);
  await privatePath(dirname(identityPath),true);
  if(!info.size||info.size>MAX_CIPHER)deny('ciphertext outside size bound');
  const encrypted=await readFile(archivePath);
  try{
    if(encrypted.length!==info.size||sha(encrypted)!==expectedCipherSha256||
       !encrypted.subarray(0,25).toString('utf8').startsWith('age-encryption.org/v1'))
      deny('encrypted media bytes disagree with independently pinned ciphertext');
  }finally{encrypted.fill(0);}
  const proc=spawnSync(binary,['-d','-i',identityPath,archivePath],{
    encoding:'buffer',maxBuffer:MAX_CLEAR,timeout:30000,
    env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','ignore'],
  });
  const clear=Buffer.isBuffer(proc.stdout)?proc.stdout:Buffer.alloc(0);
  let data;
  try{
    if(proc.error||proc.status!==0||!clear.length||clear.length>MAX_CLEAR)
      deny('private original media age decryption failed');
    if(sha(clear)!==expectedPlainSha256)
      deny('decrypted original media differs from independently pinned manifest');
    try{data=JSON.parse(clear.toString('utf8'));}
    catch{deny('invalid decrypted original media JSON');}
  }finally{clear.fill(0);}
  const verified=checkMedia(data);
  if(Object.keys(expectedSource).some(k=>verified.source[k]!==expectedSource[k])||
     verified.totalBytes!==expectedOriginalBytes)
    deny('original media owner, source, inventory or byte count differs from pins');
  return {cipherSha256:expectedCipherSha256,plainSha256:expectedPlainSha256,
    ownerLegacyId:verified.source.ownerLegacyId,objects:verified.count,
    originalBytes:verified.totalBytes,
    sourceArchiveCipherSha256:verified.source.sourceArchiveCipherSha256,
    sourceAclWitnessSha256:verified.source.sourceAclWitnessSha256,
    nonemptyOriginalMediaLocallyVerified:verified.count>0,
    actualServerFreezeProven:false,
    originalMembershipIndependentlyAuthenticated:false,
    providerCutoverEligible:false};
}
