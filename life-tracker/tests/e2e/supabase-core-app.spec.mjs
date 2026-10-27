import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { EMAIL_PREVIEW, EMAIL_PREVIEW_SHA } from '../../supabase-poc/email-policy.mjs';

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
// A real 2x2 WebP, not a fake text upload; verifies binary round-trip.
const PHOTO_BYTES = Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAIAAoBCJaACdAFAAAD+5Qr/+N4/yXf277eZTblcAAAA', 'base64');

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
// This API request shares the browser context's cookie jar. The temporary
// share token stays out of navigations, screenshots, traces and diagnostics.
async function newBrowserContext(browser, options) {
  const context = await browser.newContext(options);
  if (process.env.MOSAIC_CORE_PREVIEW_SHA) {
    try {
      const response = await context.request.get(process.env.MOSAIC_CORE_PREVIEW_SHARE_URL,
        { timeout: 20_000, maxRedirects: 5 });
      if (!response.ok() || !(await context.cookies(EMAIL_PREVIEW)).length)
        throw new Error('Preview access denied');
    } catch {
      await context.close();
      throw new Error('Protected immutable Preview access failed before browser login');
    }
  }
  return context;
}
async function signIn(page, owner) {
  await page.goto(app + '/login');
  if (process.env.MOSAIC_CORE_PREVIEW_SHA) {
    expect(new URL(page.url()).origin).toBe(EMAIL_PREVIEW);
    expect(process.env.MOSAIC_CORE_PREVIEW_SHA).toBe(EMAIL_PREVIEW_SHA);
    const identity = JSON.parse(await page.locator('meta[name="mosaic-build-info"]').getAttribute('content'));
    expect(identity.commit).toBe(process.env.MOSAIC_CORE_PREVIEW_SHA);
    expect(identity.channel).toBe('Preview');
    expect(identity.backend).toBe('supabase-cloud');
    expect(identity.featureProfile).toBe('core-diary');
  }
  await page.getByLabel('Email Address').fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  const accountStart = page.getByRole('heading', { name: 'Start your Mosaic account', exact: true });
  await expect(accountStart.or(page.getByRole('tab', { name: 'Calendar', exact: true })))
    .toBeVisible({ timeout: 30_000 });
  if (await accountStart.isVisible()) {
    await expect(page.getByRole('button', { name: 'Continue with new data' })).toBeDisabled();
    await page.getByRole('radio', { name: 'I am starting a new Mosaic account.' }).check();
    await page.getByRole('button', { name: 'Continue with new data' }).click();
  }
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
  const contexts = await Promise.all([0, 1, 2].map(() => newBrowserContext(browser, { ignoreHTTPSErrors: !hosted })));
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
    await first.getByRole('button', { name: 'Categories', exact: true }).click();
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
    await first.getByRole('button', { name: 'Categories', exact: true }).click();
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
    await second.getByRole('button', { name: 'Categories', exact: true }).click();
    await expect(second.getByRole('listitem').filter({ hasText: 'Second core list' }))
      .toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => {
      const labels = await second.getByRole('listitem').allTextContents();
      return labels.findIndex(text => text.includes('Second core list')) <
        labels.findIndex(text => text.includes('Core private list'));
    }, { timeout: 20_000 }).toBe(true);
    await contexts[0].setOffline(true);
    await originalCategory.getByRole('button', { name: 'Delete category', exact: true }).click();
    await first.getByRole('textbox', { name: 'Type Core private list to confirm' }).fill('Core private list');
    await first.getByRole('button', { name: 'Delete category and tasks', exact: true }).click();
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

test('signed two-session category retirement preserves history, then deletion atomically tombstones every task', async () => {
  test.skip(hosted, 'Requires the disposable local atomic category migration and synthetic users');
  const owner = await account();
  const foreign = await account();
  const otherGrant = await api('/auth/v1/token?grant_type=password', null,
    { email: owner.email, password: owner.password });
  expect(otherGrant.ok).toBe(true);
  const secondToken = (await otherGrant.json()).access_token;

  // These are REAL independent signed GoTrue sessions; both must hold a
  // server-issued owner lease. No synthetic claims or service-role bypass.
  for (const token of [owner.token, secondToken]) {
    const lease = await api('/rest/v1/rpc/mosaic_core_session', token, { p_action: 'acquire' });
    expect(lease.ok).toBe(true);
  }
  const categoryId = 'cat_' + randomBytes(8).toString('hex');
  const taskId = 'task_' + randomBytes(8).toString('hex');
  const lateId = 'late_' + randomBytes(8).toString('hex');
  const now = new Date().toISOString();
  const addCategory = await api('/rest/v1/mosaic_candidate_categories', owner.token, {
    owner_id: owner.id, id: categoryId, name: 'History preserved',
    color: '#123456', order_index: 0, visibility: 'private',
    updated_at: now, retired_on: '', is_deleted: false,
  });
  expect(addCategory.ok).toBe(true);
  let category = (await addCategory.json())[0];
  const taskBody = id => ({
    owner_id: owner.id, id, title: 'History-bound task ' + id,
    category_id: categoryId, order_index: 0, task_date: now.slice(0, 10),
    completed: false, created_at: now, updated_at: now, is_deleted: false,
  });
  const initialInsert = await api('/rest/v1/mosaic_candidate_tasks', owner.token, taskBody(taskId));
  expect(initialInsert.ok).toBe(true);

  // The reversible operation MUST NOT delete or move any task.
  const retired = await api('/rest/v1/rpc/mosaic_candidate_cas_category', owner.token, {
    p_id: categoryId, p_expected_seq: category.change_seq,
    p_patch: { retired_on: '2026-10-21', updated_at: new Date().toISOString() },
  });
  expect(retired.ok).toBe(true);
  category = await retired.json();
  expect(category.retired_on).toBe('2026-10-21');
  expect(category.is_deleted).toBe(false);
  const historyBeforeDelete = (await rows(owner, 'tasks')).find(task => task.id === taskId);
  expect(historyBeforeDelete.category_id).toBe(categoryId);
  expect(historyBeforeDelete.is_deleted).toBe(false);

  // A different signed device races a task insert against destructive
  // category CAS. It may commit before deletion or be rejected afterwards;
  // either way NO task may remain live in a deleted category.
  const [concurrentInsert, deletion] = await Promise.all([
    api('/rest/v1/mosaic_candidate_tasks', secondToken, taskBody(lateId)),
    api('/rest/v1/rpc/mosaic_candidate_cas_category', owner.token, {
      p_id: categoryId, p_expected_seq: category.change_seq,
      p_patch: { is_deleted: true, updated_at: new Date().toISOString() },
    }),
  ]);
  expect(deletion.ok).toBe(true);
  expect((await deletion.json()).is_deleted).toBe(true);
  if (!concurrentInsert.ok) expect([400, 409]).toContain(concurrentInsert.status);
  const allTasks = (await rows(owner, 'tasks')).filter(task => task.category_id === categoryId);
  expect(allTasks.some(task => !task.is_deleted)).toBe(false);
  expect(allTasks.find(task => task.id === taskId)?.is_deleted).toBe(true);
  if (concurrentInsert.ok) {
    expect(allTasks.find(task => task.id === lateId)?.is_deleted).toBe(true);
  }
  const categoryAfter = (await rows(owner, 'categories')).find(row => row.id === categoryId);
  expect(categoryAfter.is_deleted).toBe(true);

  const impossibleInsert = await api('/rest/v1/mosaic_candidate_tasks', secondToken,
    taskBody('rejected_' + randomBytes(8).toString('hex')));
  expect(impossibleInsert.ok).toBe(false);
  const resurrection = await api('/rest/v1/rpc/mosaic_candidate_cas_category', owner.token, {
    p_id: categoryId, p_expected_seq: categoryAfter.change_seq,
    p_patch: { is_deleted: false },
  });
  expect(resurrection.ok).toBe(false);
  expect((await rows(owner, 'categories')).find(row => row.id === categoryId).is_deleted).toBe(true);
  const foreignRead = await api(
    '/rest/v1/mosaic_candidate_tasks?select=*&category_id=eq.' + categoryId, foreign.token);
  expect(foreignRead.ok).toBe(true);
  expect(await foreignRead.json()).toEqual([]);
});


test('signed private Diary: independent owners, exact CAS, protected fields, tombstones', async () => {
  test.skip(hosted, 'Only the disposable local Supabase lab has the private Diary migration');
  const owner = await account();
  const stranger = await account();
  // Owner writes must be fenced until a signed server authority lease exists.
  const unleased = await api('/rest/v1/mosaic_candidate_diary', owner.token, {
    owner_id: owner.id, id: 'unleased_' + randomBytes(8).toString('hex'),
    entry_date: '2026-10-23', content: 'Forbidden before lease',
    visibility: 'private', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  expect(unleased.status).toBe(403);
  const signed = await api('/rest/v1/rpc/mosaic_core_session', owner.token,
    { p_action: 'acquire' });
  expect(signed.ok).toBe(true);
  const secondLease = await api('/rest/v1/rpc/mosaic_core_session', stranger.token,
    { p_action: 'acquire' });
  expect(secondLease.ok).toBe(true);

  const id = 'diary_' + randomBytes(8).toString('hex');
  const date = '2026-10-22';
  const now = new Date().toISOString();
  const data = {
    owner_id: owner.id, id, entry_date: date,
    content: 'My private disposable entry', emoji: '🌙', photos: '[]',
    visibility: 'private', created_at: now, updated_at: now, is_deleted: false,
  };
  const created = await api('/rest/v1/mosaic_candidate_diary', owner.token, data);
  expect(created.ok).toBe(true);
  const first = (await created.json())[0];
  expect(first.id).toBe(id);
  expect(first.entry_date).toBe(date);
  expect(first.visibility).toBe('private');
  expect(first.owner_id).toBe(owner.id);
  expect(first.change_seq).toBeTruthy();

  // RLS is enforced by real GoTrue user A/B JWTs. Neither the anon role
  // nor the other owner may discover the entry or impersonate its owner.
  const foreignRead = await api('/rest/v1/mosaic_candidate_diary?select=*&id=eq.' + id,
    stranger.token);
  expect(foreignRead.ok).toBe(true);
  expect(await foreignRead.json()).toEqual([]);
  const anonymousRead = await api('/rest/v1/mosaic_candidate_diary?select=*&id=eq.' + id, null);
  if (anonymousRead.ok) expect(await anonymousRead.json()).toEqual([]);
  const forgedInsert = await api('/rest/v1/mosaic_candidate_diary', stranger.token, {
    ...data, id: 'forged_' + randomBytes(8).toString('hex'),
  });
  expect(forgedInsert.ok).toBe(false);
  // Privacy cannot be widened by writing a public Diary row.
  const publicInsert = await api('/rest/v1/mosaic_candidate_diary', owner.token, {
    ...data, id: 'public_' + randomBytes(8).toString('hex'),
    entry_date: '2026-10-23', visibility: 'public',
  });
  expect(publicInsert.ok).toBe(false);
  const directPatch = await api(
    '/rest/v1/mosaic_candidate_diary?id=eq.' + id, owner.token,
    { content: 'Unauthorized direct mutation' }, 'PATCH');
  expect(directPatch.ok).toBe(false);

  // All permitted modifications must advance the owner's server revision.
  const changed = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
    p_id: id, p_expected_seq: first.change_seq,
    p_patch: { content: 'Signed second revision', emoji: '🍃', updated_at: now },
  });
  expect(changed.ok).toBe(true);
  const next = await changed.json();
  expect(next.content).toBe('Signed second revision');
  expect(next.emoji).toBe('🍃');
  expect(next.entry_date).toBe(date);
  expect(BigInt(next.change_seq) > BigInt(first.change_seq)).toBe(true);

  const forbiddenPatch = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
    p_id: id, p_expected_seq: next.change_seq, p_patch: { visibility: 'public' },
  });
  expect(forbiddenPatch.ok).toBe(false);
  // Owner-private photo references may be edited ONLY by signed exact-revision CAS.
  const signedPhotos = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
    p_id: id, p_expected_seq: next.change_seq,
    p_patch: { photos: '["img_private"]', updated_at: now },
  });
  expect(signedPhotos.ok).toBe(true);
  const photoRevision = await signedPhotos.json();
  expect(photoRevision.photos).toBe('["img_private"]');
  expect(BigInt(photoRevision.change_seq)).toBeGreaterThan(BigInt(next.change_seq));
  const foreignCas = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', stranger.token, {
    p_id: id, p_expected_seq: photoRevision.change_seq, p_patch: { content: 'Foreign overwrite' },
  });
  expect(foreignCas.ok).toBe(true);
  const hidden = await foreignCas.json();
  expect(hidden === null || (hidden.owner_id === null && hidden.id === null)).toBe(true);

  const stale = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
    p_id: id, p_expected_seq: first.change_seq, p_patch: { content: 'Stale overwrite' },
  });
  expect(stale.ok).toBe(true);
  const conflict = await stale.json();
  expect(conflict === null || (conflict.owner_id === null && conflict.id === null)).toBe(true);

  // Two simultaneous signed writes to the same revision are serializable:
  // exactly one wins, the other returns PostgREST's nullable composite result.
  const races = await Promise.all(['Device A', 'Device B'].map(content =>
    api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
      p_id: id, p_expected_seq: photoRevision.change_seq, p_patch: { content, updated_at: now },
    })));
  expect(races.every(response => response.ok)).toBe(true);
  const raceResults = await Promise.all(races.map(response => response.json()));
  const winners = raceResults.filter(value => value?.owner_id === owner.id);
  expect(winners).toHaveLength(1);
  expect(raceResults.filter(value => value === null ||
    (value.owner_id === null && value.id === null))).toHaveLength(1);
  const winner = winners[0];
  expect(['Device A', 'Device B']).toContain(winner.content);
  expect(BigInt(winner.change_seq)).toBeGreaterThan(BigInt(photoRevision.change_seq));
  const duplicateDate = await api('/rest/v1/mosaic_candidate_diary', owner.token, {
    ...data, id: 'diary_' + randomBytes(8).toString('hex'),
    content: 'Duplicate day denied',
  });
  expect(duplicateDate.status).toBe(409);

  const tombstone = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
    p_id: id, p_expected_seq: winner.change_seq,
    p_patch: { is_deleted: true, updated_at: new Date().toISOString() },
  });
  expect(tombstone.ok).toBe(true);
  const removed = await tombstone.json();
  expect(removed.is_deleted).toBe(true);
  expect(removed.entry_date).toBe(date);
  const ownerRows = await rows(owner, 'diary');
  expect(ownerRows.find(record => record.id === id)?.is_deleted).toBe(true);
  expect((await rows(stranger, 'diary')).some(record => record.id === id)).toBe(false);
  const released = await api('/rest/v1/rpc/mosaic_core_session', owner.token,
    { p_action: 'release' });
  expect(released.ok).toBe(true);
  const afterRelease = await api('/rest/v1/rpc/mosaic_candidate_cas_diary', owner.token, {
    p_id: id, p_expected_seq: removed.change_seq,
    p_patch: { is_deleted: false },
  });
  expect(afterRelease.status).toBe(403);
});

test('offline cold start: durable edits, simultaneous tab rotation and logout isolation', async ({ browser }) => {
  const owner = await account();
  const other = await account();
  const context = await newBrowserContext(browser, { ignoreHTTPSErrors: !hosted });
  const secondDevice = await newBrowserContext(browser, { ignoreHTTPSErrors: !hosted });
  const refreshStatuses = [];
  try {
    const first = await context.newPage();
    context.on('response', response => {
      if (response.url().includes('/auth/v1/token?grant_type=refresh_token'))
        refreshStatuses.push(response.status());
    });
    await signIn(first, owner);
    await first.getByRole('button', { name: 'Open menu' }).click();
    await first.getByRole('button', { name: 'Categories', exact: true }).click();
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Offline restart list');
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).length).toBe(1);
    await first.keyboard.press('Escape');
    await first.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await first.getByRole('button', { name: 'Add a task to Offline restart list', exact: true }).first().click();
    const input = first.getByPlaceholder('Add a task to Offline restart list...').first();
    await input.fill('Retained across offline restart');
    await input.press('Enter');
    await expect.poll(async () => (await rows(owner, 'tasks')).length).toBe(1);
    await first.getByRole('button', { name: 'Online', exact: true }).click();
    await expect(first.getByText('Up to date', { exact: true })).toBeVisible();
    await first.keyboard.press('Escape');
    await first.evaluate(() => navigator.serviceWorker.ready);
    // Mosaic intentionally never force-claims the page that installed its
    // service worker. A normal online navigation activates the cached shell.
    await first.reload();
    await expect.poll(() => first.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect(first.getByRole('button', { name: 'Online', exact: true })).toBeVisible();

    await context.setOffline(true);
    await first.reload();
    await first.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Retained across offline restart', exact: true }).first())
      .toBeVisible();
    await first.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
    await expect(first.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    await first.reload();
    await first.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    expect((await rows(owner, 'tasks'))[0].completed).toBe(false);
    await context.setOffline(false);
    await first.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await rows(owner, 'tasks'))[0]?.completed,
      { timeout: 45_000 }).toBe(true);

    const remote = await secondDevice.newPage();
    await signIn(remote, owner);
    await remote.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(remote.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();

    // Same-context tabs share localStorage, IndexedDB and a rotating GoTrue
    // family. Separate contexts above represent independent device sessions.
    const sibling = await context.newPage();
    const before = refreshStatuses.length;
    await Promise.all([first.reload(), sibling.goto(app + '/home')]);
    for (const page of [first, sibling])
      await expect(page.getByRole('tab', { name: 'Calendar', exact: true })).toBeVisible();
    await expect.poll(() => refreshStatuses.length).toBeGreaterThanOrEqual(before + 2);
    expect(refreshStatuses.every(status => status === 200)).toBe(true);
    await sibling.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(sibling.getByRole('button', { name: 'Retained across offline restart', exact: true }).first())
      .toBeVisible();
    await expect(sibling.getByRole('button', { name: 'Online', exact: true })).toBeVisible();
    await sibling.getByRole('button', { name: 'Mark incomplete', exact: true }).first().click();
    await expect.poll(async () => (await rows(owner, 'tasks'))[0]?.completed,
      { timeout: 45_000 }).toBe(false);
    await remote.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(remote.getByRole('button', { name: 'Mark complete', exact: true }).first()).toBeVisible();
    // Closing the tab that authenticated must not revoke the shared family.
    await first.close();
    await sibling.reload();
    await sibling.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(sibling.getByRole('button', { name: 'Retained across offline restart', exact: true }).first())
      .toBeVisible();

    const stale = await context.newPage();
    await stale.goto(app + '/home');
    await expect(stale.getByRole('tab', { name: 'Calendar', exact: true })).toBeVisible();
    // Wait for signed recovery, not just the immediately available cached UI.
    await expect(sibling.getByRole('button', { name: 'Online', exact: true })).toBeVisible();
    await sibling.getByRole('button', { name: 'Me', exact: true }).click();
    await sibling.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(sibling.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible();
    await sibling.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await expect(sibling.getByLabel('Email Address')).toBeVisible();
    await expect(stale.getByLabel('Email Address')).toBeVisible();
    await stale.reload();
    await expect(stale.getByLabel('Email Address')).toBeVisible();
    await signIn(sibling, other);
    await sibling.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(sibling.getByRole('button', { name: 'Retained across offline restart', exact: true })).toHaveCount(0);
    expect(await rows(other, 'tasks')).toEqual([]);
    // Browser-family logout must not revoke an independent device's session.
    await remote.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(remote.getByRole('button', { name: 'Retained across offline restart', exact: true }).first())
      .toBeVisible();
    await remote.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
    await expect.poll(async () => (await rows(owner, 'tasks'))[0]?.completed,
      { timeout: 45_000 }).toBe(true);
    expect(refreshStatuses.every(status => status === 200)).toBe(true);
  } catch (error) {
    const views = await Promise.all(context.pages().map(async page => ({
      path: new URL(page.url()).pathname,
      text: (await page.locator('body').innerText().catch(() => '')).slice(0, 2000),
    })));
    let detail = (error instanceof Error ? error.stack : String(error)) +
      '\nRefresh statuses: ' + JSON.stringify(refreshStatuses) + '\nViews: ' + JSON.stringify(views);
    for (const account of [owner, other])
      for (const secret of [account.password, account.token])
        if (secret) detail = detail.replaceAll(secret, '[redacted]');
    throw new Error(detail);
  } finally {
    await Promise.allSettled([context.close(), secondDevice.close()]);
  }
});

test('real expired JWT: offline edits survive a failed refresh and signed retry', async ({ browser }) => {
  test.skip(hosted || process.env.MOSAIC_CORE_SHORT_JWT !== 'true',
    'Requires disposable local Auth with a real 60-second JWT lifetime');
  test.setTimeout(180_000);
  const owner = await account();
  const context = await newBrowserContext(browser, { ignoreHTTPSErrors: true });
  const secondContext = await newBrowserContext(browser, { ignoreHTTPSErrors: true });
  let oldToken;
  const browserTokens = [];
  const responses = {};
  try {
    const page = await context.newPage();
    page.on('response', async response => {
      if (response.url().startsWith(url + '/')) {
        const label = response.request().method() + ' ' + new URL(response.url()).pathname + ' ' + response.status();
        responses[label] = (responses[label] ?? 0) + 1;
      }
      if (response.url().startsWith(url + '/auth/v1/token?') && response.status() === 200) {
        const tokens = await response.json().catch(() => null);
        if (typeof tokens?.access_token === 'string') browserTokens.push(tokens.access_token);
      }
    });
    const login = page.waitForResponse(response =>
      response.url() === url + '/auth/v1/token?grant_type=password' && response.status() === 200);
    await signIn(page, owner);
    const grant = await (await login).json();
    oldToken = grant.access_token;
    expect(grant.expires_in).toBeLessThanOrEqual(60);
    expect((await api('/auth/v1/user', oldToken)).status).toBe(200);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page.getByRole('button', { name: 'Add Category', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Expiry recovery list');
    await page.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).length).toBe(1);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await page.getByRole('button', { name: 'Add a task to Expiry recovery list', exact: true }).first().click();
    await page.getByPlaceholder('Add a task to Expiry recovery list...').first().fill('Preserved offline edit');
    await page.getByPlaceholder('Add a task to Expiry recovery list...').first().press('Enter');
    await expect.poll(async () => (await rows(owner, 'tasks')).length).toBe(1);
    // Establish a fully acknowledged record before testing JWT recovery.
    // Seeing the server insert alone can race its final local push ack and
    // instead exercise an ambiguous create-response conflict.
    await page.getByRole('button', { name: 'Online', exact: true }).click();
    await expect(page.getByText('Up to date', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    expect((await rows(owner, 'tasks'))[0].completed).toBe(false);
    // Actual server time and a previously accepted signed JWT. No fake clock,
    // synthetic JWT or altered global hosted Auth policy.
    await expect.poll(async () => {
      // Include any proactive rotation issued before the tab went offline;
      // proving only the original password grant expired would be weaker.
      const expired = await Promise.all([...new Set([oldToken, ...browserTokens])]
        .map(async token => {
          const response = await api('/auth/v1/user', token);
          if (![401, 403].includes(response.status)) return false;
          const body = await response.json();
          // GoTrue versions differ on status. Require explicit server expiry,
          // not merely any rejected request or a client-decoded exp timestamp.
          return /\bexpired\b/i.test(String(body.msg ?? body.message ?? ''));
        }));
      return expired.every(Boolean);
    }, { timeout: 90_000, intervals: [1000, 5000] }).toBe(true);
    const observer = await api('/auth/v1/token?grant_type=password', null,
      { email: owner.email, password: owner.password });
    expect(observer.ok).toBe(true);
    owner.token = (await observer.json()).access_token;
    let attempts = 0;
    let refreshed = false;
    let allowRefresh = false;
    await page.route(url + '/auth/v1/token?grant_type=refresh_token', async route => {
      attempts++;
      // Browser online/focus events may overlap the explicit reconnect event.
      // Keep the outage in force until its retained-draft assertions complete.
      if (!allowRefresh) await route.abort('failed');
      else await route.continue();
    });
    page.on('response', response => {
      if (response.url() === url + '/auth/v1/token?grant_type=refresh_token' && response.status() === 200)
        refreshed = true;
    });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => attempts).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    expect((await rows(owner, 'tasks'))[0].completed).toBe(false);
    expect(refreshed).toBe(false);
    allowRefresh = true;
    await expect.poll(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      return refreshed;
    }).toBe(true);
    await expect.poll(async () => (await rows(owner, 'tasks'))[0].completed,
      { timeout: 25_000 }).toBe(true);
    const second = await secondContext.newPage();
    await signIn(second, owner);
    await second.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    await expect(second.getByText('Preserved offline edit', { exact: true }).first()).toBeVisible();
  } catch (error) {
    const redacted = [owner.password, owner.token, oldToken, ...browserTokens].reduce((text, secret) =>
      secret ? text.replaceAll(secret, '[redacted]') : text, String(error));
    throw new Error(redacted + '\nSupabase request counts: ' + JSON.stringify(responses));
  } finally {
    await Promise.allSettled([context.close(), secondContext.close()]);
  }
});

test('lost write acknowledgement: preserve offline draft and review changing cloud state', async ({ browser }) => {
  const owner = await account();
  const context = await newBrowserContext(browser, { ignoreHTTPSErrors: !hosted });
  const secondContext = await newBrowserContext(browser, { ignoreHTTPSErrors: !hosted });
  const tokens = [];
  const responses = {};
  let stage = 'sign-in';
  try {
    const page = await context.newPage();
    page.on('response', async response => {
      if (response.url().startsWith(url + '/')) {
        const label = response.request().method() + ' ' + new URL(response.url()).pathname + ' ' + response.status();
        responses[label] = (responses[label] ?? 0) + 1;
      }
      if (response.url().startsWith(url + '/auth/v1/token?') && response.status() === 200) {
        const grant = await response.json().catch(() => null);
        if (grant?.access_token) tokens.push(grant.access_token);
      }
    });
    await signIn(page, owner);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page.getByRole('button', { name: 'Add Category', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Conflict review list');
    await page.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).length).toBe(1);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Todo list', exact: true }).click();
    let lostAck = false;
    let allowReads = false;
    stage = 'lost create acknowledgement';
    await page.route(url + '/rest/v1/mosaic_candidate_tasks**', async route => {
      if (route.request().method() === 'POST' && !lostAck) {
        const response = await route.fetch();
        lostAck = response.ok();
        await route.abort('failed'); // The real server committed, browser never received its acknowledgement.
      } else if (route.request().method() === 'GET' && lostAck && !allowReads) {
        await route.abort('failed'); // Prevent a pull from supplying the missing acknowledgement.
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Add a task to Conflict review list', exact: true }).first().click();
    await page.getByPlaceholder('Add a task to Conflict review list...').first().fill('My preserved draft');
    await page.getByPlaceholder('Add a task to Conflict review list...').first().press('Enter');
    await expect.poll(() => lostAck).toBe(true);
    stage = 'offline edit';
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
    expect((await rows(owner, 'tasks'))[0].completed).toBe(false);
    await expect(page.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    // A dropped response alone can recover safely by retrying the identical
    // create before pushing the newer edit. Make the conflict unambiguous:
    // another signed session changes the cloud row while this device is offline.
    expect((await api('/rest/v1/rpc/mosaic_core_session', owner.token, { p_action: 'acquire' })).ok).toBe(true);
    const offlineMaster = (await rows(owner, 'tasks'))[0];
    const offlineChange = await api('/rest/v1/rpc/mosaic_candidate_cas_task', owner.token, {
      p_id: offlineMaster.id, p_expected_seq: offlineMaster.change_seq,
      p_patch: { title: 'Cloud draft while offline' },
    });
    expect(offlineChange.ok).toBe(true);
    expect((await offlineChange.json()).title).toBe('Cloud draft while offline');
    allowReads = true;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    stage = 'pending review';
    await page.getByRole('button', { name: 'Online', exact: true }).click();
    const review = page.getByRole('region', { name: 'Changes needing review' });
    await expect(review).toBeVisible({ timeout: 25_000 });
    // A native retry may still hold the original create snapshot. Refresh must
    // reconstruct review from the durable offline edit before it can be chosen.
    await review.getByRole('button', { name: 'Refresh comparison' }).click();
    await expect(review.getByRole('row', { name: 'Completed Yes No' })).toBeVisible();
    expect((await rows(owner, 'tasks'))[0].completed).toBe(false);
    // Optional operator screenshots contain only this disposable comparison,
    // never login fields, headers, tokens or a credential-bearing trace.
    const screenshots = process.env.MOSAIC_CORE_REVIEW_SCREENSHOT_DIR;
    if (screenshots) {
      await mkdir(screenshots, { recursive: true });
      const originalTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      try {
        for (const theme of ['light', 'dark', 'black']) {
          await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
          await review.screenshot({ path: join(screenshots, 'conflict-' + theme + '.png') });
        }
      } finally {
        await page.evaluate(value => value === null
          ? document.documentElement.removeAttribute('data-theme')
          : document.documentElement.setAttribute('data-theme', value), originalTheme);
      }
    }
    // Editing while parked must rebuild the comparison from durable current
    // local state, never apply or acknowledge the old queued snapshot.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'My preserved draft', exact: true }).first().dblclick();
    await page.getByLabel('Task title', { exact: true }).fill('My latest draft');
    await page.getByLabel('Task title', { exact: true }).press('Enter');
    stage = 'review of newer local draft';
    await page.getByRole('button', { name: 'Online', exact: true }).click();
    await review.getByRole('button', { name: 'Refresh comparison' }).click();
    await expect(review.getByRole('article', { name: 'Review My latest draft' })).toBeVisible();
    expect((await api('/rest/v1/rpc/mosaic_core_session', owner.token, { p_action: 'acquire' })).ok).toBe(true);
    const original = (await rows(owner, 'tasks'))[0];
    const changed = await api('/rest/v1/rpc/mosaic_candidate_cas_task', owner.token, {
      p_id: original.id, p_expected_seq: original.change_seq, p_patch: { title: 'Cloud changed again' },
    });
    expect(changed.ok).toBe(true);
    expect((await changed.json()).title).toBe('Cloud changed again');
    stage = 'stale cloud choice';
    await review.getByRole('button', { name: 'Keep my version' }).click();
    await expect(review.getByRole('alert')).toBeVisible();
    await expect(review.getByRole('cell', { name: 'Cloud changed again', exact: true })).toBeVisible();
    expect((await rows(owner, 'tasks'))[0].title).toBe('Cloud changed again');
    stage = 'confirmed choice';
    await review.getByRole('button', { name: 'Keep my version' }).click();
    await expect(review).not.toBeVisible({ timeout: 25_000 });
    await expect.poll(async () => {
      const task = (await rows(owner, 'tasks'))[0];
      return task.completed && task.title === 'My latest draft';
    }).toBe(true);
    await page.keyboard.press('Escape');
    stage = 'second-device convergence';
    const second = await secondContext.newPage();
    await signIn(second, owner);
    await second.getByRole('tab', { name: 'Todo list', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Mark incomplete', exact: true }).first()).toBeVisible();
    await expect(second.getByText('My latest draft', { exact: true }).first()).toBeVisible();
  } catch (error) {
    const safe = [owner.password, owner.token, ...tokens].reduce((text, secret) =>
      secret ? text.replaceAll(secret, '[redacted]') : text, String(error));
    throw new Error(stage + ': ' + safe + '\nRequest counts: ' + JSON.stringify(responses));
  } finally {
    await Promise.allSettled([context.close(), secondContext.close()]);
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



test('signed owner Diary UI @diary-ui: create a private entry, recover on another device, deny foreign access', async ({ browser }) => {
  test.skip(hosted || process.env.MOSAIC_CORE_DIARY_UI_LAB !== 'true',
    'Only the disposable local signed core-diary browser lab may exercise this UI');
  const owner = await account();
  const foreign = await account();
  const contexts = await Promise.all([0, 1, 2].map(() =>
    newBrowserContext(browser, { ignoreHTTPSErrors: true })));
  const content = 'Private diary UI fixture ' + randomBytes(5).toString('hex');
  try {
    const [first, second, other] = await Promise.all(contexts.map(x => x.newPage()));
    await signIn(first, owner);
    await first.getByRole('tab', { name: 'Diary', exact: true }).click();
    await expect(first.getByRole('tab', { name: 'Diary', exact: true })).toHaveAttribute('aria-selected', 'true');
    await first.getByRole('button', { name: 'Add diary entry' }).first().click();
    await expect(first.locator('[data-testid="diary-entry-sheet"]')).toBeVisible();
    await expect(first.getByLabel('Diary visibility', { exact: true })).toContainText('Private diary');
    await expect(first.getByRole('button', { name: /Add photos/i })).toBeVisible();
    await first.getByLabel('Choose diary photos').setInputFiles({
      name: 'signed-diary.webp', mimeType: 'image/webp', buffer: PHOTO_BYTES,
    });
    await expect(first.getByRole('button', { name: 'Add photos (1/5)' })).toBeVisible({ timeout: 15_000 });
    await first.getByLabel('Diary text').fill(content);
    await first.getByRole('button', { name: 'Done', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'diary')).some(row =>
      row.content === content && row.visibility === 'private' && row.is_deleted === false &&
      JSON.parse(row.photos ?? '[]').length === 1),
      { timeout: 25000 }).toBe(true);

    await signIn(second, owner);
    await second.getByRole('tab', { name: 'Diary', exact: true }).click();
    await expect(second.getByText(content, { exact: true }).first()).toBeVisible({ timeout: 25000 });
    // The remote storage URL is authenticated and the second device must
    // independently obtain the attached image bytes, not only its ID.
    await second.getByText(content, { exact: true }).first().click();
    await expect(second.getByRole('button', { name: 'View diary photo' }).first()).toBeEnabled({ timeout: 20_000 });
    await signIn(other, foreign);
    await other.getByRole('tab', { name: 'Diary', exact: true }).click();
    await expect(other.getByText(content, { exact: true })).toHaveCount(0);
    const foreignRows = await api('/rest/v1/mosaic_candidate_diary?select=id,content', foreign.token);
    expect(foreignRows.ok).toBe(true);
    expect(await foreignRows.json()).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map(c => c.close()));
  }
});

test('six-domain lifecycle @personal-ui: preferences, Bucket links, offline edits and account switch', async ({ browser }) => {
  test.skip(hosted || process.env.MOSAIC_PERSONAL_UI_LAB !== 'true', 'Disposable signed personal UI only');
  const owner = await account(), foreign = await account();
  const contexts = await Promise.all([0, 1].map(() => newBrowserContext(browser, { ignoreHTTPSErrors: true })));
  try {
    const [first, second] = await Promise.all(contexts.map(c => c.newPage()));
    await signIn(first, owner);
    await first.getByRole('button', { name: 'Open menu' }).click();
    await first.getByRole('button', { name: 'Categories', exact: true }).click();
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Dream steps');
    await first.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'categories')).some(x => x.name === 'Dream steps')).toBe(true);
    await first.goto(app + '/bucket-list');
    await first.getByRole('button', { name: 'Add aspiration', exact: true }).click();
    await first.getByLabel('What would you love to do?').fill('Visit the mountains');
    await first.getByRole('button', { name: 'Add to my Bucket List' }).click();
    await first.getByRole('button', { name: 'Visit the mountains', exact: true }).click();
    await first.getByRole('button', { name: 'New task', exact: true }).click();
    await first.getByLabel('Task', { exact: true }).fill('Pack hiking boots');
    await first.getByLabel('Category', { exact: true }).selectOption({ label: 'Dream steps' });
    await first.getByRole('button', { name: 'Create and link task' }).click();
    await expect.poll(async () => (await rows(owner, 'bucket_task_links')).filter(x => !x.is_deleted).length,
      { timeout: 30000 }).toBe(1);
    const goal = (await rows(owner, 'buckets')).find(x => x.title === 'Visit the mountains');
    expect(goal).toBeTruthy();
    await signIn(second, owner);
    await second.goto(app + '/bucket-list/' + goal.id);
    await expect(second.getByRole('button', { name: 'Unlink Pack hiking boots' })).toBeVisible({ timeout: 25000 });
    await contexts[0].setOffline(true);
    await first.getByRole('button', { name: 'Edit aspiration' }).click();
    await first.getByLabel('Your dream').fill('Visit the mountains offline');
    await first.getByRole('button', { name: 'Save changes', exact: true }).click();
    expect((await rows(owner, 'buckets')).find(x => x.id === goal.id).title).toBe('Visit the mountains');
    await contexts[0].setOffline(false);
    await first.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await rows(owner, 'buckets')).find(x => x.id === goal.id)?.title,
      { timeout: 25000 }).toBe('Visit the mountains offline');
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(second.getByRole('heading', { name: 'Visit the mountains offline', exact: true })).toBeVisible();
    await first.goto(app + '/settings/preferences');
    await first.getByRole('switch', { name: 'Show task creation time' }).click();
    await expect.poll(async () => (await rows(owner, 'settings')).find(x => x.setting_key === 'showTaskCreatedTime')?.setting_value,
      { timeout: 25000 }).toBe('true');
    await second.goto(app + '/settings/preferences');
    await expect(second.getByRole('switch', { name: 'Show task creation time' })).toHaveAttribute('aria-checked', 'true');
    await first.goto(app + '/bucket-list/' + goal.id);
    await first.getByRole('button', { name: 'Unlink Pack hiking boots' }).click();
    await expect.poll(async () => (await rows(owner, 'bucket_task_links'))[0]?.is_deleted).toBe(true);
    expect((await rows(owner, 'tasks')).find(x => x.title === 'Pack hiking boots')?.is_deleted).toBe(false);
    await first.getByRole('button', { name: 'I lived it', exact: true }).click();
    await expect.poll(async () => (await rows(owner, 'buckets')).find(x => x.id === goal.id)?.achieved).toBe(true);
    await first.goto(app + '/settings');
    await first.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await expect(first.getByLabel('Email Address')).toBeVisible();
    await signIn(first, foreign);
    await first.goto(app + '/bucket-list');
    await expect(first.getByText('Visit the mountains offline', { exact: true })).toHaveCount(0);
    await first.goto(app + '/settings/preferences');
    await expect(first.getByRole('switch', { name: 'Show task creation time' })).toHaveAttribute('aria-checked', 'false');
    for (const domain of ['tasks', 'categories', 'diary', 'settings', 'buckets', 'bucket_task_links'])
      expect(await rows(foreign, domain)).toEqual([]);
  } finally { await Promise.allSettled(contexts.map(c => c.close())); }
});

test('signed private Storage @photo-storage: owner-only upload/read/delete, immutable bytes and no public access', async () => {
  test.skip(hosted || process.env.MOSAIC_CORE_DIARY_UI_LAB !== 'true',
    'Only local disposable Supabase Storage may exercise owner-private object permissions');
  const owner = await account();
  const foreign = await account();
  const fileId = 'img_' + randomBytes(12).toString('hex');
  const resource = '/storage/v1/object/mosaic-personal-photos/' + owner.id + '/' + fileId + '.webp';
  const authenticated = '/storage/v1/object/authenticated/mosaic-personal-photos/' + owner.id + '/' + fileId + '.webp';
  const photo = (path, token, method = 'GET', blob) =>
    fetch(url + path, {
      method, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(blob ? { 'Content-Type': 'image/webp', 'x-upsert': 'false' } : {}),
      },
      ...(blob ? { body: blob } : {}),
    });
  const authOwner = await photo(resource, owner.token, 'POST', PHOTO_BYTES);
  expect(authOwner.ok).toBe(true);
  const downloaded = await photo(authenticated, owner.token);
  expect(downloaded.status).toBe(200);
  expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(PHOTO_BYTES);

  const publicRead = await photo(authenticated.replace('/authenticated/', '/public/'), null);
  expect(publicRead.ok).toBe(false);
  const anonymousRead = await photo(authenticated, null);
  expect(anonymousRead.ok).toBe(false);
  const foreignRead = await photo(authenticated, foreign.token);
  expect(foreignRead.ok).toBe(false);
  const foreignCreate = await photo(resource, foreign.token, 'POST', PHOTO_BYTES);
  expect(foreignCreate.ok).toBe(false);
  const foreignDelete = await photo(resource, foreign.token, 'DELETE');
  expect(foreignDelete.ok).toBe(false);
  const anonCreate = await photo(resource, null, 'POST', PHOTO_BYTES);
  expect(anonCreate.ok).toBe(false);
  const duplicate = await photo(resource, owner.token, 'POST', PHOTO_BYTES);
  expect(duplicate.ok).toBe(false); // No overwrite/upsert, even by owner.
  expect(Buffer.from(await (await photo(authenticated, owner.token)).arrayBuffer())).toEqual(PHOTO_BYTES);
  const ownerDelete = await photo(resource, owner.token, 'DELETE');
  expect(ownerDelete.ok).toBe(true);
  expect((await photo(authenticated, owner.token)).ok).toBe(false);
});

// Hosted generated email grants exercise real GoTrue verification without
// sending mail to uncontrolled recipients. SMTP delivery is a separate gate.
for (const kind of ['signup', 'recovery']) {
  test(`signed email ${kind === 'signup' ? 'confirmation' : 'recovery'} preserves the active account`, async ({ browser }) => {
    const action = JSON.parse(process.env.MOSAIC_CORE_EMAIL_ACTION ?? 'null');
    test.skip(!hosted || !action || action.kind !== kind, 'Requires runner-owned one-time email grant');
    const [active, target] = hostedAccounts;
    if (!active || !target || !/^[a-f0-9]{32,128}$/i.test(action.tokenHash ?? '') ||
        !/^\d{6,10}$/.test(action.code ?? '') ||
        !/^mosaic-hosted-[0-9a-f]{24}-email-a@example\.org$/.test(active.email) ||
        target.email !== active.email.replace('-email-a@', '-email-b@'))
      throw Error('Invalid disposable email fixtures');
    const context = await newBrowserContext(browser, { ignoreHTTPSErrors: false });
    const separate = await newBrowserContext(browser, { ignoreHTTPSErrors: false });
    try {
      const appPage = await context.newPage();
      await signIn(appPage, active);
      const browserFamily = () => appPage.evaluate(origin => {
        const record = JSON.parse(localStorage.getItem('mosaic_supabase_browser_v1:' + origin) ?? 'null');
        return record ? { family: record.family, owner: record.cache?.legacyUserId } : null;
      }, url);
      const before = await browserFamily();
      expect(Boolean(before?.family && before?.owner)).toBe(true);
      const emailPage = await context.newPage();
      let leaked = false;
      let writerRequest = false;
      emailPage.on('request', request => {
        const address = new URL(request.url());
        if (request.url().includes(action.tokenHash) || (request.headers().referer ?? '').includes(action.tokenHash) ||
            [...address.searchParams.values()].some(value => value === action.code)) leaked = true;
        if (request.url().startsWith(url + '/rest/') || /appwrite\.(io|invalid)/.test(request.url())) writerRequest = true;
      });
      emailPage.on('console', message => { if (message.text().includes(action.tokenHash) || message.text().includes(action.code)) leaked = true; });
      const route = kind === 'signup' ? '/auth/confirm' : '/reset-password';
      await emailPage.goto(app + route);
      await emailPage.getByLabel('Email address', { exact: true }).fill(target.email);
      await emailPage.getByLabel('Email code', { exact: true }).fill(action.code);
      expect(new URL(emailPage.url()).hash === '').toBe(true);
      expect(new URL(emailPage.url()).search === '').toBe(true);
      await emailPage.getByRole('button', { name: 'Verify email code' }).click();
      await expect(emailPage.getByRole('status')).toContainText(target.email);
      if (kind === 'recovery') {
        await emailPage.getByLabel('New password', { exact: true }).fill(action.newPassword);
        await emailPage.getByLabel('Confirm new password', { exact: true }).fill(action.newPassword);
        await emailPage.getByRole('button', { name: 'Reset password', exact: true }).click();
        await expect(emailPage.getByRole('status')).toContainText('password has been reset successfully');
        const oldGrant = await api('/auth/v1/token?grant_type=password', null, { email: target.email, password: target.password });
        expect(oldGrant.ok).toBe(false);
      } else {
        await emailPage.getByRole('button', { name: 'Finish confirmation' }).click();
        await expect(emailPage.getByRole('status')).toContainText('Your email is confirmed');
      }
      expect(await browserFamily()).toEqual(before);
      expect(writerRequest).toBe(false);
      expect(leaked).toBe(false);
      await appPage.reload();
      await expect(appPage.getByRole('tab', { name: 'Calendar', exact: true })).toBeVisible({ timeout: 30_000 });
      expect((await browserFamily())?.owner).toBe(before.owner);
      const recovered = await separate.newPage();
      await signIn(recovered, { ...target, password: kind === 'recovery' ? action.newPassword : target.password });
      await emailPage.goto(app + route);
      await emailPage.getByLabel('Email address', { exact: true }).fill(target.email);
      await emailPage.getByLabel('Email code', { exact: true }).fill(action.code);
      await emailPage.getByRole('button', { name: 'Verify email code' }).click();
      await expect(emailPage.getByRole('alert')).toContainText('could not be confirmed');
      expect(writerRequest).toBe(false);
    } finally {
      await Promise.all([context.close(), separate.close()]);
    }
  });
}
