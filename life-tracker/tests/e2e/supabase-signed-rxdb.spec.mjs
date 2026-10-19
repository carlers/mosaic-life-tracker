/**
 * Runs ONLY in the dedicated disposable local Supabase CLI Actions lab.
 * Uses actual Supabase Auth-issued JWTs, PostgREST, CAS, Chromium, RxDB/Dexie.
 * Does not use hosted projects, Appwrite, actual user accounts or service keys.
 */
import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

const url = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
const configured = url === 'http://127.0.0.1:54321' &&
  typeof key === 'string' && key.startsWith('sb_publishable_');
test.skip(!configured, 'Dedicated isolated Supabase local CI only');
test.use({ ignoreHTTPSErrors: true });

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

async function request(path, { token, method = 'GET', body } = {}) {
  if (!configured) throw new Error('Refusing to contact a nonlocal Supabase endpoint');
  const response = await fetch(url + path, {
    method, redirect: 'error',
    headers: {
      apikey: key,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : {
        'Content-Type': 'application/json', Prefer: 'return=representation',
      }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error('Local signed test HTTP ' + response.status + ' at ' + path.split('?')[0]);
  return response.json();
}
async function newSignedUser(label) {
  const email = 'mosaic-967-' + randomBytes(12).toString('hex') + '-' + label + '@example.org';
  const password = 'Aa!9' + randomBytes(25).toString('hex');
  const signup = await request('/auth/v1/signup', { method: 'POST', body: { email, password } });
  const grant = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  if (!grant.access_token || grant.access_token.length < 40)
    throw new Error('No signed local Auth password grant');
  const user = await request('/auth/v1/user', { token: grant.access_token });
  if (!user.id || user.id !== signup.user?.id)
    throw new Error('Supabase Auth signed principal failed server verification');
  return { id: user.id, token: grant.access_token };
}
async function seed(user, id, name) {
  const rows = await request('/rest/v1/mosaic_candidate_categories', {
    method: 'POST', token: user.token,
    body: {
      owner_id: user.id, id, name, color: '#345678', order_index: 0,
      visibility: 'private', icon: null, updated_at: '2026-10-19T00:00:00.000Z',
      is_deleted: false,
    },
  });
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].owner_id !== user.id)
    throw new Error('Signed category create returned invalid owner');
  return rows[0];
}
async function owned(user, id) {
  const rows = await request('/rest/v1/mosaic_candidate_categories?' +
    new URLSearchParams({ select: '*', owner_id: 'eq.' + user.id, id: 'eq.' + id }), {
    token: user.token,
  });
  if (!Array.isArray(rows)) throw new Error('Invalid signed owner read');
  return rows[0] ?? null;
}
async function secondDeviceCas(user, row, newName) {
  const reply = await request('/rest/v1/rpc/mosaic_candidate_cas_category', {
    method: 'POST', token: user.token,
    body: {
      p_id: row.id, p_expected_seq: String(row.change_seq),
      p_patch: {
        name: newName, updated_at: '2026-10-21T00:00:00.000Z',
      },
    },
  });
  if (reply?.id !== row.id || reply.owner_id !== user.id ||
    BigInt(reply.change_seq) <= BigInt(row.change_seq))
    throw new Error('Second signed writer CAS did not succeed');
  return reply;
}

test('actual signed Supabase + Chromium RxDB: checkpoint, offline retry, and safe competing edits', async ({ page }) => {
  if (!configured) throw new Error('Local signed provider configuration absent');
  const suffix = 'r' + randomBytes(6).toString('hex');
  const firstId = 'cat_first_' + suffix;
  const secondId = 'cat_second_' + suffix;
  const foreignId = 'cat_foreign_' + suffix;
  const a = await newSignedUser('a');
  const b = await newSignedUser('b');
  const firstRow = await seed(a, firstId, 'Initial server value');
  await seed(b, foreignId, 'Other account secret');
  const crossOwner = await request('/rest/v1/mosaic_candidate_categories?' +
    new URLSearchParams({ select: 'id', owner_id: 'eq.' + b.id }), { token: a.token });
  expect(crossOwner).toEqual([]);

  await page.addInitScript(config => {
    window.__mosaicSignedRxdbConfig = config;
  }, {
    endpoint: url,
    publishableKey: key,
    token: a.token, supabaseId: a.id, legacyId: 'legacy_local_candidate_owner',
    dbTag: suffix,
  });
  const target = BASE_URL + '/tests/e2e/supabase-signed-rxdb.html';
  const probe = () => page.evaluate(() => window.__mosaicSignedRxdb.snapshot());
  const start = async () => {
    await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
    await page.evaluate(() => window.__mosaicSignedRxdb.start());
  };
  await page.goto(target);
  await start();
  const initial = await probe();
  expect(initial.local).toEqual([expect.objectContaining({
    id: firstId, name: 'Initial server value', userId: 'legacy_local_candidate_owner',
  })]);
  expect(initial.cursors[0]).toBe('0');

  await page.evaluate(() => window.__mosaicSignedRxdb.stop());
  const second = await seed(a, secondId, 'Created while browser closed');
  expect(BigInt(second.change_seq)).toBeGreaterThan(BigInt(firstRow.change_seq));
  await page.reload();
  await start();
  const resumed = await probe();
  expect(resumed.cursors[0]).toBe(String(firstRow.change_seq));
  expect(resumed.local).toHaveLength(2);
  expect(resumed.local.some(item => item.id === secondId)).toBe(true);
  expect(resumed.local.some(item => item.id === foreignId)).toBe(false);

  // Drop browser-to-REST calls after initial signed pull while Auth itself
  // stays reachable. An offline owner edit must remain in IndexedDB.
  await page.evaluate(async id => {
    window.__mosaicSignedRxdb.setOffline(true);
    await window.__mosaicSignedRxdb.edit(id, 'Offline draft committed later');
  }, firstId);
  await expect.poll(async () => (await probe()).failures, { timeout: 15_000 })
    .toBeGreaterThan(0);
  expect((await owned(a, firstId)).name).toBe('Initial server value');
  await page.evaluate(() => window.__mosaicSignedRxdb.stop());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  await page.evaluate(() => window.__mosaicSignedRxdb.setOffline(false));
  await start();
  await expect.poll(async () => (await owned(a, firstId))?.name, {
    timeout: 20_000,
  }).toBe('Offline draft committed later');
  expect((await probe()).local.find(item => item.id === firstId)?.name)
    .toBe('Offline draft committed later');

  // Same owner, separate signed HTTP writer. Make a second offline edit, then
  // advance the server revision independently. The stale offline edit must
  // neither overwrite the remote winner nor disappear from local Dexie.
  await page.evaluate(async id => {
    window.__mosaicSignedRxdb.setOffline(true);
    await window.__mosaicSignedRxdb.edit(id, 'Conflicting offline local draft');
  }, firstId);
  const preceding = await owned(a, firstId);
  await secondDeviceCas(a, preceding, 'Other device authoritative edit');
  const readsBefore = (await probe()).remoteReads;
  await page.evaluate(() => {
    window.__mosaicSignedRxdb.setOffline(false);
    window.__mosaicSignedRxdb.resync();
  });
  await expect.poll(async () => (await probe()).remoteReads, { timeout: 20_000 })
    .toBeGreaterThan(readsBefore);
  // Wait for the genuine owner-scoped conflict rather than a sleep-based
  // assumption; it must be surfaced before any manual resolution.
  await expect.poll(async () => (await probe()).pending.find(
    row => row.documentId === firstId,
  )?.remoteRevision, { timeout: 20_000 }).toBeTruthy();
  // Longer than RxDB's configured 5s network retry. The parked conflicted
  // push must not repeat owner-master GET or Auth /user during human review.
  const baseline = await probe();
  await page.waitForTimeout(6200);
  const end = await probe();
  expect(end.masterReads).toBe(baseline.masterReads);
  expect(end.authChecks).toBe(baseline.authChecks);
  expect(end.local.find(item => item.id === firstId)?.name)
    .toBe('Conflicting offline local draft');
  expect((await owned(a, firstId))?.name).toBe('Other device authoritative edit');
  // The bridge must *surface* the owner-scoped conflict rather than only
  // preserving it silently. An explicit keep-local decision is then CAS
  // guarded by the server revision the user actually reviewed.
  const conflict = (await probe()).pending.find(row => row.documentId === firstId);
  expect(conflict).toMatchObject({
    localName: 'Conflicting offline local draft',
    remoteName: 'Other device authoritative edit',
  });
  const approved = await page.evaluate(({ id, revision }) =>
    window.__mosaicSignedRxdb.resolveKeepLocal(id, revision), {
    id: firstId, revision: conflict.remoteRevision,
  });
  expect(approved.state).toBe('applied');
  await expect.poll(async () => (await owned(a, firstId))?.name, {
    timeout: 15_000,
  }).toBe('Conflicting offline local draft');
  expect((await probe()).pending).toEqual([]);

  // A second local draft is conflicted by a different signed writer. Review
  // refresh is explicit and makes exactly one remote master read per click,
  // without any automatic poll, CAS, or destructive master-wins merge.
  await page.evaluate(async id => {
    window.__mosaicSignedRxdb.setOffline(true);
    await window.__mosaicSignedRxdb.edit(id, 'Converged independently');
  }, firstId);
  const afterFirstResolution = await owned(a, firstId);
  await secondDeviceCas(a, afterFirstResolution, 'Another divergent server edit');
  const previousReads = (await probe()).remoteReads;
  await page.evaluate(() => {
    window.__mosaicSignedRxdb.setOffline(false);
    window.__mosaicSignedRxdb.resync();
  });
  await expect.poll(async () => (await probe()).remoteReads,
    { timeout: 20_000 }).toBeGreaterThan(previousReads);
  await expect.poll(async () => (await probe()).pending.find(
    conflict => conflict.documentId === firstId,
  )?.remoteRevision, { timeout: 20_000 }).toBeTruthy();
  const reviewed = (await probe()).pending.find(conflict => conflict.documentId === firstId);
  const beforeUnchanged = await probe();
  await expect(page.evaluate(id => window.__mosaicSignedRxdb.refreshConflict(id), firstId))
    .resolves.toEqual({ state: 'unchanged', revision: reviewed.remoteRevision });
  const afterUnchanged = await probe();
  expect(afterUnchanged.masterReads).toBe(beforeUnchanged.masterReads + 1);
  expect(afterUnchanged.pending).toEqual(beforeUnchanged.pending);

  // Now an independent signed HTTP client applies the EXACT pending local
  // draft. One explicit review refresh should clear the conflict and wake
  // RxDB's parked push. That push must only read/ack — no extra CAS write.
  const anotherRemote = await owned(a, firstId);
  const converged = await secondDeviceCas(a, anotherRemote, 'Converged independently');
  const beforeConvergence = await probe();
  await expect(page.evaluate(id => window.__mosaicSignedRxdb.refreshConflict(id), firstId))
    .resolves.toEqual({ state: 'converged', revision: String(converged.change_seq) });
  await expect.poll(async () => (await probe()).pending.length,
    { timeout: 15_000 }).toBe(0);
  expect((await probe()).local.find(item => item.id === firstId)?.name)
    .toBe('Converged independently');
  const stableMaster = await owned(a, firstId);
  expect(stableMaster.name).toBe('Converged independently');
  expect(String(stableMaster.change_seq)).toBe(String(converged.change_seq));
  expect((await probe()).masterReads).toBeGreaterThanOrEqual(beforeConvergence.masterReads + 1);

  await page.evaluate(() => window.__mosaicSignedRxdb.stop());
});
