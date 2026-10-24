import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PREFIX, SOURCE, publishUnified, verifyUnified, watchUnified,
  downloadUnified, pruneUnified, assertFullSource } from '../unified-offsite.mjs';
const NOW = new Date('2026-10-25T12:00:00.000Z');
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
  await assert.rejects(watchUnified({ r2, now: new Date('2026-10-29T00:00:00Z') }), /stale/);
  for (const kind of ['database', 'media']) {
    const key = m.archives[kind].parts[0].key;
    const saved = r2.objects.get(key);
    r2.objects.set(key, Buffer.alloc(saved.length));
    await assert.rejects(verifyUnified({ r2, id: m.id, now: NOW }), /corrupt/);
    r2.objects.set(key, saved);
  }
  await assert.rejects(verifyUnified({ r2, id: m.id, now: new Date('2026-10-20T00:00:00Z') }), /future/);
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
  const old = await publishUnified({ r2, database, media, now: new Date('2026-01-01T12:00:00Z') });
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
