import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

const url = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
const hosted = url === 'https://hcxtiifzxoaflhjgoglb.supabase.co' &&
  process.env.MOSAIC_CORE_HOSTED_LAB === 'true';
const configured = (url === 'http://127.0.0.1:54321' || hosted) && key?.startsWith('sb_publishable_') &&
  process.env.MOSAIC_CORE_APP_LAB === 'true';
test.skip(!configured, 'Requires the disposable real Supabase core-app lab');
test.use({ ignoreHTTPSErrors: !hosted, actionTimeout: 15_000, navigationTimeout: 30_000 });
test.setTimeout(hosted ? 240_000 : 120_000);
const app = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
const hostedAccounts = hosted ? JSON.parse(process.env.MOSAIC_CORE_HOSTED_FIXTURES ?? '[]') : [];

async function api(path, token, body, method = body === undefined ? 'GET' : 'POST') {
  if (!configured) throw new Error('Explicit disposable Supabase lab required');
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
  const fixture = hosted ? hostedAccounts.shift() : {
    email: `mosaic-core-${randomBytes(12).toString('hex')}@example.org`,
    password: 'Aa!9' + randomBytes(24).toString('hex'),
  };
  if (!fixture || (hosted && !/^mosaic-hosted-[0-9a-f]{24}-ui-[ab]@example\.org$/.test(fixture.email)))
    throw new Error('Hosted UI requires runner-owned disposable accounts');
  const { email, password } = fixture;
  if (!hosted) expect((await api('/auth/v1/signup', null, { email, password })).ok).toBe(true);
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
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ ignoreHTTPSErrors: !hosted })));
  const boundaryErrors = [];
  const networkFailures = [];
  const responses = {};
  try {
    const [first, second, foreign] = await Promise.all(contexts.map(context => context.newPage()));
    const appwriteRequests = [];
    for (const page of [first, second, foreign]) {
      page.on('console', message => {
        if (message.text().startsWith('[ErrorBoundary:')) boundaryErrors.push(message.text().slice(0, 1500));
      });
      page.on('request', request => {
        if (/appwrite\.(io|invalid)/.test(request.url())) appwriteRequests.push(request.url().split('?')[0]);
      });
      page.on('response', response => {
        if (!response.url().startsWith(url + '/')) return;
        const label = response.request().method() + ' ' + new URL(response.url()).pathname + ' ' + response.status();
        responses[label] = (responses[label] ?? 0) + 1;
      });
      page.on('requestfailed', request => {
        if (request.url().startsWith(url + '/') && networkFailures.length < 20)
          networkFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText });
      });
    }
    await signIn(first, owner);
    await first.getByRole('button', { name: 'Open menu' }).click();
    await first.getByRole('button', { name: 'Lists & Categories' }).click();
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Initial core list');
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).some(row => row.name === 'Initial core list'))
      .toBe(true);
    await first.getByRole('listitem').filter({ hasText: 'Initial core list' })
      .getByRole('button', { name: 'Edit category', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Core private list');
    await first.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).some(row => row.name === 'Core private list'))
      .toBe(true);
    await first.keyboard.press('Escape');
    await first.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await first.getByRole('button', { name: 'Add a task to Core private list', exact: true }).first().click();
    const input = first.getByPlaceholder('Add a task to Core private list...').first();
    await input.fill('Initial core task');
    await input.press('Enter');
    await expect.poll(async () => (await rows(owner, 'tasks')).some(row => row.title === 'Initial core task'))
      .toBe(true);
    await first.getByRole('tab', { name: 'Calendar', exact: true }).click();
    await first.getByRole('button', { name: /, today,.*1 task/ }).first().click();
    await first.getByRole('dialog').getByRole('button', { name: 'Initial core task', exact: true }).first().dblclick();
    await first.getByLabel('Task title', { exact: true }).fill('Private core task');
    await first.getByLabel('Task title', { exact: true }).press('Enter');
    await expect.poll(async () => (await rows(owner, 'tasks')).some(row => row.title === 'Private core task'))
      .toBe(true);
    await first.keyboard.press('Escape');
    await first.getByRole('tab', { name: 'Todo list', exact: true }).click();

    await signIn(second, owner);
    await second.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(second.getByText('Private core task', { exact: true }).first()).toBeVisible();
    await contexts[0].setOffline(true);
    await expect(first.getByText('You are offline. Changes will sync later.', { exact: true })).toBeVisible();
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
    await expect(first.getByRole('main', { name: 'Backlog tasks', exact: true })
      .getByRole('button', { name: 'Renamed core task', exact: true })).toBeVisible();
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await second.getByRole('button', { name: 'Open menu' }).click();
    await second.getByRole('button', { name: 'Backlogs', exact: true }).click();
    await expect(second.getByRole('main', { name: 'Backlog tasks', exact: true })
      .getByRole('button', { name: 'Renamed core task', exact: true }))
      .toBeVisible({ timeout: 20_000 });
    await contexts[0].setOffline(true);
    await expect(first.getByText('You are offline. Changes will sync later.', { exact: true })).toBeVisible();
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

    // Category edits, pointer reordering and tombstones use the same domain
    // hooks as task edits and must converge on the second device too.
    await first.getByRole('button', { name: 'Home', exact: true }).click();
    await first.getByRole('button', { name: 'Open menu' }).click();
    await first.getByRole('button', { name: 'Lists & Categories' }).click();
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Second core list');
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).some(row => row.name === 'Second core list'))
      .toBe(true);
    const originalCategory = first.getByRole('listitem').filter({ hasText: 'Core private list' });
    const nextCategory = first.getByRole('listitem').filter({ hasText: 'Second core list' });
    const handle = await nextCategory.getByRole('button', { name: 'Drag to reorder' }).boundingBox();
    const target = await originalCategory.boundingBox();
    expect(handle).not.toBeNull();
    expect(target).not.toBeNull();
    await first.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await first.mouse.down();
    await first.mouse.move(handle.x + handle.width / 2, target.y + target.height / 4, { steps: 15 });
    await first.mouse.up();
    await expect.poll(async () => {
      const categories = await rows(owner, 'categories');
      return categories.find(row => row.name === 'Second core list').order_index <
        categories.find(row => row.name === 'Core private list').order_index;
    }).toBe(true);
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await second.getByRole('button', { name: 'Home', exact: true }).click();
    await second.getByRole('button', { name: 'Open menu' }).click();
    await second.getByRole('button', { name: 'Lists & Categories' }).click();
    await expect(second.getByRole('listitem').filter({ hasText: 'Second core list' }))
      .toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => {
      const labels = await second.getByRole('listitem').allTextContents();
      return labels.findIndex(text => text.includes('Second core list')) <
        labels.findIndex(text => text.includes('Core private list'));
    }, { timeout: 20_000 }).toBe(true);
    await contexts[0].setOffline(true);
    await originalCategory.getByRole('button', { name: 'Delete category', exact: true }).click();
    await first.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(originalCategory).toHaveCount(0);
    expect((await rows(owner, 'categories')).find(row => row.name === 'Core private list').is_deleted).toBe(false);
    await contexts[0].setOffline(false);
    await first.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await rows(owner, 'categories')).find(row => row.name === 'Core private list').is_deleted,
      { timeout: 25_000 }).toBe(true);
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(second.getByRole('listitem').filter({ hasText: 'Core private list' }))
      .toHaveCount(0, { timeout: 20_000 });

    await signIn(foreign, other);
    await foreign.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(foreign.getByText('Private core task', { exact: true })).toHaveCount(0);
    await expect(foreign.getByRole('tab', { name: 'Diary', exact: true })).toHaveCount(0);
    expect(await rows(other, 'tasks')).toEqual([]);
    const crossOwner = await api(`/rest/v1/mosaic_candidate_tasks?owner_id=eq.${owner.id}`, other.token);
    expect(await crossOwner.json()).toEqual([]);
    expect(appwriteRequests).toEqual([]);
  } catch (error) {
    // Real disposable UI diagnostics remain in GitHub annotations even when
    // the environment cannot download the Actions log archive. No credentials.
    const views = await Promise.all(contexts.map(async (context, index) => {
      const page = context.pages()[0];
      return { device: index, path: page ? new URL(page.url()).pathname : 'closed',
        visibleText: page ? (await page.locator('body').innerText().catch(() => '')).slice(0, 3000) : '' };
    }));
    const tasks = (await rows(owner, 'tasks')).map(row => ({
      id: row.id, title: row.title, date: row.task_date, deleted: row.is_deleted, completed: row.completed,
    }));
    const categories = (await rows(owner, 'categories')).map(row => ({
      id: row.id, name: row.name, deleted: row.is_deleted, order: row.order_index,
    }));
    const diagnostic = String(error) + '\nDisposable UI state: ' +
      JSON.stringify({ views, tasks, categories, boundaryErrors, responses, networkFailures });
    // Playwright can include a failed fill's argument in its call log.
    const redacted = [owner, other].reduce((text, account) =>
      [account.password, account.token].reduce((value, secret) =>
        secret ? value.replaceAll(secret, '[redacted]') : value, text), diagnostic);
    throw new Error(redacted);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});

test('signed server denies old clients without leases, foreign writes, and released session writes', async () => {
  test.skip(hosted, 'Hosted server guards are exercised by hosted-core.mjs with scoped fixture retirement');
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
