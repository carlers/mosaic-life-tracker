/**
 * Scratch-only, protected offsite ciphertext copies for Supabase private Storage.
 * No credential is compiled into frontend artifacts. Not a hosted cutover tool.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import {
  parseCompletedMarkerKey,
  selectRetainedSnapshotIds,
} from '../appwrite-functions/dr-backup/retention.mjs';

export const PREFIX = 'mosaic-supabase-media/v1';
export const SOURCE_PROJECT = 'mosaic-dev';
export const BUCKET = 'mosaic-personal-photos';
export const CHUNK_BYTES = 8 * 1024 * 1024;
const HEX = /^[a-f0-9]{64}$/;
const ID = /^\d{8}T\d{9}Z$/;
const MAX_PARTS = 10000;

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const makeId = (now) => now.toISOString().replace(/[-:.]/g, '');
const snapPrefix = (prefix, id) => `${prefix}/snapshots/${id}`;
const committedKey = (prefix, id) => `${snapPrefix(prefix, id)}/COMPLETED`;
function requirePrefix(prefix) {
  if (prefix !== PREFIX) throw new Error('Unexpected recovery prefix');
}
function requireId(id) {
  if (!ID.test(id)) throw new Error('Invalid backup identifier');
}

/** A COMPLETED marker is the only published restore point. */
export async function uploadCiphertext({ r2, archive, now = new Date(), prefix = PREFIX, chunkBytes = CHUNK_BYTES }) {
  requirePrefix(prefix);
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > CHUNK_BYTES) {
    throw new Error('Unsafe encrypted chunk size');
  }
  const id = makeId(now);
  requireId(id);
  const root = snapPrefix(prefix, id);
  // No overwrite of an earlier completed/incomplete snapshot, even after crash.
  if ((await r2.listObjects(`${root}/`)).length !== 0) throw new Error('Snapshot prefix already exists');
  const info = await stat(archive);
  if (!info.isFile() || info.size <= 0 || info.size > MAX_PARTS * chunkBytes) {
    throw new Error('Encrypted snapshot size outside bounds');
  }
  const fh = await open(archive, 'r');
  const parts = [];
  const full = createHash('sha256');
  let bytes = 0;
  try {
    for (let index = 0; bytes < info.size; index++) {
      if (index >= MAX_PARTS) throw new Error('Encrypted part count exceeded');
      const length = Math.min(chunkBytes, info.size - bytes);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await fh.read(buffer, 0, length, bytes);
      if (bytesRead !== length) throw new Error('Ciphertext changed during upload');
      const sha256 = hash(buffer);
      const key = `${root}/parts/${String(index).padStart(5, '0')}.agechunk`;
      await r2.putObject(key, buffer, { metadata: { 'cipher-sha256': sha256 } });
      const remote = await r2.getObject(key);
      if (remote.length !== length || hash(remote) !== sha256) {
        throw new Error('Offsite ciphertext readback differs');
      }
      full.update(buffer);
      parts.push({ key, bytes: length, sha256 });
      bytes += length;
    }
  } finally {
    await fh.close();
  }
  if (bytes !== info.size || (await stat(archive)).size !== bytes) {
    throw new Error('Encrypted source changed during upload');
  }
  const marker = {
    format: 'mosaic-supabase-private-media-offsite', version: 1, id,
    sourceProject: SOURCE_PROJECT, bucket: BUCKET,
    completedAt: now.toISOString(), bytes, cipherSha256: full.digest('hex'), parts,
  };
  const markerBytes = Buffer.from(JSON.stringify(marker));
  await r2.putObject(committedKey(prefix, id), markerBytes, { metadata: { 'marker-sha256': hash(markerBytes) } });
  const remoteMarker = await r2.getObject(committedKey(prefix, id));
  if (hash(remoteMarker) !== hash(markerBytes)) throw new Error('Offsite completion marker readback differs');
  return marker;
}

function validateMarker(marker, prefix, id) {
  requirePrefix(prefix);
  requireId(id);
  const root = snapPrefix(prefix, id);
  if (marker?.format !== 'mosaic-supabase-private-media-offsite' || marker?.version !== 1 ||
      marker.id !== id || marker.sourceProject !== SOURCE_PROJECT || marker.bucket !== BUCKET ||
      typeof marker.completedAt !== 'string' ||
      !Number.isFinite(Date.parse(marker.completedAt)) ||
      !HEX.test(marker.cipherSha256 || '') ||
      !Number.isSafeInteger(marker.bytes) || marker.bytes <= 0 ||
      !Array.isArray(marker.parts) || marker.parts.length < 1 || marker.parts.length > MAX_PARTS) {
    throw new Error('Invalid offsite completion marker');
  }
  if (makeId(new Date(marker.completedAt)) !== id) throw new Error('Offsite marker timestamp mismatch');
  let total = 0;
  for (const [i, part] of marker.parts.entries()) {
    const expected = `${root}/parts/${String(i).padStart(5, '0')}.agechunk`;
    if (part?.key !== expected || !Number.isSafeInteger(part.bytes) ||
        part.bytes <= 0 || part.bytes > CHUNK_BYTES || !HEX.test(part.sha256 || '')) {
      throw new Error('Invalid offsite ciphertext part');
    }
    total += part.bytes;
  }
  if (total !== marker.bytes) throw new Error('Offsite ciphertext part count mismatch');
  return marker;
}

/** Reads every remote ciphertext byte, never requiring the age private identity. */
export async function verifyCiphertext({ r2, id, prefix = PREFIX, maxAgeHours = null, now = new Date(), output = null }) {
  requirePrefix(prefix);
  requireId(id);
  const markerBytes = await r2.getObject(committedKey(prefix, id));
  const marker = validateMarker(JSON.parse(markerBytes.toString('utf8')), prefix, id);
  const ageMs = now.getTime() - Date.parse(marker.completedAt);
  if (ageMs < 0 || (maxAgeHours != null && ageMs > maxAgeHours * 3600_000)) {
    throw new Error('Newest offsite recovery point stale or future-dated');
  }
  const digest = createHash('sha256');
  let total = 0;
  for (const part of marker.parts) {
    const actual = await r2.getObject(part.key);
    if (actual.length !== part.bytes || hash(actual) !== part.sha256) {
      throw new Error('Offsite ciphertext corrupted or missing');
    }
    if (output) await output.write(actual);
    digest.update(actual);
    total += actual.length;
  }
  if (total !== marker.bytes || digest.digest('hex') !== marker.cipherSha256) {
    throw new Error('Offsite full ciphertext digest differs');
  }
  return marker;
}

export async function watchCiphertext({ r2, prefix = PREFIX, maxAgeHours = 36, now = new Date() }) {
  requirePrefix(prefix);
  const all = await r2.listObjects(`${prefix}/snapshots/`);
  const ids = all.map((x) => parseCompletedMarkerKey(x, prefix)).filter(Boolean).sort();
  const id = ids.at(-1);
  if (!id) throw new Error('No completed offsite private media snapshot');
  const marker = await verifyCiphertext({ r2, prefix, id, now, maxAgeHours });
  return { id, bytes: marker.bytes, parts: marker.parts.length, completedAt: marker.completedAt };
}

/** Never prune on backup failure, unknown keys, or incomplete snapshots. */
export async function pruneCommitted({ r2, prefix = PREFIX, now = new Date(), lockDays = 30 }) {
  requirePrefix(prefix);
  if (!Number.isSafeInteger(lockDays) || lockDays < 30) throw new Error('Retention lock window too short');
  const all = await r2.listObjects(`${prefix}/snapshots/`);
  const ids = new Set();
  const committed = new Set();
  for (const key of all) {
    const match = new RegExp(`^${prefix}/snapshots/([^/]+)/(.+)$`).exec(key);
    if (!match || !ID.test(match[1])) throw new Error('Unknown offsite snapshot object: pruning refused');
    ids.add(match[1]);
    if (key === committedKey(prefix, match[1])) committed.add(match[1]);
  }
  if (ids.size === 0 || [...ids].some((id) => !committed.has(id))) {
    throw new Error('Incomplete offsite snapshot: pruning refused');
  }
  const newest = [...ids].sort().at(-1);
  await verifyCiphertext({ r2, prefix, id: newest, now });
  const retained = selectRetainedSnapshotIds([...committed], { now, daily: 7, weekly: 4, monthly: 6, lockDays });
  if (!retained.has(newest)) throw new Error('Newest valid snapshot would be pruned');
  let removed = 0;
  for (const id of [...committed].sort()) {
    if (retained.has(id)) continue;
    const snapshotKeys = all.filter((key) => key.startsWith(`${snapPrefix(prefix, id)}/`));
    // Marker removed last. Do not remove unrelated keys or private account data.
    for (const key of snapshotKeys.filter((key) => key !== committedKey(prefix, id))) await r2.deleteObject(key);
    await r2.deleteObject(committedKey(prefix, id));
    removed++;
  }
  return { removed, retained: retained.size };
}

export async function downloadCiphertext({ r2, id, destination, prefix = PREFIX, now = new Date() }) {
  const path = resolve(destination);
  const fd = await open(path, 'wx', 0o600);
  try {
    const marker = await verifyCiphertext({ r2, id, prefix, now, output: fd });
    await fd.sync();
    return marker;
  } catch (e) {
    await fd.close();
    await rm(path, { force: true });
    throw e;
  } finally {
    // Close after a successful write. Errors already closed above.
    await fd.close().catch(() => {});
  }
}

function clientFromEnv(env) {
  for (const name of ['MEDIA_DR_R2_ACCOUNT_ID', 'MEDIA_DR_R2_ACCESS_KEY_ID',
    'MEDIA_DR_R2_SECRET_ACCESS_KEY', 'MEDIA_DR_R2_BUCKET']) {
    if (!env[name]) throw new Error('Required offsite R2 configuration absent');
  }
  return createR2Client({
    accountId: env.MEDIA_DR_R2_ACCOUNT_ID,
    accessKeyId: env.MEDIA_DR_R2_ACCESS_KEY_ID,
    secretAccessKey: env.MEDIA_DR_R2_SECRET_ACCESS_KEY,
    bucket: env.MEDIA_DR_R2_BUCKET,
    endpoint: env.MEDIA_DR_R2_ENDPOINT || undefined,
  });
}

async function cli(env = process.env, argv = process.argv.slice(2)) {
  if (env.MEDIA_DR_SOURCE_PROJECT !== SOURCE_PROJECT || env.MEDIA_DR_ENABLED !== 'true') {
    throw new Error('Offsite job disabled or wrong Scratch target');
  }
  if (!['--backup', '--watch', '--download'].includes(argv[0])) throw new Error('Invalid offsite command');
  const r2 = clientFromEnv(env);
  if (argv[0] === '--watch') {
    const result = await watchCiphertext({ r2 });
    console.log('MOSAIC_MEDIA_OFFSITE_FRESH_CIPHERTEXT_PASS: ' + result.id);
    return;
  }
  if (argv[0] === '--download') {
    if (argv.length !== 3 || !argv[2].endsWith('.age')) throw new Error('Invalid private restore destination');
    await downloadCiphertext({ r2, id: argv[1], destination: argv[2] });
    console.log('MOSAIC_MEDIA_OFFSITE_ENCRYPTED_DOWNLOAD_PASS');
    return;
  }
  if (argv.length !== 1 || !env.MEDIA_DR_AGE_IDENTITY?.includes('AGE-SECRET-KEY-') ||
      !env.MEDIA_DR_SOURCE_STORAGE_KEY?.startsWith('sb_secret_')) {
    throw new Error('Protected media backup identity/source secret missing');
  }
  const home = await mkdtemp(join(tmpdir(), 'mosaic-media-dr-'));
  try {
    const config = join(home, '.config/mosaic');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(config, { recursive: true, mode: 0o700 });
    await writeFile(join(config, 'supabase-backup.agekey'), env.MEDIA_DR_AGE_IDENTITY + '\n', { mode: 0o600, flag: 'wx' });
    const archive = join(home, 'encrypted-private-photos.age');
    const script = fileURLToPath(new URL('./private-photo-snapshot.py', import.meta.url));
    const child = spawnSync('python3', [script, archive], {
      env: { PATH: env.PATH || '', HOME: home, MOSAIC_SUPABASE_SOURCE_STORAGE_KEY: env.MEDIA_DR_SOURCE_STORAGE_KEY },
      encoding: 'utf8', timeout: 30 * 60_000, maxBuffer: 64 * 1024,
    });
    if (child.status !== 0 || !child.stdout?.includes('SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS')) {
      throw new Error('Source age-encrypted private bucket snapshot failed');
    }
    const marker = await uploadCiphertext({ r2, archive });
    await verifyCiphertext({ r2, id: marker.id });
    console.log('MOSAIC_MEDIA_OFFSITE_COMMITTED_PASS: ' + marker.id);
    if (env.MEDIA_DR_PRUNE_ENABLED === 'true') {
      if (env.MEDIA_DR_R2_LOCK_CONFIRMED !== 'true') throw new Error('Provider lock policy not confirmed');
      const pruned = await pruneCommitted({ r2 });
      console.log('MOSAIC_MEDIA_OFFSITE_RETENTION_PASS: removed=' + pruned.removed);
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  cli().catch(() => { // Intentionally no errors/URLs/secrets or owner data in Actions logs.
    console.error('MOSAIC_MEDIA_OFFSITE_NOT_VERIFIED');
    process.exitCode = 1;
  });
}
