/**
 * Runs ONLY in the dedicated disposable local Supabase CLI Actions lab.
 * Uses actual Supabase Auth-issued JWTs, PostgREST, CAS, Chromium, RxDB/Dexie.
 * Does not use hosted projects, Appwrite, actual user accounts or service keys.
 */
import { randomBytes } from 'node:crypto';
import { runOwnerPrivateProviderAcceptance, OWNER_PRIVATE_ACCEPTANCE_DOMAINS } from '../provider/ownerPrivateAcceptance.mjs';
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
  return { id: user.id, token: grant.access_token, email, password };
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
async function secondDeviceCas(user, row, newName, updatedAt = '2026-10-21T00:00:00.000Z') {
  const reply = await request('/rest/v1/rpc/mosaic_candidate_cas_category', {
    method: 'POST', token: user.token,
    body: {
      p_id: row.id, p_expected_seq: String(row.change_seq),
      p_patch: {
        name: newName, updated_at: updatedAt,
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
  // The accepted server value can be visible before RxDB has finished
  // acknowledging the previous push checkpoint. Never start a new edit
  // against an incomplete replication cycle in this restart test.
  await page.evaluate(() => window.__mosaicSignedRxdb.awaitSynced());

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
  expect(beforeUnchanged.local.find(item => item.id === firstId)?.name)
    .toBe(reviewed.localName);
  await expect(page.evaluate(id => window.__mosaicSignedRxdb.refreshConflict(id), firstId))
    .resolves.toEqual({ state: 'unchanged', revision: reviewed.remoteRevision });
  const afterUnchanged = await probe();
  expect(afterUnchanged.masterReads).toBe(beforeUnchanged.masterReads + 1);
  expect(afterUnchanged.pending).toEqual(beforeUnchanged.pending);

  // Now an independent signed HTTP client applies the EXACT pending local
  // draft. One explicit review refresh should clear the conflict and wake
  // RxDB's parked push. That push must only read/ack — no extra CAS write.
  const anotherRemote = await owned(a, firstId);
  const converged = await secondDeviceCas(a, anotherRemote,
    'Converged independently', '2026-10-20T00:00:00.000Z');
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


test('signed local Supabase CAS denies cross-owner writes, forged patches, direct DML and stale revisions', async () => {
  if (!configured) throw new Error('Local-only test credentials required');
  const a = await newSignedUser('cas_owner_a');
  const b = await newSignedUser('cas_owner_b');
  const suffix = randomBytes(7).toString('hex');
  const categoryId = 'isolated_category_' + suffix;
  const taskId = 'isolated_task_' + suffix;
  const category = await seed(a, categoryId, 'A private category');
  const taskRows = await request('/rest/v1/mosaic_candidate_tasks', {
    token: a.token, method: 'POST',
    body: {
      owner_id: a.id, id: taskId, title: 'A private task',
      completed: false, category_id: categoryId, order_index: 0,
      task_date: '2026-10-19', created_at: '2026-10-19T00:00:00.000Z',
      updated_at: '2026-10-19T00:00:00.000Z', visibility: 'private',
      is_deleted: false,
    },
  });
  expect(taskRows).toHaveLength(1);
  const taskRow = taskRows[0];

  const raw = async (path, { token, method = 'POST', body } = {}) =>
    fetch(url + path, {
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
  const rpc = (domain, id, seq, patch, token) =>
    raw('/rest/v1/rpc/mosaic_candidate_cas_' + domain, {
      token,
      body: { p_id: id, p_expected_seq: String(seq), p_patch: patch },
    });
  const expectDenied = async (response, expectedStatuses = [400, 401, 403]) => {
    expect(expectedStatuses, 'unexpected RPC rejection status').toContain(response.status);
    expect(response.ok).toBe(false);
  };
  const expectNoRow = async (response) => {
    expect(response.status).toBe(200);
    const result = await response.json();
    // PostgREST can encode a PostgreSQL RETURNS <composite> NULL as a
    // typed row with every field null. Both forms mean ZERO rows changed;
    // never accept partial-null or ownerless-but-nonempty responses.
    if (result !== null) {
      expect(result).toMatchObject({
        owner_id: null, id: null, change_seq: null, is_deleted: null,
      });
      expect(Object.values(result).length).toBeGreaterThan(4);
      expect(Object.values(result).every(value => value === null)).toBe(true);
    }
  };
  for (const [domain, id, seq, patch] of [
    ['category', categoryId, category.change_seq, { name: 'Stolen category' }],
    ['task', taskId, taskRow.change_seq, { title: 'Stolen task' }],
  ]) {
    // SECURITY DEFINER is callable to signed clients; the function MUST use
    // auth.uid(), not the caller's owner_id or merely the guessed document ID.
    await expectNoRow(await rpc(domain, id, seq, patch, b.token));
    await expectDenied(await rpc(domain, id, seq, patch, undefined), [401, 403]);
    await expectDenied(await rpc(domain, id, seq, { ...patch, owner_id: b.id }, a.token));
    await expectDenied(await rpc(domain, id, seq, { ...patch, id: 'forged_id' }, a.token));
    await expectDenied(await rpc(domain, id, seq, {}, a.token));
    await expectDenied(await rpc(domain, id, seq, ['array-is-not-a-patch'], a.token));
  }

  // A valid full owner-signed CAS is a positive control for the privilege
  // boundary. The exact same revision must be a stale no-op after this update.
  const applied = await rpc('category', categoryId, category.change_seq,
    { name: 'A authorized edit' }, a.token);
  expect(applied.status).toBe(200);
  const updated = await applied.json();
  expect(updated).toMatchObject({ id: categoryId, owner_id: a.id, name: 'A authorized edit' });
  expect(BigInt(updated.change_seq)).toBeGreaterThan(BigInt(category.change_seq));
  await expectNoRow(await rpc('category', categoryId, category.change_seq,
    { name: 'Stale overwrite' }, a.token));

  // RLS + grants must deny physical deletion and direct UPDATE even to the
  // rightful owner. Only the narrow, revision-checked CAS RPC may modify rows.
  for (const table of ['mosaic_candidate_categories', 'mosaic_candidate_tasks']) {
    const id = table.endsWith('categories') ? categoryId : taskId;
    const selector = '/rest/v1/' + table + '?' +
      new URLSearchParams({ owner_id: 'eq.' + a.id, id: 'eq.' + id });
    await expectDenied(await raw(selector, {
      method: 'PATCH', token: a.token, body: table.endsWith('categories')
        ? { name: 'Direct permission bypass' } : { title: 'Direct permission bypass' },
    }), [401, 403]);
    await expectDenied(await raw(selector, { method: 'DELETE', token: a.token }), [401, 403]);
    const outsiderRead = await request(selector, { token: b.token });
    expect(outsiderRead).toEqual([]);
  }

  // Forged INSERT ownership must be blocked independently of the RPC path.
  const foreignInsert = await raw('/rest/v1/mosaic_candidate_categories', {
    token: b.token, body: {
      owner_id: a.id, id: 'forged_' + suffix, name: 'Foreign forged',
      color: '#000000', order_index: 0, visibility: 'private',
      updated_at: '2026-10-19T00:00:00.000Z', is_deleted: false,
    },
  });
  await expectDenied(foreignInsert, [401, 403]);
  expect((await owned(a, categoryId)).name).toBe('A authorized edit');
  const finalTasks = await request('/rest/v1/mosaic_candidate_tasks?' +
    new URLSearchParams({ select: '*', owner_id: 'eq.' + a.id, id: 'eq.' + taskId }), {
    token: a.token,
  });
  expect(finalTasks).toHaveLength(1);
  expect(finalTasks[0]).toMatchObject({
    owner_id: a.id, id: taskId, title: 'A private task',
  });

  // The owner cannot impersonate a friend reaction or rewrite the original
  // creation timestamp. Invalid requests must not consume a CAS revision.
  const protectedRevision = String(finalTasks[0].change_seq);
  for (const protectedPatch of [
    { created_at: '2000-01-01' },
    { reactions: 'forged-actor-reaction' },
    { title: 'Mixed forged edit', reactions: 'forged-actor-reaction' },
  ]) {
    await expectDenied(await rpc('task', taskId, protectedRevision, protectedPatch, a.token));
    const same = await request('/rest/v1/mosaic_candidate_tasks?' +
      new URLSearchParams({ select: 'id,change_seq,title,created_at,reactions',
        owner_id: 'eq.' + a.id, id: 'eq.' + taskId }), { token: a.token });
    expect(same).toHaveLength(1);
    expect(String(same[0].change_seq)).toBe(protectedRevision);
    expect(same[0].created_at).toBe(taskRow.created_at);
    expect(same[0].reactions ?? '').toBe('');
    expect(same[0].title).toBe('A private task');
  }

  const spoofed = await raw('/rest/v1/mosaic_candidate_tasks', {
    token: a.token,
    body: {
      owner_id: a.id, id: 'forged_reactions_' + suffix,
      title: 'Forged first write', completed: false,
      category_id: categoryId, order_index: 0, task_date: '2026-10-19',
      created_at: '2026-10-19T00:00:00.000Z',
      updated_at: '2026-10-19T00:00:00.000Z', visibility: 'private',
      reactions: 'server-impersonation', is_deleted: false,
    },
  });
  await expectDenied(spoofed, [401, 403]);

  const ownerTaskCas = await rpc('task', taskId, protectedRevision,
    { title: 'Legitimate owner task edit' }, a.token);
  expect(ownerTaskCas.status).toBe(200);
  const ownerTask = await ownerTaskCas.json();
  expect(ownerTask).toMatchObject({
    id: taskId, owner_id: a.id,
    created_at: taskRow.created_at, title: 'Legitimate owner task edit',
  });
  expect(ownerTask.reactions ?? '').toBe('');
  expect(BigInt(ownerTask.change_seq)).toBeGreaterThan(BigInt(protectedRevision));
  await expectNoRow(await rpc('task', taskId, protectedRevision,
    { title: 'Stale task edit' }, a.token));
});


test('shared eight-domain fixtures exercise only implemented private task/category contracts with real signed provider sessions', async ({ page }) => {
  if (!configured) throw new Error('Local-only test credentials required');
  const a = await newSignedUser('fixture_a');
  const b = await newSignedUser('fixture_b');
  await page.addInitScript(config => { window.__mosaicSignedRxdbConfig = config; }, {
    endpoint: url, publishableKey: key, token: a.token,
    supabaseId: a.id, legacyId: 'synthetic_owner_a',
    dbTag: 'parity_' + randomBytes(5).toString('hex'),
  });
  await page.goto(BASE_URL + '/tests/e2e/supabase-signed-rxdb.html');
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb?.privateProviderFixtures));
  const fixtures = await page.evaluate(principals =>
    window.__mosaicSignedRxdb.privateProviderFixtures(principals), {
    a: a.id, b: b.id,
  });

  const tableNames = {
    categories: 'mosaic_candidate_categories',
    tasks: 'mosaic_candidate_tasks',
  };
  const rpcNames = {
    categories: 'mosaic_candidate_cas_category',
    tasks: 'mosaic_candidate_cas_task',
  };
  const raw = async (path, { token, method = 'GET', body } = {}) => {
    const response = await fetch(url + path, {
      method, redirect: 'error', cache: 'no-store',
      headers: {
        apikey: key,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body === undefined ? {} : {
          'Content-Type': 'application/json', Prefer: 'return=representation',
        }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return response;
  };
  const denied = response => [401, 403].includes(response.status) && !response.ok
    ? 'denied' : 'unexpected';
  const rpc = async (domain, principal, id, revision, patch) => {
    const response = await raw('/rest/v1/rpc/' + rpcNames[domain], {
      token: principal?.token,
      method: 'POST',
      body: { p_id: id, p_expected_seq: revision, p_patch: patch },
    });
    if (!response.ok) throw new Error('Signed private CAS failed HTTP ' + response.status);
    const value = await response.json();
    if (value === null) return { state: 'conflict' };
    // PostgreSQL RETURNS composite can serialize a no-update result as a
    // fully NULL typed record. Reject incomplete or mixed-null responses.
    if (value && typeof value === 'object' && !Array.isArray(value) &&
      ['owner_id', 'id', 'change_seq', 'is_deleted'].every(
        name => Object.hasOwn(value, name) && value[name] === null,
      ) && Object.values(value).every(field => field === null)) {
      return { state: 'conflict' };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Malformed signed private CAS response');
    }
    return { state: 'applied', row: value };
  };

  const adapter = {
    async create(domain, principal, body) {
      const response = await raw('/rest/v1/' + tableNames[domain], {
        token: principal.token, method: 'POST', body,
      });
      if (response.status !== 201) throw new Error('Signed fixture create failed HTTP ' + response.status);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Invalid signed create representation');
      return rows[0];
    },
    async read(domain, principal, ownerId) {
      return request('/rest/v1/' + tableNames[domain] + '?' + new URLSearchParams({
        select: '*', owner_id: 'eq.' + ownerId, order: 'change_seq.asc',
      }), { token: principal.token });
    },
    async forgedInsert(domain, principal, otherOwnerFixture) {
      return denied(await raw('/rest/v1/' + tableNames[domain], {
        token: principal.token, method: 'POST', body: otherOwnerFixture,
      }));
    },
    async anonRead(domain, ownerId) {
      return denied(await raw('/rest/v1/' + tableNames[domain] + '?' +
        new URLSearchParams({ select: 'id', owner_id: 'eq.' + ownerId })));
    },
    async anonCas(domain, id, revision, patch) {
      const response = await raw('/rest/v1/rpc/' + rpcNames[domain], {
        method: 'POST',
        body: { p_id: id, p_expected_seq: revision, p_patch: patch },
      });
      return denied(response);
    },
    async directWrite(domain, principal, row, method) {
      return denied(await raw('/rest/v1/' + tableNames[domain] + '?' +
        new URLSearchParams({ owner_id: 'eq.' + principal.id, id: 'eq.' + row.id }), {
        token: principal.token, method,
        ...(method === 'PATCH' ? { body: { is_deleted: true } } : {}),
      }));
    },
    cas: rpc,
    async changes(domain, principal, afterExclusive) {
      return request('/rest/v1/' + tableNames[domain] + '?' + new URLSearchParams({
        select: '*', owner_id: 'eq.' + principal.id,
        change_seq: 'gt.' + afterExclusive, order: 'change_seq.asc', limit: '100',
      }), { token: principal.token });
    },
  };
  const principals = { a, b };
  const results = [];
  for (const domain of OWNER_PRIVATE_ACCEPTANCE_DOMAINS) {
    results.push(await runOwnerPrivateProviderAcceptance({
      domain, principals, fixtures, adapter,
    }));
  }
  expect(results.map(result => result.domain)).toEqual(['categories', 'tasks']);
  expect(results.every(result => result.signedOwners === 2 &&
    result.recordsCreated === 4 && result.checks >= 12)).toBe(true);
  // Domain capabilities are honest. The other six fixtures exist, but
  // no current signed target implements their authorization/side effects.
});

test('real local browser Supabase Auth lifecycle: password login, rotation, account switch and logout', async ({ page }) => {
  if (!configured) throw new Error('Local signed provider configuration absent');
  const a = await newSignedUser('auth-a');
  const b = await newSignedUser('auth-b');
  const dbTag = 'auth' + randomBytes(6).toString('hex');
  await page.addInitScript(settings => { window.__mosaicSignedRxdbConfig = settings; }, {
    endpoint: url, publishableKey: key, token: a.token,
    supabaseId: a.id, legacyId: 'legacy_auth_fixture', dbTag,
  });
  await page.goto(BASE_URL + '/tests/e2e/supabase-signed-rxdb.html');
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  const state = await page.evaluate(async ({ a, b }) => {
    return window.__mosaicSignedRxdb.exerciseSignedAuthLifecycle({ a, b });
  }, {
    a: { id: a.id, email: a.email, password: a.password },
    b: { id: b.id, email: b.email, password: b.password },
  });
  expect(state).toMatchObject({
    firstOwner: a.id, refreshedOwner: a.id, switchedOwner: b.id,
    refreshEpochAdvanced: true, previousOwnerDenied: true,
    localSessionCleared: true,
  });
  // Do not expose JWTs/refresh tokens in Playwright outputs or persistent
  // browser storage. This adapter has no silent offline identity fallback.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
});

test('signed localhost Supabase Auth: refresh-only browser persistence, reload verification, rotation and erasure', async ({ page }) => {
  if (!configured) throw new Error('Local signed provider configuration absent');
  const a = await newSignedUser('persist-a');
  const dbTag = 'persist' + randomBytes(6).toString('hex');
  await page.addInitScript(settings => { window.__mosaicSignedRxdbConfig = settings; }, {
    endpoint: url, publishableKey: key, token: a.token,
    supabaseId: a.id, legacyId: 'legacy_persist_fixture', dbTag,
  });
  const target = BASE_URL + '/tests/e2e/supabase-signed-rxdb.html';
  const owner = { id: a.id, email: a.email, password: a.password };
  const execute = async phase => page.evaluate(
    async ({ phase, owner }) => window.__mosaicSignedRxdb.exerciseSignedPersistedAuth(phase, owner),
    { phase, owner },
  );
  await page.goto(target);
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  expect(await execute('login')).toEqual({
    phase: 'login', signedOwner: a.id, savedRefreshOnly: true,
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  expect(await execute('restore')).toEqual({
    phase: 'restore', restoredOwner: a.id, rotated: true,
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  expect(await execute('logout')).toEqual({ phase: 'logout', signedOut: true });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  expect(await execute('empty')).toEqual({ phase: 'empty', empty: true });
});

test('signed local core domains: native RxDB task create, offline completion and tombstone replay', async ({ page }) => {
  if (!configured) throw new Error('Local signed provider configuration absent');
  const suffix = 'core' + randomBytes(6).toString('hex');
  const categoryId = 'category_' + suffix;
  const peerCategoryId = 'peer_category_' + suffix;
  const taskId = 'task_' + suffix;
  const otherTaskId = 'foreign_task_' + suffix;
  const a = await newSignedUser('core-a');
  const b = await newSignedUser('core-b');
  await seed(a, categoryId, 'Owner private category');
  await seed(b, peerCategoryId, 'Peer private category');
  const peerTask = await request('/rest/v1/mosaic_candidate_tasks', {
    token: b.token, method: 'POST',
    body: {
      owner_id: b.id, id: otherTaskId, title: 'Never leak peer task',
      category_id: peerCategoryId, completed: false, order_index: 0,
      task_date: '2026-10-19', created_at: '2026-10-19T00:00:00.000Z',
      updated_at: '2026-10-19T00:00:00.000Z', visibility: 'private',
      reactions: null, is_deleted: false,
    },
  });
  expect(peerTask).toHaveLength(1);
  await page.addInitScript(settings => { window.__mosaicSignedRxdbConfig = settings; }, {
    endpoint: url, publishableKey: key,
    token: a.token, supabaseId: a.id, legacyId: 'legacy_local_candidate_owner',
    dbTag: suffix,
  });
  const target = BASE_URL + '/tests/e2e/supabase-signed-rxdb.html';
  const start = async () => {
    await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
    await page.evaluate(() => window.__mosaicSignedRxdb.start());
  };
  const ownerTask = async () => request('/rest/v1/mosaic_candidate_tasks?' +
    new URLSearchParams({ select: '*', owner_id: 'eq.' + a.id, id: 'eq.' + taskId }),
  { token: a.token }).then(rows => rows[0] ?? null);
  await page.goto(target);
  await start();
  expect((await page.evaluate(() => window.__mosaicSignedRxdb.snapshot())).localTasks)
    .toEqual([]);
  await page.evaluate(args => window.__mosaicSignedRxdb.createLocalTask(args), {
    id: taskId, categoryId, title: 'Offline-ready private task',
  });
  await expect.poll(async () => (await ownerTask())?.title, { timeout: 20_000 })
    .toBe('Offline-ready private task');
  const synced = await page.evaluate(() => window.__mosaicSignedRxdb.snapshot());
  expect(synced.localTasks).toEqual([expect.objectContaining({
    id: taskId, userId: 'legacy_local_candidate_owner', completed: false,
  })]);
  expect(synced.localTasks.some(task => task.id === otherTaskId)).toBe(false);

  // Disconnect REST while local IndexedDB stays usable; no checkpoint may
  // falsely acknowledge the write while server ownership stays unchanged.
  await page.evaluate(async id => {
    window.__mosaicSignedRxdb.setOffline(true);
    await window.__mosaicSignedRxdb.editLocalTask(id, 'complete');
  }, taskId);
  await expect.poll(async () =>
    (await page.evaluate(() => window.__mosaicSignedRxdb.snapshot())).failures,
  { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await ownerTask()).completed).toBe(false);
  await page.evaluate(() => window.__mosaicSignedRxdb.stop());

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__mosaicSignedRxdb));
  await page.evaluate(() => window.__mosaicSignedRxdb.setOffline(false));
  await start();
  await expect.poll(async () => (await ownerTask())?.completed, { timeout: 20_000 })
    .toBe(true);
  const restored = await page.evaluate(() => window.__mosaicSignedRxdb.snapshot());
  expect(restored.localTasks.find(task => task.id === taskId)?.completed).toBe(true);
  expect(restored.localTasks.some(task => task.id === otherTaskId)).toBe(false);

  await page.evaluate(id => window.__mosaicSignedRxdb.editLocalTask(id, 'delete'), taskId);
  await expect.poll(async () => (await ownerTask())?.is_deleted, { timeout: 20_000 })
    .toBe(true);
  // Deletion is a soft tombstone: the owner still sees it in incremental
  // revision replay, and a foreign owner still cannot read this row.
  const cursor = String((await ownerTask()).change_seq);
  expect(BigInt(cursor)).toBeGreaterThan(0n);
  const deniedForeign = await request('/rest/v1/mosaic_candidate_tasks?' +
    new URLSearchParams({ owner_id: 'eq.' + a.id, id: 'eq.' + taskId, select: '*' }),
  { token: b.token });
  expect(deniedForeign).toEqual([]);
  await page.evaluate(() => window.__mosaicSignedRxdb.stop());
});
