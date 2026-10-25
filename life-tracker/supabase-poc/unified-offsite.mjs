/**
 * #1027: one Scratch PostgreSQL/Auth-data + private Storage offsite restore point.
 * Captured archives are already independently authenticated age ciphertext.
 * No writable Supabase access, no app/browser credentials and no hosted restore.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import { parseCompletedMarkerKey, selectRetainedSnapshotIds } from '../appwrite-functions/dr-backup/retention.mjs';
import { assertRecoveryProfile, assertProfileToc, SEVEN } from './recovery-profile.mjs';

export const PREFIX = 'mosaic-supabase/v1';
export const SOURCE = 'hcxtiifzxoaflhjgoglb';
export const BUCKET = 'mosaic-personal-photos';
const KINDS = ['database', 'media'];
const CHUNK = 8 * 1024 * 1024;
const MAX_PARTS = 10000;
const HEX = /^[a-f0-9]{64}$/;
const ID = /^\d{8}T\d{9}Z$/;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const identity = (date) => date.toISOString().replace(/[-:.]/g, '');
const snapshot = (id) => `${PREFIX}/snapshots/${id}`;
const markerKey = (id) => `${snapshot(id)}/COMPLETED`;

function assertId(id) {
  if (!ID.test(id) || identity(new Date(id.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/,
    '$1-$2-$3T$4:$5:$6.$7Z',
  ))) !== id) throw new Error('Invalid full recovery snapshot ID');
}
function markerStructure(marker, id) {
  assertId(id);
  if (marker?.format !== 'mosaic-supabase-full-offsite' || marker?.version !== 1 ||
      marker.id !== id || marker.sourceProject !== SOURCE || marker.bucket !== BUCKET ||
      !Number.isFinite(Date.parse(marker.startedAt)) ||
      !Number.isFinite(Date.parse(marker.completedAt)) ||
      Date.parse(marker.startedAt) > Date.parse(marker.completedAt) ||
      identity(new Date(marker.startedAt)) !== id ||
      !marker.archives || Object.keys(marker.archives).sort().join() !== KINDS.join() ||
      (marker.recoveryProfile != null &&
       ![SEVEN, 'eight-personal-settings'].includes(marker.recoveryProfile))) {
    throw new Error('Invalid completed full recovery manifest');
  }
  for (const kind of KINDS) {
    const a = marker.archives[kind];
    if (!a || !Number.isSafeInteger(a.bytes) || a.bytes < 1 ||
        !HEX.test(a.sha256) || !Array.isArray(a.parts) ||
        a.parts.length < 1 || a.parts.length > MAX_PARTS) {
      throw new Error('Invalid encrypted full recovery component');
    }
    let sum = 0;
    for (const [index, part] of a.parts.entries()) {
      const key = `${snapshot(id)}/${kind}/parts/${String(index).padStart(5, '0')}.agechunk`;
      if (part?.key !== key || !Number.isSafeInteger(part.bytes) ||
          part.bytes < 1 || part.bytes > CHUNK || !HEX.test(part.sha256)) {
        throw new Error('Invalid encrypted full recovery part');
      }
      sum += part.bytes;
    }
    if (sum !== a.bytes) throw new Error('Encrypted archive size mismatch');
  }
  return marker;
}

async function uploadArchive({ r2, id, kind, archive, chunkBytes }) {
  const first = await stat(archive);
  if (!first.isFile() || first.size < 1 || first.size > MAX_PARTS * chunkBytes) {
    throw new Error('Encrypted archive outside safe size bounds');
  }
  const file = await open(archive, 'r');
  const digest = createHash('sha256');
  const parts = [];
  try {
    for (let offset = 0, index = 0; offset < first.size; index++) {
      const length = Math.min(chunkBytes, first.size - offset);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      if (bytesRead !== length) throw new Error('Encrypted archive changed during upload');
      const key = `${snapshot(id)}/${kind}/parts/${String(index).padStart(5, '0')}.agechunk`;
      const partSha = sha(buffer);
      await r2.putObject(key, buffer, { metadata: { 'cipher-sha256': partSha } });
      const remote = await r2.getObject(key);
      if (remote.length !== length || sha(remote) !== partSha) {
        throw new Error('Remote ciphertext differs from source');
      }
      parts.push({ key, bytes: length, sha256: partSha });
      digest.update(buffer);
      offset += length;
    }
  } finally {
    await file.close();
  }
  const expected = digest.digest('hex');
  // Same-size local overwrites are not safe: full source readback precedes commit.
  const second = await stat(archive);
  if (first.size !== second.size || first.ino !== second.ino || first.dev !== second.dev ||
      first.ctimeMs !== second.ctimeMs || first.mtimeMs !== second.mtimeMs) {
    throw new Error('Encrypted source changed before completed marker');
  }
  const verify = createHash('sha256');
  const fd = await open(archive, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(1024 * 1024, chunkBytes));
    for (let position = 0; position < first.size;) {
      const { bytesRead } = await fd.read(buffer, 0, Math.min(buffer.length, first.size - position), position);
      if (bytesRead < 1) throw new Error('Encrypted source truncated on verification');
      verify.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally { await fd.close(); }
  const last = await stat(archive);
  if (verify.digest('hex') !== expected || last.size !== first.size ||
      last.ctimeMs !== first.ctimeMs || last.mtimeMs !== first.mtimeMs) {
    throw new Error('Encrypted source ciphertext changed');
  }
  return { bytes: first.size, sha256: expected, parts };
}

/** Publish exactly one root completion marker, after both encrypted archives verify. */
export async function publishUnified({ r2, database, media, now = new Date(), chunkBytes = CHUNK, recoveryProfile = SEVEN }) {
  assertRecoveryProfile(recoveryProfile);
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > CHUNK) {
    throw new Error('Invalid encrypted R2 chunk size');
  }
  const id = identity(now);
  assertId(id);
  if ((await r2.listObjects(`${snapshot(id)}/`)).length > 0) {
    throw new Error('Existing recovery generation must never be overwritten');
  }
  const archives = {};
  for (const [kind, file] of [['database', database], ['media', media]]) {
    archives[kind] = await uploadArchive({ r2, id, kind, archive: file, chunkBytes });
  }
  const completedAt = new Date();
  const marker = markerStructure({
    format: 'mosaic-supabase-full-offsite', version: 1, id,
    sourceProject: SOURCE, bucket: BUCKET, recoveryProfile,
    startedAt: now.toISOString(),
    completedAt: completedAt < now ? now.toISOString() : completedAt.toISOString(),
    archives,
  }, id);
  const raw = Buffer.from(JSON.stringify(marker));
  await r2.putObject(markerKey(id), raw, { metadata: { 'marker-sha256': sha(raw) } });
  if (sha(await r2.getObject(markerKey(id))) !== sha(raw)) {
    throw new Error('Root completion marker remote readback differs');
  }
  return marker;
}

async function readMarker(r2, id) {
  assertId(id);
  const raw = await r2.getObject(markerKey(id));
  if (!Buffer.isBuffer(raw) || raw.length > 4 * 1024 * 1024) {
    throw new Error('Invalid remote recovery marker');
  }
  return markerStructure(JSON.parse(raw.toString('utf8')), id);
}

/** Independent complete remote-byte check; no age secret needed for watchdog. */
export async function verifyUnified({ r2, id, now = new Date(), maxAgeHours = null, outputs = {} }) {
  const marker = await readMarker(r2, id);
  const age = now.getTime() - Date.parse(marker.completedAt);
  if (age < -60_000 || (maxAgeHours != null && (!Number.isFinite(maxAgeHours) ||
      maxAgeHours <= 0 || age > maxAgeHours * 3_600_000))) {
    throw new Error('Full recovery point stale or future dated');
  }
  for (const kind of KINDS) {
    const component = marker.archives[kind];
    const digest = createHash('sha256');
    let bytes = 0;
    for (const part of component.parts) {
      const chunk = await r2.getObject(part.key);
      if (chunk.length !== part.bytes || sha(chunk) !== part.sha256) {
        throw new Error('Remote encrypted full recovery component corrupt');
      }
      if (outputs[kind]) {
        for (let offset = 0; offset < chunk.length;) {
          const { bytesWritten } = await outputs[kind].write(chunk, offset, chunk.length - offset, null);
          if (bytesWritten < 1) throw new Error('Recovery ciphertext write did not advance');
          offset += bytesWritten;
        }
      }
      digest.update(chunk);
      bytes += chunk.length;
    }
    if (bytes !== component.bytes || digest.digest('hex') !== component.sha256) {
      throw new Error('Remote encrypted full recovery digest mismatch');
    }
  }
  return marker;
}

export async function watchUnified({ r2, now = new Date(), maxAgeHours = 36 }) {
  const keys = await r2.listObjects(`${PREFIX}/snapshots/`);
  const ids = keys.map((key) => parseCompletedMarkerKey(key, PREFIX)).filter(Boolean).sort();
  if (!ids.length) throw new Error('No completed full Supabase recovery generation');
  const marker = await verifyUnified({ r2, id: ids.at(-1), now, maxAgeHours });
  return { id: marker.id, completedAt: marker.completedAt };
}

/** No-clobber, ciphertext-only download. Never restores into a hosted source. */
export async function downloadUnified({ r2, id, directory, now = new Date() }) {
  if (!isAbsolute(directory) || resolve(directory) === '/' || basename(directory) === '.') {
    throw new Error('Recovery output requires a new absolute directory');
  }
  await mkdir(directory, { mode: 0o700 }); // fails on existing destination
  const handles = {};
  let verified = false;
  try {
    for (const kind of KINDS) {
      handles[kind] = await open(join(directory, `${kind}.age`), 'wx', 0o600);
    }
    const marker = await verifyUnified({ r2, id, now, outputs: handles });
    for (const fd of Object.values(handles)) await fd.sync();
    verified = true;
    return marker;
  } catch (err) {
    throw err;
  } finally {
    for (const fd of Object.values(handles)) await fd.close().catch(() => {});
    // An incomplete pair must never appear as an available restore candidate.
    if (!verified) {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

/** Refuses all deletions until all historical committed object inventories match. */
export async function pruneUnified({ r2, now = new Date(), lockDays = 30 }) {
  if (!Number.isSafeInteger(lockDays) || lockDays < 30) throw new Error('Unsafe R2 retention lock');
  const all = await r2.listObjects(`${PREFIX}/snapshots/`);
  const observed = new Map();
  for (const key of all) {
    const match = /^mosaic-supabase\/v1\/snapshots\/([^/]+)\/(.+)$/.exec(key);
    if (!match) throw new Error('Unknown R2 recovery key: refusing prune');
    assertId(match[1]);
    if (!observed.has(match[1])) observed.set(match[1], []);
    observed.get(match[1]).push(key);
  }
  const ids = [...observed.keys()].sort();
  if (!ids.length) throw new Error('No recovery points: refusing prune');
  for (const id of ids) {
    const marker = await readMarker(r2, id);
    const expected = new Set([markerKey(id), ...KINDS.flatMap(k => marker.archives[k].parts.map(p => p.key))]);
    const keys = observed.get(id);
    if (keys.length !== expected.size || keys.some(key => !expected.has(key))) {
      throw new Error('Incomplete or unknown full recovery objects: refusing prune');
    }
  }
  await verifyUnified({ r2, id: ids.at(-1), now, maxAgeHours: 36 });
  const retained = selectRetainedSnapshotIds(ids, { now, daily: 7, weekly: 4, monthly: 6, lockDays });
  if (!retained.has(ids.at(-1))) throw new Error('Newest complete recovery point not retained');
  let removed = 0;
  for (const id of ids) {
    if (retained.has(id)) continue;
    for (const key of observed.get(id).filter(key => key !== markerKey(id))) await r2.deleteObject(key);
    await r2.deleteObject(markerKey(id));
    removed++;
  }
  return { removed, retained: retained.size };
}

export function assertFullSource(env, command) {
  if (env.SUPABASE_DR_SOURCE_PROJECT !== SOURCE) throw new Error('Unexpected Supabase source project');
  if (!['--backup', '--watch', '--download'].includes(command)) throw new Error('Unsupported recovery command');
  if (command === '--backup') {
    assertRecoveryProfile(env.SUPABASE_DR_RECOVERY_PROFILE || SEVEN);
    if (env.SUPABASE_DR_ENABLED !== 'true' ||
        !/^[-a-z0-9]+\.pooler\.supabase\.com$/.test(env.SUPABASE_DR_PGHOST || '') ||
        env.SUPABASE_DR_PGUSER !== `postgres.${SOURCE}` ||
        env.SUPABASE_DR_PGDATABASE !== 'postgres' ||
        env.SUPABASE_DR_PGPORT !== '5432' ||
        !env.SUPABASE_DR_PGPASSWORD ||
        !env.SUPABASE_DR_SOURCE_STORAGE_KEY?.startsWith('sb_secret_') ||
        !/^AGE-SECRET-KEY-[A-Z0-9]+$/.test(env.SUPABASE_DR_AGE_IDENTITY?.trim() || '')) {
      throw new Error('Unified offsite disabled or protected source identity missing');
    }
  }
}
function checkedChild(command, args, env, minutes) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: minutes * 60_000, maxBuffer: 8192 });
  if (result.error || result.status !== 0) throw new Error('Protected encrypted source capture failed');
  return result.stdout;
}
function r2FromEnv(env) {
  const prefix = 'SUPABASE_DR_R2_';
  return createR2Client({
    accountId: env[prefix + 'ACCOUNT_ID'],
    accessKeyId: env[prefix + 'ACCESS_KEY_ID'],
    secretAccessKey: env[prefix + 'SECRET_ACCESS_KEY'],
    bucket: env[prefix + 'BUCKET'],
    endpoint: env[prefix + 'ENDPOINT'] || undefined,
  });
}
export async function cli(env = process.env, argv = process.argv.slice(2)) {
  assertFullSource(env, argv[0]);
  const r2 = r2FromEnv(env);
  if (argv[0] === '--watch') {
    if (argv.length !== 1) throw new Error('Invalid watch invocation');
    const state = await watchUnified({ r2 });
    console.log('MOSAIC_SUPABASE_FULL_OFFSITE_FRESH_PASS: ' + state.id);
    return;
  }
  if (argv[0] === '--download') {
    if (argv.length !== 3) throw new Error('Invalid recovery download invocation');
    await downloadUnified({ r2, id: argv[1], directory: argv[2] });
    console.log('MOSAIC_SUPABASE_FULL_OFFSITE_CIPHERTEXT_DOWNLOAD_PASS');
    return;
  }
  if (argv.length !== 1) throw new Error('Invalid backup invocation');
  const dir = await mkdtemp(join(tmpdir(), 'mosaic-full-offsite-'));
  try {
    const home = join(dir, 'home');
    const ageDir = join(home, '.config', 'mosaic');
    await mkdir(ageDir, { recursive: true, mode: 0o700 });
    const ageKey = join(ageDir, 'supabase-backup.agekey');
    await writeFile(ageKey, `${env.SUPABASE_DR_AGE_IDENTITY.trim()}\n`, { mode: 0o600, flag: 'wx' });
    const path = fileURLToPath(new URL('./', import.meta.url));
    const recipient = checkedChild('age-keygen', ['-y', ageKey], { PATH: env.PATH || '', HOME: home }, 1).trim();
    if (!/^age1[0-9a-z]{40,100}$/.test(recipient)) throw new Error('Invalid age encryption recipient');
    for (const binary of ['pg_dump', 'pg_restore']) {
      const version = checkedChild(binary, ['--version'], { PATH: env.PATH || '' }, 1);
      const match = /PostgreSQL\) (\d+)\./.exec(version);
      if (!match || Number(match[1]) !== 17) throw new Error('PostgreSQL 17 client is required');
    }
    const pg = join(dir, 'database.age');
    const media = join(dir, 'media.age');
    const pgEnv = {
      PATH: env.PATH || '', HOME: home, PGSSLMODE: 'require',
      PGHOST: env.SUPABASE_DR_PGHOST, PGPORT: env.SUPABASE_DR_PGPORT,
      PGUSER: env.SUPABASE_DR_PGUSER, PGDATABASE: env.SUPABASE_DR_PGDATABASE,
      PGPASSWORD: env.SUPABASE_DR_PGPASSWORD,
      MOSAIC_AGE_RECIPIENT: recipient, MOSAIC_AGE_IDENTITY_FILE: ageKey,
    };
    const started = new Date();
    const result = checkedChild('bash', [join(path, 'hosted-encrypted-backup.sh'), pg], pgEnv, 35);
    if (!result.includes('Encrypted snapshot created (archive SHA-256):')) {
      throw new Error('Encrypted PostgreSQL snapshot lacks full-byte verification');
    }
    // Independently authenticate ALL database.age ciphertext first, then inspect
    // PostgreSQL 17 TOC. Refuse any unsupported personal TABLE DATA before
    // spending a Storage read or emitting a single R2 upload/COMPLETED object.
    const profile = assertRecoveryProfile(env.SUPABASE_DR_RECOVERY_PROFILE || SEVEN);
    const inspected = checkedChild('bash', [join(path, 'inspect-encrypted-backup-toc.sh'), pg, ageKey], {
      PATH: env.PATH || '', HOME: home,
    }, 12);
    const startJson = inspected.indexOf('{');
    const endJson = inspected.lastIndexOf('}');
    if (startJson < 0 || endJson <= startJson) throw new Error('Authenticated archive TOC missing');
    let summary;
    try { summary = JSON.parse(inspected.slice(startJson, endJson + 1)); }
    catch { throw new Error('Invalid authenticated PostgreSQL archive summary'); }
    assertProfileToc(summary, profile);
    const mediaResult = checkedChild('python3', [join(path, 'private-photo-snapshot.py'), media], {
      PATH: env.PATH || '', HOME: home,
      MOSAIC_SUPABASE_SOURCE_STORAGE_KEY: env.SUPABASE_DR_SOURCE_STORAGE_KEY,
    }, 35);
    if (!mediaResult.includes('SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS')) {
      throw new Error('Encrypted private media snapshot not authenticated');
    }
    const committed = await publishUnified({ r2, database: pg, media, now: started, recoveryProfile: profile });
    await verifyUnified({ r2, id: committed.id });
    console.log('MOSAIC_SUPABASE_FULL_OFFSITE_COMMITTED_PASS: ' + committed.id);
    if (env.SUPABASE_DR_PRUNE_ENABLED === 'true') {
      if (env.SUPABASE_DR_R2_LOCK_CONFIRMED !== 'true') throw new Error('R2 lock verification missing');
      const result = await pruneUnified({ r2 });
      console.log('MOSAIC_SUPABASE_FULL_OFFSITE_RETENTION_PASS: ' + result.removed);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) cli().catch(() => {
  console.error('MOSAIC_SUPABASE_FULL_OFFSITE_NOT_VERIFIED');
  process.exitCode = 1;
});
