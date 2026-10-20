import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
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
  if (process.env.MOSAIC_CORE_PREVIEW_SHA) {
    expect(new URL(page.url()).origin).toBe('https://mosaic-supabase-core-preview.vercel.app');
    const identity = JSON.parse(await page.locator('meta[name="mosaic-build-info"]').getAttribute('content'));
    expect(identity.commit).toBe(process.env.MOSAIC_CORE_PREVIEW_SHA);
    expect(identity.channel).toBe('Preview');
    expect(identity.backend).toBe('supabase-cloud');
    expect(identity.featureProfile).toBe('core-only');
  }
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

test('real expired JWT: offline edits survive a failed refresh and signed retry', async ({ browser }) => {
  test.skip(hosted || process.env.MOSAIC_CORE_SHORT_JWT !== 'true',
    'Requires disposable local Auth with a real 60-second JWT lifetime');
  test.setTimeout(180_000);
  const owner = await account();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const secondContext = await browser.newContext({ ignoreHTTPSErrors: true });
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
    await page.getByRole('button', { name: 'Lists & Categories' }).click();
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
  const context = await browser.newContext({ ignoreHTTPSErrors: !hosted });
  const secondContext = await browser.newContext({ ignoreHTTPSErrors: !hosted });
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
    await page.getByRole('button', { name: 'Lists & Categories' }).click();
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
