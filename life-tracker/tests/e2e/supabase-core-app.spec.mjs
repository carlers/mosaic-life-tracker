import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

const url = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
const configured = url === 'http://127.0.0.1:54321' && key?.startsWith('sb_publishable_') &&
  process.env.MOSAIC_CORE_APP_LAB === 'true';
test.skip(!configured, 'Requires the disposable real Supabase core-app lab');
test.use({ ignoreHTTPSErrors: true, actionTimeout: 15_000, navigationTimeout: 30_000 });
test.setTimeout(120_000);
const app = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

async function api(path, token, body, method = body === undefined ? 'GET' : 'POST') {
  if (!configured) throw new Error('Disposable loopback lab required');
  return fetch(url + path, {
    method, redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: {
      apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function account() {
  const email = `mosaic-core-${randomBytes(12).toString('hex')}@example.org`;
  const password = 'Aa!9' + randomBytes(24).toString('hex');
  expect((await api('/auth/v1/signup', null, { email, password })).ok).toBe(true);
  const grant = await api('/auth/v1/token?grant_type=password', null, { email, password });
  expect(grant.ok).toBe(true);
  const signed = await grant.json();
  return { email, password, id: signed.user.id, token: signed.access_token };
}
async function signIn(page, owner) {
  await page.goto(app + '/login');
  await page.getByLabel('Email Address').fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Calendar', exact: true })).toBeVisible({ timeout: 30_000 });
}
async function rows(owner, domain) {
  const response = await api(`/rest/v1/mosaic_candidate_${domain}?select=*&owner_id=eq.${owner.id}`, owner.token);
  expect(response.ok).toBe(true);
  return response.json();
}

test('real Mosaic UI: signed fresh owner, categories/tasks, offline replay and second-device isolation', async ({ browser }) => {
  const owner = await account();
  const other = await account();
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ ignoreHTTPSErrors: true })));
  try {
    const [first, second, foreign] = await Promise.all(contexts.map(context => context.newPage()));
    const appwriteRequests = [];
    for (const page of [first, second, foreign])
      page.on('request', request => {
        if (/appwrite\.(io|invalid)/.test(request.url())) appwriteRequests.push(request.url().split('?')[0]);
      });
    await signIn(first, owner);
    await first.getByRole('button', { name: 'Open menu' }).click();
    await first.getByRole('button', { name: 'Lists & Categories' }).click();
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Core private list');
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).some(row => row.name === 'Core private list'))
      .toBe(true);
    await first.keyboard.press('Escape');
    await first.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await first.getByRole('button', { name: 'Add a task to Core private list', exact: true }).first().click();
    const input = first.getByPlaceholder('Add a task to Core private list...').first();
    await input.fill('Private core task');
    await input.press('Enter');
    await expect.poll(async () => (await rows(owner, 'tasks')).some(row => row.title === 'Private core task'))
      .toBe(true);

    await signIn(second, owner);
    await second.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(second.getByText('Private core task', { exact: true }).first()).toBeVisible();
    await contexts[0].setOffline(true);
    await first.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
    await expect(first.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    expect((await rows(owner, 'tasks')).find(row => row.title === 'Private core task').completed).toBe(false);
    await contexts[0].setOffline(false);
    await first.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await rows(owner, 'tasks')).find(row => row.title === 'Private core task')?.completed,
      { timeout: 25_000 }).toBe(true);
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(second.getByRole('button', { name: 'Mark incomplete', exact: true }).first())
      .toBeVisible({ timeout: 20_000 });

    // Edit through the existing inline editor, then move the same row to
    // Backlogs. These are actual domain-hook writes, not direct test fixtures.
    await first.getByRole('button', { name: 'Private core task', exact: true }).first().dblclick();
    await first.getByLabel('Task title', { exact: true }).fill('Renamed core task');
    await first.getByLabel('Task title', { exact: true }).press('Enter');
    await expect.poll(async () => (await rows(owner, 'tasks')).some(row => row.title === 'Renamed core task'))
      .toBe(true);
    await first.getByRole('button', { name: 'Renamed core task', exact: true }).first().click();
    await expect(first.getByRole('button', { name: 'Move to Backlog', exact: true })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Share with friends', exact: true })).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Add Photo', exact: true })).toHaveCount(0);
    await first.getByRole('button', { name: 'Move to Backlog', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'tasks')).find(row => row.title === 'Renamed core task')?.task_date)
      .toBe('');
    await first.getByRole('button', { name: 'Open menu' }).click();
    await first.getByRole('button', { name: 'Backlogs', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Renamed core task', exact: true }).first()).toBeVisible();
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await second.getByRole('button', { name: 'Open menu' }).click();
    await second.getByRole('button', { name: 'Backlogs', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Renamed core task', exact: true }).first())
      .toBeVisible({ timeout: 20_000 });
    await contexts[0].setOffline(true);
    await first.getByRole('button', { name: 'Renamed core task', exact: true }).first().click();
    await first.getByRole('button', { name: 'Delete', exact: true }).click();
    await first.getByRole('dialog', { name: 'Delete Task', exact: true })
      .getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Renamed core task', exact: true })).toHaveCount(0);
    expect((await rows(owner, 'tasks')).find(row => row.title === 'Renamed core task').is_deleted).toBe(false);
    await contexts[0].setOffline(false);
    await first.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await rows(owner, 'tasks')).find(row => row.title === 'Renamed core task')?.is_deleted,
      { timeout: 25_000 }).toBe(true);
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(second.getByRole('button', { name: 'Renamed core task', exact: true }))
      .toHaveCount(0, { timeout: 20_000 });

    await signIn(foreign, other);
    await foreign.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(foreign.getByText('Private core task', { exact: true })).toHaveCount(0);
    await expect(foreign.getByRole('tab', { name: 'Diary', exact: true })).toHaveCount(0);
    expect(await rows(other, 'tasks')).toEqual([]);
    const crossOwner = await api(`/rest/v1/mosaic_candidate_tasks?owner_id=eq.${owner.id}`, other.token);
    expect(await crossOwner.json()).toEqual([]);
    expect(appwriteRequests).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});

test('signed server denies old clients without leases, foreign writes, and released session writes', async () => {
  const owner = await account();
  const other = await account();
  const document = {
    owner_id: owner.id, id: 'cat_' + randomBytes(8).toString('hex'),
    name: 'Private', color: '#345678', order_index: 0, visibility: 'private',
  };
  expect((await api('/rest/v1/mosaic_candidate_categories', owner.token, document)).status).toBe(403);
  const lease = await api('/rest/v1/rpc/mosaic_core_session', owner.token, { p_action: 'acquire' });
  expect(lease.ok).toBe(true);
  const identity = await lease.json();
  expect(identity.canonicalOwnerId).toBe('sb_' + owner.id.replaceAll('-', ''));
  expect((await api('/rest/v1/mosaic_candidate_categories', owner.token, document)).ok).toBe(true);
  expect((await api('/rest/v1/mosaic_candidate_categories', other.token, document)).status).toBe(403);
  expect((await api('/rest/v1/mosaic_candidate_categories', null)).ok).toBe(false);
  expect((await api('/rest/v1/rpc/mosaic_core_session', owner.token, { p_action: 'change_backend' })).ok).toBe(false);
  expect((await api(`/rest/v1/mosaic_candidate_categories?id=eq.${document.id}`,
    owner.token, { name: 'Bypass CAS' }, 'PATCH')).status).toBe(403);
  const original = (await rows(owner, 'categories'))[0];
  const foreignCas = await api('/rest/v1/rpc/mosaic_candidate_cas_category', other.token, {
    p_id: document.id, p_expected_seq: original.change_seq, p_patch: { name: 'Foreign mutation' },
  });
  expect(foreignCas.ok).toBe(true);
  expect((await foreignCas.json())?.owner_id ?? null).toBeNull();
  const accepted = await api('/rest/v1/rpc/mosaic_candidate_cas_category', owner.token, {
    p_id: document.id, p_expected_seq: original.change_seq, p_patch: { name: 'Accepted CAS' },
  });
  expect(accepted.ok).toBe(true);
  const updated = await accepted.json();
  expect(BigInt(updated.change_seq)).toBeGreaterThan(BigInt(original.change_seq));
  const stale = await api('/rest/v1/rpc/mosaic_candidate_cas_category', owner.token, {
    p_id: document.id, p_expected_seq: original.change_seq, p_patch: { name: 'Stale CAS' },
  });
  expect(stale.ok).toBe(true);
  expect((await stale.json())?.owner_id ?? null).toBeNull();
  expect((await api('/rest/v1/rpc/mosaic_core_session', owner.token, { p_action: 'release' })).ok).toBe(true);
  const stored = (await rows(owner, 'categories'))[0];
  const cas = await api('/rest/v1/rpc/mosaic_candidate_cas_category', owner.token, {
    p_id: document.id, p_expected_seq: stored.change_seq, p_patch: { name: 'Stale write' },
  });
  expect(cas.status).toBe(403);
  expect((await rows(owner, 'categories'))[0].name).toBe('Accepted CAS');
  expect((await api('/rest/v1/rpc/mosaic_core_session', null, { p_action: 'acquire' })).ok).toBe(false);
  expect((await api('/auth/v1/logout?scope=local', owner.token, {})).ok).toBe(true);
  expect((await api('/rest/v1/rpc/mosaic_core_session', owner.token, { p_action: 'acquire' })).status).toBe(403);
});
