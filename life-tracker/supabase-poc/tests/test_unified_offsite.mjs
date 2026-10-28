import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PREFIX, SOURCE, publishUnified, verifyUnified, watchUnified,
  downloadUnified, pruneUnified, assertFullSource, BACKUP_SAFE_STAGES,
  preflightFourteenDestination, safeR2HttpClass } from '../unified-offsite.mjs';
// Production marker.completedAt uses the actual wall clock. Never mock the
// verifier's 60s future skew or 36h freshness guard to accommodate stale tests.
const NOW = new Date();
const daysAgo = days => new Date(NOW.getTime() - days * 86400000);
const daysLater = days => new Date(NOW.getTime() + days * 86400000);
const PREFIX_ROOT = `${PREFIX}/snapshots/`;
function fakeR2() {
  const objects = new Map();
  return {
    objects,
    async putObject(key, bytes) { objects.set(key, Buffer.from(bytes)); },
    async getObject(key) { if (!objects.has(key)) throw Error('missing R2 object'); return Buffer.from(objects.get(key)); },
    async listObjects(prefix) { return [...objects.keys()].filter(key => key.startsWith(prefix)).sort(); },
    async deleteObject(key) { objects.delete(key); },
  };
}
async function fixture(callback) {
  const temp = await mkdtemp(join(tmpdir(), 'mosaic-unified-test-'));
  const database = join(temp, 'database.age');
  const media = join(temp, 'media.age');
  await writeFile(database, Buffer.from('authenticated synthetic database ciphertext'));
  await writeFile(media, Buffer.from('authenticated synthetic private Storage ciphertext'));
  try { await callback({ temp, database, media }); }
  finally { await rm(temp, { recursive: true, force: true }); }
}

test('one completed marker publishes database AND media; both remote files recover byte-exact', async () => fixture(async ({ temp, database, media }) => {
  const r2 = fakeR2();
  const m = await publishUnified({ r2, database, media, now: NOW, chunkBytes: 9 });
  assert.equal(m.sourceProject, SOURCE);
  assert.equal(m.archives.database.parts.length, 5);
  assert.ok(m.archives.media.parts.length >= 5);
  assert.equal([...r2.objects.keys()].filter(k => k.endsWith('/COMPLETED')).length, 1);
  assert.equal((await watchUnified({ r2, now: NOW })).id, m.id);
  const dir = join(temp, 'recovered');
  await downloadUnified({ r2, id: m.id, directory: dir, now: NOW });
  assert.deepEqual(await readFile(join(dir, 'database.age')), await readFile(database));
  assert.deepEqual(await readFile(join(dir, 'media.age')), await readFile(media));
  await assert.rejects(downloadUnified({ r2, id: m.id, directory: dir, now: NOW }), /EEXIST/);
}));

test('historical markers remain verifiable, new markers advertise precise recovery profile', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const newPoint = await publishUnified({ r2, database, media, now: NOW, recoveryProfile: 'eight-personal-settings' });
  assert.equal(newPoint.recoveryProfile, 'eight-personal-settings');
  assert.equal((await verifyUnified({ r2, id: newPoint.id, now: NOW })).recoveryProfile, 'eight-personal-settings');
  const key = `${PREFIX_ROOT}${newPoint.id}/COMPLETED`;
  const oldMarker = JSON.parse(r2.objects.get(key).toString('utf8'));
  delete oldMarker.recoveryProfile;
  r2.objects.set(key, Buffer.from(JSON.stringify(oldMarker)));
  assert.equal((await verifyUnified({ r2, id: newPoint.id, now: NOW })).recoveryProfile, undefined);
}));


test('ten-table private Settings/Bucket/link recovery publishes fully authenticated paired archives', async () => fixture(async ({ temp, database, media }) => {
  const r2 = fakeR2();
  const selected = 'ten-personal-bucket-links';
  const point = await publishUnified({ r2, database, media, now: NOW,
    recoveryProfile: selected, chunkBytes: 13 });
  assert.equal(point.recoveryProfile, selected);
  assert.equal((await verifyUnified({ r2, id: point.id, now: NOW })).recoveryProfile, selected);
  assert.equal((await watchUnified({ r2, now: NOW })).id, point.id);
  const dir = join(temp, 'recovered-ten');
  const downloaded = await downloadUnified({ r2, id: point.id, directory: dir, now: NOW });
  assert.equal(downloaded.recoveryProfile, selected);
  assert.deepEqual(await readFile(join(dir, 'database.age')), await readFile(database));
  assert.deepEqual(await readFile(join(dir, 'media.age')), await readFile(media));
  assert.deepEqual([...r2.objects.keys()].filter(k => k.endsWith('/COMPLETED')),
    [PREFIX_ROOT + point.id + '/COMPLETED']);
}));

test('watcher fails closed on newer wrong/legacy profile while preserving historical ad-hoc watch', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const required = 'ten-personal-bucket-links';
  const eight = 'eight-personal-settings';
  const older = await publishUnified({ r2, database, media, now: NOW, recoveryProfile: eight });
  assert.equal((await watchUnified({ r2, now: NOW, expectedRecoveryProfile: eight })).id, older.id);
  await assert.rejects(watchUnified({ r2, now: NOW, expectedRecoveryProfile: required }),
    /recovery profile mismatch/);
  await assert.rejects(watchUnified({ r2, now: NOW, expectedRecoveryProfile: 'unknown-profile' }),
    /Unapproved/);

  const later = new Date(NOW.getTime() + 1000);
  const current = await publishUnified({ r2, database, media, now: later, recoveryProfile: required });
  assert.notEqual(current.id, older.id);
  assert.equal((await watchUnified({ r2, now: NOW, expectedRecoveryProfile: required })).id, current.id);
  await assert.rejects(watchUnified({ r2, now: NOW, expectedRecoveryProfile: eight }),
    /recovery profile mismatch/);

  const key = PREFIX_ROOT + current.id + '/COMPLETED';
  const legacy = JSON.parse(r2.objects.get(key).toString('utf8'));
  delete legacy.recoveryProfile;
  r2.objects.set(key, Buffer.from(JSON.stringify(legacy)));
  await assert.rejects(watchUnified({ r2, now: NOW, expectedRecoveryProfile: required }),
    /recovery profile mismatch/);
  assert.equal((await watchUnified({ r2, now: NOW })).id, current.id);
}));

test('ten-table marker cannot be mislabeled as a false profile or partially corrupted and reused', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const point = await publishUnified({ r2, database, media, now: NOW,
    recoveryProfile: 'ten-personal-bucket-links' });
  const markerKey = PREFIX_ROOT + point.id + '/COMPLETED';
  const original = r2.objects.get(markerKey);
  for (const bad of [
    { ...point, recoveryProfile: 'future-unreviewed-table' },
    { ...point, recoveryProfile: 'TEN-PERSONAL-BUCKET-LINKS' },
    { ...point, archives: { ...point.archives, media: {
      ...point.archives.media, sha256: '0'.repeat(64),
    } } },
    { ...point, archives: { ...point.archives, media: {
      ...point.archives.media, parts: point.archives.media.parts.slice(1),
    } } },
  ]) {
    r2.objects.set(markerKey, Buffer.from(JSON.stringify(bad)));
    await assert.rejects(verifyUnified({ r2, id: point.id, now: NOW }),
      /Invalid completed|Invalid encrypted|size mismatch|corrupt|digest mismatch/);
  }
  r2.objects.set(markerKey, original);
  assert.equal((await verifyUnified({ r2, id: point.id, now: NOW })).recoveryProfile,
    'ten-personal-bucket-links');
}));

test('unrecognized recovery profile fails before publishing any remote objects', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  await assert.rejects(publishUnified({ r2, database, media, now: NOW,
    recoveryProfile: 'claim-restored-but-unsupported' }), /Unapproved/);
  assert.equal(r2.objects.size, 0);
}));

test('database capture fails -> never publishes a full restore point', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const get = r2.getObject;
  r2.getObject = async key => key.includes('/database/') ? Buffer.from('WRONG') : get(key);
  await assert.rejects(publishUnified({ r2, database, media, now: NOW, chunkBytes: 16 }), /Remote ciphertext differs/);
  assert.equal([...r2.objects.keys()].filter(k => k.endsWith('/COMPLETED')).length, 0);
  await assert.rejects(watchUnified({ r2, now: NOW }), /No completed/);
}));

test('media capture fails after database upload -> still no complete checkpoint', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const get = r2.getObject;
  r2.getObject = async key => key.includes('/media/') ? Buffer.from('WRONG') : get(key);
  await assert.rejects(publishUnified({ r2, database, media, now: NOW, chunkBytes: 16 }), /Remote ciphertext differs/);
  assert.equal([...r2.objects.keys()].filter(k => k.endsWith('/COMPLETED')).length, 0);
}));

test('independent full-byte watch rejects corrupt media, corrupt database, future and stale generations', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const m = await publishUnified({ r2, database, media, now: NOW, chunkBytes: 9 });
  await assert.rejects(watchUnified({ r2, now: daysLater(4) }), /stale/);
  for (const kind of ['database', 'media']) {
    const key = m.archives[kind].parts[0].key;
    const saved = r2.objects.get(key);
    r2.objects.set(key, Buffer.alloc(saved.length));
    await assert.rejects(verifyUnified({ r2, id: m.id, now: NOW }), /corrupt/);
    r2.objects.set(key, saved);
  }
  await assert.rejects(verifyUnified({ r2, id: m.id, now: daysAgo(5) }), /future/);
}));

test('corrupt download wipes both archive files and its new recovery directory', async () => fixture(async ({ temp, database, media }) => {
  const r2 = fakeR2();
  const m = await publishUnified({ r2, database, media, now: NOW });
  r2.objects.delete(m.archives.media.parts[0].key);
  const dst = join(temp, 'partial');
  await assert.rejects(downloadUnified({ r2, id: m.id, directory: dst, now: NOW }), /missing R2/);
  await assert.rejects(stat(dst), /ENOENT/);
}));

test('retention blocks missing historical media, unknown files and orphan generations before deletion', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const old = await publishUnified({ r2, database, media, now: daysAgo(300) });
  await publishUnified({ r2, database, media, now: NOW });
  const oldKey = old.archives.media.parts[0].key;
  const oldBytes = r2.objects.get(oldKey);
  r2.objects.delete(oldKey);
  await assert.rejects(pruneUnified({ r2, now: NOW }), /Incomplete/);
  r2.objects.set(oldKey, oldBytes);
  const unknown = `${PREFIX_ROOT}${old.id}/unexpected`;
  r2.objects.set(unknown, Buffer.from('oops'));
  await assert.rejects(pruneUnified({ r2, now: NOW }), /Incomplete/);
  r2.objects.delete(unknown);
  const orphan = `${PREFIX_ROOT}20260102T120000000Z/database/parts/00000.agechunk`;
  r2.objects.set(orphan, Buffer.from('orphan'));
  await assert.rejects(pruneUnified({ r2, now: NOW }), /missing R2/);
  assert.ok(r2.objects.has(`${PREFIX_ROOT}${old.id}/COMPLETED`));
}));

test('full restore point retention keeps lock window and daily/weekly/monthly tiers', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  const ids = [];
  for (let i = 0; i < 80; i++) ids.push((await publishUnified({ r2, database, media, now: new Date(NOW.getTime() - i * 86400000) })).id);
  const result = await pruneUnified({ r2, now: NOW });
  assert.ok(result.removed > 0);
  assert.ok(result.retained >= 30);
  assert.ok(r2.objects.has(`${PREFIX_ROOT}${ids[0]}/COMPLETED`));
  assert.ok(r2.objects.has(`${PREFIX_ROOT}${ids[29]}/COMPLETED`));
  await assert.rejects(pruneUnified({ r2, now: NOW, lockDays: 10 }), /Unsafe/);
}));

test('protected source gates require exact Scratch owner and writer enablement, not for disaster downloads', () => {
  const disabled = { SUPABASE_DR_SOURCE_PROJECT: SOURCE, SUPABASE_DR_ENABLED: 'false' };
  assert.throws(() => assertFullSource(disabled, '--backup'), /disabled/);
  assert.doesNotThrow(() => assertFullSource(disabled, '--watch'));
  assert.doesNotThrow(() => assertFullSource(disabled, '--download'));
  assert.throws(() => assertFullSource({ ...disabled, SUPABASE_DR_SOURCE_PROJECT: 'production' }, '--download'), /Unexpected/);
});

test('direct backup CLI reports only fixed failure stage, never raw source or private secrets', () => {
  assert.ok(BACKUP_SAFE_STAGES.includes('SOURCE_GATE'));
  assert.ok(BACKUP_SAFE_STAGES.includes('PG_DATABASE_CAPTURE'));
  assert.ok(BACKUP_SAFE_STAGES.includes('STORAGE_CAPTURE'));
  assert.ok(BACKUP_SAFE_STAGES.includes('R2_FULL_READBACK'));
  assert.equal(new Set(BACKUP_SAFE_STAGES).size, BACKUP_SAFE_STAGES.length);
  const marker = 'test-secret-that-must-never-be-logged';
  const file = fileURLToPath(new URL('../unified-offsite.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [file, '--backup'], {
    encoding: 'utf8', timeout: 10000,
    env: {
      PATH: process.env.PATH || '',
      SUPABASE_DR_SOURCE_PROJECT: 'unexpected-production-project',
      SUPABASE_DR_PGPASSWORD: marker,
      SUPABASE_DR_SOURCE_STORAGE_KEY: marker,
      SUPABASE_DR_R2_SECRET_ACCESS_KEY: marker,
    },
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^MOSAIC_SUPABASE_FULL_OFFSITE_SAFE_STAGE: SOURCE_GATE$/m);
  assert.match(run.stderr, /^MOSAIC_SUPABASE_FULL_OFFSITE_NOT_VERIFIED$/m);
  assert.ok(!run.stderr.includes(marker));
  assert.ok(!run.stdout.includes(marker));
});


test('R2 fourteen destination preflight reads independently proven ten-table marker without writing', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  await publishUnified({
    r2, database, media,
    now: new Date('2026-10-28T05:35:25.682Z'),
    recoveryProfile: 'ten-personal-bucket-links',
  });
  let writes = 0;
  const originalPut = r2.putObject;
  r2.putObject = async (...args) => { writes++; return originalPut(...args); };
  const stages = [];
  assert.deepEqual(
    await preflightFourteenDestination({ r2, onCheckpoint: stage => stages.push(stage) }),
    { existingFourteenId: null },
  );
  assert.equal(writes, 0);
  assert.deepEqual(stages, ['R2_PREFLIGHT_LIST', 'R2_BEFORE_MARKER_READ']);
  await publishUnified({
    r2, database, media,
    now: new Date('2026-10-28T07:55:59.000Z'),
    recoveryProfile: 'fourteen-personal-identity',
  });
  writes = 0;
  stages.length = 0;
  assert.deepEqual(
    await preflightFourteenDestination({ r2, onCheckpoint: stage => stages.push(stage) }),
    { existingFourteenId: '20261028T075559000Z' },
  );
  assert.equal(writes, 0);
  assert.deepEqual(stages,
    ['R2_PREFLIGHT_LIST', 'R2_BEFORE_MARKER_READ', 'R2_EXISTING_COMPLETED_SCAN']);
}));

test('fourteen preflight fails closed before cloud writes for missing old marker and denied LIST/GET', async () => {
  const r2 = fakeR2();
  let stage = null;
  await assert.rejects(
    preflightFourteenDestination({ r2, onCheckpoint: item => { stage = item; } }),
    /Historical ten-table completed marker not found/,
  );
  assert.equal(stage, 'R2_PREFLIGHT_LIST');
  const denial = new Error('R2 GET failed with HTTP 403 code=AccessDenied');
  const deniedList = { ...r2, listObjects: async () => { throw denial; } };
  await assert.rejects(
    preflightFourteenDestination({ r2: deniedList, onCheckpoint: item => { stage = item; } }),
    /HTTP 403/,
  );
  assert.equal(stage, 'R2_PREFLIGHT_LIST');
  const missingBefore = { ...r2,
    listObjects: async () => ['mosaic-supabase/v1/snapshots/20261028T053525682Z/COMPLETED'],
    getObject: async () => { throw denial; },
  };
  await assert.rejects(
    preflightFourteenDestination({ r2: missingBefore, onCheckpoint: item => { stage = item; } }),
    /HTTP 403/,
  );
  assert.equal(stage, 'R2_BEFORE_MARKER_READ');
  assert.equal(r2.objects.size, 0);
});

test('R2 publication tracks exact list, database/media upload/readback, and marker steps', async () => fixture(async ({ database, media }) => {
  const phases = [
    ['LIST', 'R2_GENERATION_LIST', (r2) => {
      r2.listObjects = async () => { throw Error('denied list'); };
    }],
    ['DATABASE_PUT', 'R2_DATABASE_PUT', (r2) => {
      r2.putObject = async () => { throw Error('denied put'); };
    }],
    ['DATABASE_GET', 'R2_DATABASE_GET', (r2) => {
      r2.getObject = async () => { throw Error('denied get'); };
    }],
    ['MEDIA_PUT', 'R2_MEDIA_PUT', (r2) => {
      const put = r2.putObject;
      r2.putObject = async (key, ...args) => {
        if (key.includes('/media/')) throw Error('media upload denied');
        return put(key, ...args);
      };
    }],
    ['MEDIA_GET', 'R2_MEDIA_GET', (r2) => {
      const get = r2.getObject;
      r2.getObject = async (key, ...args) => {
        if (key.includes('/media/')) throw Error('media readback denied');
        return get(key, ...args);
      };
    }],
    ['MARKER_PUT', 'R2_COMPLETED_PUT', (r2) => {
      const put = r2.putObject;
      r2.putObject = async (key, ...args) => {
        if (key.endsWith('/COMPLETED')) throw Error('marker put denied');
        return put(key, ...args);
      };
    }],
    ['MARKER_GET', 'R2_COMPLETED_GET', (r2) => {
      const get = r2.getObject;
      r2.getObject = async (key, ...args) => {
        if (key.endsWith('/COMPLETED')) throw Error('marker get denied');
        return get(key, ...args);
      };
    }],
  ];
  for (const [label, expected, disrupt] of phases) {
    const r2 = fakeR2();
    disrupt(r2);
    let stage = '';
    await assert.rejects(publishUnified({
      r2, database, media,
      now: new Date('2026-10-28T08:00:00.000Z'),
      recoveryProfile: 'fourteen-personal-identity',
      onCheckpoint: value => { stage = value; },
    }), { message: /denied/ }, label);
    assert.equal(stage, expected, label);
    const complete = [...r2.objects.keys()].some(k => k.endsWith('/COMPLETED'));
    assert.equal(complete, label === 'MARKER_GET', label);
  }
}));

test('a successful marker PUT but failed GET is detected on next preflight, preventing duplicate backup', async () => fixture(async ({ database, media }) => {
  const r2 = fakeR2();
  await publishUnified({
    r2, database, media,
    now: new Date('2026-10-28T05:35:25.682Z'),
    recoveryProfile: 'ten-personal-bucket-links',
  });
  const get = r2.getObject;
  let deny = true;
  r2.getObject = async (key, ...args) => {
    if (deny && key === 'mosaic-supabase/v1/snapshots/20261028T080000000Z/COMPLETED') {
      throw Error('synthetic temporary marker GET failure');
    }
    return get(key, ...args);
  };
  let stage = '';
  await assert.rejects(publishUnified({
    r2, database, media,
    now: new Date('2026-10-28T08:00:00.000Z'),
    recoveryProfile: 'fourteen-personal-identity',
    onCheckpoint: value => { stage = value; },
  }), /synthetic temporary marker GET failure/);
  assert.equal(stage, 'R2_COMPLETED_GET');
  deny = false;
  const recovered = await preflightFourteenDestination({ r2 });
  assert.equal(recovered.existingFourteenId, '20261028T080000000Z');
}));

test('R2 HTTP classification is bounded, never echoes arbitrary provider text', () => {
  assert.equal(safeR2HttpClass(new Error('R2 GET failed with HTTP 403 code=AccessDenied')),
    'HTTP_403_ACCESS_DENIED');
  assert.equal(safeR2HttpClass(new Error('R2 PUT failed with HTTP 403 code=SignatureDoesNotMatch')),
    'HTTP_403_SIGNATURE_MISMATCH');
  assert.equal(safeR2HttpClass(new Error('R2 GET failed with HTTP 404 code=NoSuchBucket')),
    'HTTP_404_BUCKET_NOT_FOUND');
  assert.equal(safeR2HttpClass(new Error('R2 PUT failed with HTTP 503 code=ServiceUnavailable')),
    'HTTP_503_SERVICE_UNAVAILABLE');
  assert.equal(safeR2HttpClass(new Error('R2 GET failed with HTTP 400 code=Evil_Secret_Provider_Name')),
    'HTTP_400_OTHER');
  for (const x of [
    'R2 GET failed with HTTP 403 code=AccessDenied; secret=123',
    'Error: R2 GET failed with HTTP 403 code=AccessDenied',
    'Authorization=Bearer hidden',
  ]) assert.equal(safeR2HttpClass(new Error(x)), null);
});
