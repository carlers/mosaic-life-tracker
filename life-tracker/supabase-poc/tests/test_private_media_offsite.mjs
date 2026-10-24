import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PREFIX, uploadCiphertext, watchCiphertext, verifyCiphertext,
  pruneCommitted, downloadCiphertext, assertCommandAllowed,
} from '../private-media-offsite.mjs';

const FIXED = new Date('2026-10-25T12:00:00.000Z');

function fakeR2() {
  const data = new Map();
  return {
    data,
    async listObjects(prefix) { return [...data.keys()].filter(k => k.startsWith(prefix)).sort(); },
    async putObject(key, body) { data.set(key, Buffer.from(body)); },
    async getObject(key) {
      if (!data.has(key)) throw new Error('missing object');
      return Buffer.from(data.get(key));
    },
    async deleteObject(key) { data.delete(key); },
  };
}

async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'mosaic-media-test-'));
  try {
    const path = join(dir, 'photo.age');
    await writeFile(path, Buffer.from('AGE-encrypted synthetic ciphertext fixture bytes'));
    return await fn(path, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('ordered ciphertext chunk readbacks, committed marker, complete watch and no-clobber recovery', async () => fixture(async (archive, dir) => {
  const r2 = fakeR2();
  const marker = await uploadCiphertext({ r2, archive, now: FIXED, chunkBytes: 11 });
  assert.equal(marker.parts.length, 5);
  assert.equal(marker.sourceProject, 'mosaic-dev');
  assert.ok(!JSON.stringify(marker).includes('AGE-encrypted synthetic ciphertext'));
  assert.equal((await watchCiphertext({ r2, now: FIXED })).id, marker.id);
  const download = join(dir, 'recovered.age');
  await downloadCiphertext({ r2, id: marker.id, destination: download, now: FIXED });
  assert.deepEqual(await readFile(download), await readFile(archive));
  await assert.rejects(downloadCiphertext({ r2, id: marker.id, destination: download, now: FIXED }), /EEXIST/);
}));

test('changed remote ciphertext fails before COMPLETED marker and is never reported as a restore point', async () => fixture(async (archive) => {
  const r2 = fakeR2();
  r2.getObject = async (key) => Buffer.from('wrong');
  await assert.rejects(uploadCiphertext({ r2, archive, now: FIXED, chunkBytes: 12 }), /readback differs/);
  assert.equal([...r2.data.keys()].filter(k => k.endsWith('/COMPLETED')).length, 0);
}));

test('watch refuses stale, missing, and mutated ciphertext even when marker exists', async () => fixture(async (archive) => {
  const r2 = fakeR2();
  const m = await uploadCiphertext({ r2, archive, now: FIXED, chunkBytes: 16 });
  await assert.rejects(watchCiphertext({ r2, now: new Date('2026-10-28T12:00:00.000Z') }), /stale/);
  r2.data.set(m.parts[0].key, Buffer.from('tampered'));
  await assert.rejects(watchCiphertext({ r2, now: FIXED }), /corrupted/);
  await assert.rejects(verifyCiphertext({ r2, id: m.id, now: FIXED }), /corrupted/);
}));

test('prune refuses incomplete/new unknown snapshots; never prunes last good', async () => fixture(async (archive) => {
  const r2 = fakeR2();
  await uploadCiphertext({ r2, archive, now: FIXED });
  r2.data.set(`${PREFIX}/snapshots/20261024T120000000Z/parts/00000.agechunk`, Buffer.from('incomplete'));
  await assert.rejects(pruneCommitted({ r2, now: FIXED }), /Incomplete/);
  assert.equal([...r2.data.keys()].filter(k => k.endsWith('/COMPLETED')).length, 1);
  r2.data.delete(`${PREFIX}/snapshots/20261024T120000000Z/parts/00000.agechunk`);
  assert.deepEqual(await pruneCommitted({ r2, now: FIXED }), { removed: 0, retained: 1 });
  await assert.rejects(pruneCommitted({ r2, now: FIXED, lockDays: 10 }), /lock window/);
}));

test('retention keeps lock window, 7 daily, 4 weekly, 6 monthly, removing only verified older snapshots', async () => fixture(async (archive) => {
  const r2 = fakeR2();
  const present = [];
  for (let i = 0; i < 80; i++) {
    const t = new Date(FIXED.getTime() - i * 86_400_000);
    present.push((await uploadCiphertext({ r2, archive, now: t })).id);
  }
  const result = await pruneCommitted({ r2, now: FIXED });
  assert.ok(result.removed > 0);
  assert.ok(result.retained >= 30);
  const keys = [...r2.data.keys()];
  assert.ok(keys.includes(`${PREFIX}/snapshots/${present[0]}/COMPLETED`));
  assert.ok(keys.includes(`${PREFIX}/snapshots/${present[29]}/COMPLETED`));
  assert.ok(!keys.includes(`${PREFIX}/snapshots/${present[50]}/COMPLETED`) || result.retained > 30);
}));

test('download rejects corrupt ciphertext and leaves no partial recoverable file', async () => fixture(async (archive, dir) => {
  const r2 = fakeR2();
  const marker = await uploadCiphertext({ r2, archive, now: FIXED, chunkBytes: 10 });
  r2.data.delete(marker.parts[1].key);
  const out = join(dir, 'incomplete.age');
  await assert.rejects(downloadCiphertext({ r2, id: marker.id, destination: out, now: FIXED }), /missing object/);
  await assert.rejects(readFile(out), /ENOENT/);
}));


test('a same-size source mutation during upload cannot be committed as a restore point', async () => fixture(async (archive) => {
  const r2 = fakeR2();
  const put = r2.putObject;
  let changed = false;
  r2.putObject = async (key, body, options) => {
    await put(key, body, options);
    if (!changed && key.endsWith('.agechunk')) {
      changed = true;
      const original = await readFile(archive);
      await writeFile(archive, Buffer.alloc(original.length, 0x5a));
    }
  };
  await assert.rejects(uploadCiphertext({ r2, archive, now: FIXED, chunkBytes: 9 }), /source changed|source bytes changed/);
  assert.equal([...r2.data.keys()].filter(k => k.endsWith('/COMPLETED')).length, 0);
}));

test('prune fails without deletion for missing historical chunks or unexpected objects', async () => fixture(async (archive) => {
  const r2 = fakeR2();
  const old = await uploadCiphertext({ r2, archive, now: new Date('2026-01-01T12:00:00.000Z') });
  await uploadCiphertext({ r2, archive, now: FIXED });
  const before = new Set(r2.data.keys());
  r2.data.delete(old.parts[0].key);
  await assert.rejects(pruneCommitted({ r2, now: FIXED }), /inventory incomplete/);
  assert.deepEqual(new Set(r2.data.keys()), new Set([...before].filter(k => k !== old.parts[0].key)));
  r2.data.set(old.parts[0].key, Buffer.from('repaired'));
  r2.data.set(`${PREFIX}/snapshots/${old.id}/unexpected`, Buffer.from('unknown'));
  await assert.rejects(pruneCommitted({ r2, now: FIXED }), /inventory incomplete/);
  assert.ok(r2.data.has(`${PREFIX}/snapshots/${old.id}/unexpected`));
}));

test('disabled backup never disables read-only recovery or watch', () => {
  const env = { MEDIA_DR_SOURCE_PROJECT: 'mosaic-dev', MEDIA_DR_ENABLED: 'false' };
  assert.throws(() => assertCommandAllowed(env, '--backup'), /disabled/);
  assert.doesNotThrow(() => assertCommandAllowed(env, '--watch'));
  assert.doesNotThrow(() => assertCommandAllowed(env, '--download'));
  assert.throws(() => assertCommandAllowed({ ...env, MEDIA_DR_SOURCE_PROJECT: 'prod' }, '--download'), /Wrong Scratch/);
});
