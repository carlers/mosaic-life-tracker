/**
 * #1027 OFFLINE-only age X25519 complete owner Appwrite source escrow.
 * No cloud requests, plaintext files, source signer or import activation.
 * An independently supplied manifest pin is integrity, NOT proof the reader
 * really obtained a frozen trusted Appwrite source.
 */
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, realpath, open, readFile, link, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute } from 'node:path';

const SHA = /^[a-f0-9]{64}$/;
const RECIPIENT = /^age1[a-z0-9]{58}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;
const MAX = 64 * 1024 * 1024;
const MAX_CIPHER = 80 * 1024 * 1024;
const MAX_ROWS = 250000;
const PERSONAL = ['tasks', 'categories', 'diary', 'settings'];
const HISTORY = ['tasks', 'buckets', 'links'];
const COUNT_DOMAINS = ['tasks', 'categories', 'diary', 'settings', 'buckets', 'links'];
const ROW_DOMAINS = ['tasks', 'categories', 'diary', 'settings', 'taskIdentities', 'buckets', 'links'];
const sha = data => createHash('sha256').update(data).digest('hex');
function fail(s) { throw new Error('Appwrite full source archive: ' + s); }
function exact(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}
function rowHash(rows) {
  const h = createHash('sha256');
  for (const row of rows) {
    const txt = JSON.stringify(row);
    if (typeof txt !== 'string') fail('invalid original row');
    h.update(Buffer.byteLength(txt, 'utf8') + ':');
    h.update(txt, 'utf8');
  }
  return h.digest('hex');
}
function validate(data) {
  if (!exact(data, ['format','version','owner','sourceDeploymentId','leaseId',
    'generation','counts','personalScanSha256','sevenDomainScanSha256',
    'fingerprints','rows','sourceServerAuthorityAuthenticated',
    'storageBytesIncluded','providerCutoverEligible']) ||
    data.format !== 'mosaic-appwrite-full-owner-source' || data.version !== 1 ||
    !exact(data.owner,['legacyUserId','supabaseUserId']) ||
    typeof data.owner.legacyUserId !== 'string' || !ID.test(data.owner.legacyUserId) ||
    typeof data.owner.supabaseUserId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.owner.supabaseUserId) ||
    typeof data.sourceDeploymentId !== 'string' || !data.sourceDeploymentId.startsWith('https://') ||
    typeof data.leaseId !== 'string' || !data.leaseId ||
    typeof data.generation !== 'string' || !data.generation ||
    !SHA.test(data.personalScanSha256) || !SHA.test(data.sevenDomainScanSha256) ||
    data.sourceServerAuthorityAuthenticated !== false ||
    data.storageBytesIncluded !== false || data.providerCutoverEligible !== false ||
    !exact(data.counts,COUNT_DOMAINS) ||
    !exact(data.fingerprints,['personal','history']) ||
    !exact(data.fingerprints.personal,PERSONAL) ||
    !exact(data.fingerprints.history,HISTORY) ||
    !exact(data.rows,ROW_DOMAINS))
    fail('unexpected, privileged or incomplete source envelope');
  for (const domain of ROW_DOMAINS) {
    const rows = data.rows[domain];
    const count = data.counts[domain === 'taskIdentities' ? 'tasks' : domain];
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_ROWS ||
        !Array.isArray(rows) || rows.length !== count)
      fail('owner row count differs from pinned complete scan: ' + domain);
    let previous = '';
    for (const item of rows) {
      if (!item || !ID.test(item.id) || item.id <= previous ||
          item.userId !== data.owner.legacyUserId ||
          typeof item.isDeleted !== 'boolean')
        fail('foreign, duplicate, unordered or missing tombstone: ' + domain);
      previous = item.id;
      if (PERSONAL.includes(domain) &&
          (!exact(item,['id','userId','isDeleted','columns','serverCreatedAt',
                        'serverUpdatedAt','originalPermissions']) ||
           !item.columns || typeof item.columns !== 'object' ||
           Array.isArray(item.columns) ||
           ![null,undefined].includes(item.originalPermissions) &&
             (!Array.isArray(item.originalPermissions) ||
              item.originalPermissions.some(x=>typeof x!=='string'))))
        fail('invalid full original personal columns or source ACL');
    }
    const fp = domain === 'taskIdentities' ? data.fingerprints.history.tasks :
      domain === 'buckets' || domain === 'links' ?
      data.fingerprints.history[domain] : data.fingerprints.personal[domain];
    if (!SHA.test(fp) || rowHash(rows) !== fp)
      fail('source row contents differ from two-pass fingerprint: ' + domain);
  }
  const ids = data.rows.taskIdentities;
  for (let i=0;i<ids.length;i++) {
    const row = data.rows.tasks[i];
    const old = ids[i];
    if (old.id!==row.id || old.userId!==row.userId ||
        old.isDeleted!==row.isDeleted)
      fail('task full content identity/tombstone mismatch');
  }
  const owner = data.owner.legacyUserId;
  const pc = data.fingerprints.personal;
  const hc = data.fingerprints.history;
  const personalSummary = {
    deployment:data.sourceDeploymentId,owner,generation:data.generation,
    originalOwnerCounts:Object.fromEntries(PERSONAL.map(x=>[x,data.counts[x]])),
    sourceOwnerCounts:Object.fromEntries(HISTORY.map(x=>[x,data.counts[x]])),
    fingerprintSha256:pc,
  };
  if (sha(JSON.stringify(personalSummary)) !== data.personalScanSha256)
    fail('original personal scan digest mismatch');
  const seven = {personal:data.personalScanSha256,historical:hc,
    leaseId:data.leaseId,owner,generation:data.generation};
  if (sha(JSON.stringify(seven)) !== data.sevenDomainScanSha256)
    fail('seven-domain cross-source digest mismatch');
  return data;
}
async function privatePath(path, directory) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('absolute private path required');
  const info = await lstat(path);
  if (!(directory?info.isDirectory():info.isFile()) ||
      (info.mode & 0o077) !== 0 ||
      (process.getuid && info.uid!==process.getuid()) ||
      await realpath(path)!==path)
    fail('private path permissions or type refused');
  return info;
}
function binaryPath(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || basename(path)!=='age')
    fail('reviewed absolute age binary required');
}
/** The returned plaintext digest is not a trusted external witness by itself. */
export async function encryptAppwriteFullOwnerSource(payload, options) {
  validate(payload);
  const {recipient,destination} = options??{};
  const age = options?.ageExecutable??'/usr/bin/age';
  binaryPath(age);
  if (typeof recipient!=='string' || !RECIPIENT.test(recipient) ||
      typeof destination!=='string' || !isAbsolute(destination) ||
      !/^[A-Za-z0-9_.-]+\.age$/.test(basename(destination)))
    fail('invalid recipient or private archive destination');
  const dir = dirname(destination);
  await privatePath(dir,true);
  const clear = Buffer.from(JSON.stringify(payload),'utf8');
  if (!clear.length || clear.length>MAX) {clear.fill(0);fail('bounded source memory exceeded');}
  const temp = dir+'/.mosaic-full-owner-'+randomBytes(12).toString('hex')+'.tmp';
  let handle;
  try {
    handle = await open(temp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY,0o600);
    await new Promise((resolve,reject)=>{
      const child=spawn(age,['-r',recipient],{
        stdio:['pipe',handle.fd,'ignore'],env:{PATH:'/usr/bin:/bin'},
      });
      child.once('error',()=>reject(new Error('Private full source age unavailable')));
      child.once('close',code=>code===0?resolve():reject(
        new Error('Private full source age encryption failed')));
      child.stdin?.on('error',()=>{});
      child.stdin?.end(clear);
    });
    await handle.sync(); await handle.close(); handle=undefined;
    const ciphertext=await readFile(temp);
    let cipherSha;
    try {
      if (ciphertext.length<32 || ciphertext.length>MAX_CIPHER ||
          !ciphertext.subarray(0,25).toString('utf8').startsWith('age-encryption.org/v1'))
        fail('invalid age ciphertext');
      cipherSha=sha(ciphertext);
    } finally {ciphertext.fill(0);}
    await link(temp,destination); await unlink(temp);
    const dirHandle=await open(dir,constants.O_RDONLY);
    try{await dirHandle.sync();}finally{await dirHandle.close();}
    return {cipherSha256:cipherSha,plainSha256:sha(clear),
      sevenDomainScanSha256:payload.sevenDomainScanSha256};
  } finally {
    clear.fill(0);
    if(handle)await handle.close().catch(()=>{});
    await unlink(temp).catch(()=>{});
  }
}
/** Validate age ciphertext against OUT-OF-BAND pinned SHA values, privately
 * decrypt in bounded memory, revalidate every row; emit metadata only.
 */
export async function verifyAppwriteFullOwnerSource(options) {
  const {
    archivePath,identityPath,expectedCipherSha256,expectedPlainSha256,
    expectedSevenDomainScanSha256,expectedOwner,expectedSourceDeploymentId,
    expectedLeaseId,expectedGeneration,expectedCounts,
  }=options??{};
  const age=options?.ageExecutable??'/usr/bin/age';
  binaryPath(age);
  if (![expectedCipherSha256,expectedPlainSha256,
        expectedSevenDomainScanSha256].every(x=>typeof x==='string'&&SHA.test(x)) ||
      !exact(expectedOwner,['legacyUserId','supabaseUserId']) ||
      typeof expectedSourceDeploymentId!=='string' || !expectedSourceDeploymentId ||
      typeof expectedLeaseId!=='string' || !expectedLeaseId ||
      typeof expectedGeneration!=='string' || !expectedGeneration ||
      !exact(expectedCounts,COUNT_DOMAINS))
    fail('independently authenticated owner/source/archive pins required');
  const original = await privatePath(archivePath,false);
  await privatePath(dirname(archivePath),true);
  await privatePath(identityPath,false);
  await privatePath(dirname(identityPath),true);
  if (!original.size || original.size>MAX_CIPHER)fail('ciphertext too large');
  const encrypted=await readFile(archivePath);
  try {
    if(encrypted.length!==original.size || sha(encrypted)!==expectedCipherSha256 ||
       !encrypted.subarray(0,25).toString('utf8').startsWith('age-encryption.org/v1'))
      fail('encrypted bytes differ from independent ciphertext pin');
  } finally {encrypted.fill(0);}
  const res=spawnSync(age,['-d','-i',identityPath,archivePath],{
    encoding:'buffer',maxBuffer:MAX,timeout:30000,
    env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','ignore'],
  });
  const bytes=Buffer.isBuffer(res.stdout)?res.stdout:Buffer.alloc(0);
  let data;
  try {
    if(res.error || res.status!==0 || !bytes.length || bytes.length>MAX)
      fail('private age decryption failed');
    if(sha(bytes)!==expectedPlainSha256)
      fail('decrypted original owner content differs from independent plaintext pin');
    try{data=JSON.parse(bytes.toString('utf8'));}
    catch {fail('invalid decrypted owner source JSON');}
  }finally{bytes.fill(0);}
  validate(data);
  if (JSON.stringify(data.owner)!==JSON.stringify(expectedOwner) ||
      data.sourceDeploymentId!==expectedSourceDeploymentId ||
      data.leaseId!==expectedLeaseId || data.generation!==expectedGeneration ||
      data.sevenDomainScanSha256!==expectedSevenDomainScanSha256 ||
      COUNT_DOMAINS.some(k=>data.counts[k]!==expectedCounts[k]))
    fail('decrypted owner, lease, generation or counts differ from independent pins');
  return {cipherSha256:expectedCipherSha256,plainSha256:expectedPlainSha256,
    sevenDomainScanSha256:expectedSevenDomainScanSha256,
    owner:{...expectedOwner},counts:{...expectedCounts},
    storageBytesIncluded:false,sourceServerAuthorityAuthenticated:false,
    providerCutoverEligible:false};
}
