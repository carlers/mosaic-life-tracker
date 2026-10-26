/**
 * #1027 offline, independently pinned owner-history ciphertext readback.
 * NO backend/network calls, decrypted files, importer or writer activation.
 * Caller MUST establish external trusted source SHA/count/owner evidence.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, dirname } from 'node:path';

const SHA = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const LONG_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;
const MAX_PLAINTEXT = 8 * 1024 * 1024;
const MAX_CIPHERTEXT = 16 * 1024 * 1024;
const MAX_LINKS = 250_000;
const REASONS = new Set([
  'missing-bucket', 'missing-task', 'deleted-bucket',
  'deleted-task', 'long-task-reference',
]);
function sha(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
function identicalFields(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
}
function safeCounts(value) {
  return value && typeof value === 'object' &&
    (['tasks', 'buckets', 'links']).every(key =>
      Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= MAX_LINKS);
}
async function privateRegular(path, label) {
  if (typeof path !== 'string' || !isAbsolute(path))
    throw new Error('Owner ' + label + ' must be an absolute private file');
  const [file, dir] = await Promise.all([lstat(path), lstat(dirname(path))]);
  if (!file.isFile() || (file.mode & 0o077) ||
      !dir.isDirectory() || (dir.mode & 0o077) ||
      (process.getuid && (file.uid !== process.getuid() || dir.uid !== process.getuid())) ||
      await realpath(path) !== path || await realpath(dirname(path)) !== dirname(path))
    throw new Error('Owner ' + label + ' must be an owned private file in a private directory');
  return file;
}

/**
 * Returns ONLY verification metadata. Does not write plaintext or return
 * records. A matching SHA is integrity, not identity or source provenance:
 * expectedManifestSha256 and sourceArchiveSha256 must be independently
 * authenticated; do not derive them from the candidate ciphertext.
 */
export async function verifyEncryptedOwnerHistory(options) {
  const {
    archivePath, identityPath, expectedCipherSha256,
    expectedManifestSha256, expectedSourceArchiveSha256,
    expectedTargetIdentitySha256, expectedOwner, expectedCounts,
  } = options ?? {};
  const binary = options?.ageExecutable ?? '/usr/bin/age';
  if (![expectedCipherSha256, expectedManifestSha256,
        expectedSourceArchiveSha256, expectedTargetIdentitySha256].every(s => SHA.test(s)) ||
      !expectedOwner || typeof expectedOwner.legacyUserId !== 'string' ||
      !expectedOwner.legacyUserId || typeof expectedOwner.supabaseUserId !== 'string' ||
      !expectedOwner.supabaseUserId || !safeCounts(expectedCounts) ||
      !isAbsolute(binary) || !binary.endsWith('/age'))
    throw new Error('Owner archive verifier requires independently pinned source evidence');
  const file = await privateRegular(archivePath, 'archive');
  await privateRegular(identityPath, 'age identity');
  if (!file.size || file.size > MAX_CIPHERTEXT)
    throw new Error('Private owner ciphertext size outside reviewed bound');
  const ciphertext = await readFile(archivePath);
  try {
    if (ciphertext.length !== file.size || sha(ciphertext) !== expectedCipherSha256 ||
        !ciphertext.subarray(0, 25).toString('utf8').startsWith('age-encryption.org/v1'))
      throw new Error('Owner ciphertext failed independently pinned encrypted-byte authentication');
  } finally {
    ciphertext.fill(0);
  }
  // The age key never enters process env, argv contents, GitHub logs or chat;
  // only its private on-disk FILE PATH is supplied to the age executable.
  const decrypted = spawnSync(binary, ['--decrypt', '-i', identityPath, archivePath], {
    encoding: 'buffer', timeout: 30_000, maxBuffer: MAX_PLAINTEXT,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { PATH: '/usr/bin:/bin' },
  });
  const plaintext = Buffer.isBuffer(decrypted.stdout) ? decrypted.stdout : Buffer.alloc(0);
  let data;
  try {
    if (decrypted.error || decrypted.status !== 0 ||
        !plaintext.length || plaintext.length > MAX_PLAINTEXT)
      throw new Error('Authenticated owner archive age decryption failed');
    if (sha(plaintext) !== expectedManifestSha256)
      throw new Error('Decrypted owner history differs from independently pinned manifest');
    try { data = JSON.parse(plaintext.toString('utf8')); }
    catch { throw new Error('Invalid decrypted owner history JSON'); }
  } finally {
    plaintext.fill(0);
  }
  if (!identicalFields(data, ['format','version','owner',
       'sourceArchiveSha256','sourceCounts','targetIdentitySha256','links']) ||
      data.format !== 'mosaic-owner-bucket-link-history' || data.version !== 1 ||
      !identicalFields(data.owner, ['legacyUserId','supabaseUserId']) ||
      data.owner.legacyUserId !== expectedOwner.legacyUserId ||
      data.owner.supabaseUserId !== expectedOwner.supabaseUserId ||
      !SHA.test(data.sourceArchiveSha256) ||
      data.sourceArchiveSha256 !== expectedSourceArchiveSha256 ||
      data.targetIdentitySha256 !== expectedTargetIdentitySha256 ||
      !safeCounts(data.sourceCounts) ||
      !(['tasks','buckets','links']).every(key =>
        data.sourceCounts[key] === expectedCounts[key]) ||
      !Array.isArray(data.links) || data.links.length !== expectedCounts.links)
    throw new Error('Decrypted owner history contradicts independently pinned source witness');
  let priorId = '';
  const result = { ready: 0, tombstone: 0, quarantined: 0 };
  for (const entry of data.links) {
    if (!identicalFields(entry, ['source','disposition','reasons']) ||
        !identicalFields(entry.source,
          ['id','userId','bucketListId','taskId','createdAt','updatedAt','isDeleted']) ||
        !ID.test(entry.source.id) || entry.source.id <= priorId ||
        entry.source.userId !== expectedOwner.legacyUserId ||
        !ID.test(entry.source.bucketListId) ||
        !LONG_ID.test(entry.source.taskId) ||
        typeof entry.source.isDeleted !== 'boolean' ||
        !['createdAt','updatedAt'].every(key =>
          typeof entry.source[key] === 'string' &&
          entry.source[key].length <= 50 &&
          Number.isFinite(Date.parse(entry.source[key]))) ||
        !Array.isArray(entry.reasons) ||
        new Set(entry.reasons).size !== entry.reasons.length ||
        entry.reasons.some(reason => !REASONS.has(reason)) ||
        !Object.hasOwn(result, entry.disposition))
      throw new Error('Malformed, foreign or duplicate historical link in authenticated archive');
    const long = entry.source.taskId.length > 36;
    if (entry.reasons.includes('long-task-reference') !== long ||
        (entry.disposition === 'ready' &&
         (entry.source.isDeleted || entry.reasons.length)) ||
        (entry.disposition === 'tombstone' &&
         (!entry.source.isDeleted || entry.reasons.length)) ||
        (entry.disposition === 'quarantined' && !entry.reasons.length))
      throw new Error('Historical link quarantine classification changed after encryption');
    priorId = entry.source.id;
    result[entry.disposition]++;
  }
  return {
    ciphertextSha256: expectedCipherSha256,
    manifestSha256: expectedManifestSha256,
    sourceArchiveSha256: expectedSourceArchiveSha256,
    targetIdentitySha256: expectedTargetIdentitySha256,
    counts: { ...expectedCounts },
    dispositionCounts: result,
  };
}
