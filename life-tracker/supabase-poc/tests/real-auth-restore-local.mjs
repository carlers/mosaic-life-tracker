#!/usr/bin/env node
// #1027: disposable local Supabase Auth recovery only. NEVER hosted.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.env.MOSAIC_AUTH_LAB_URL;
const key = process.env.MOSAIC_AUTH_LAB_PUBLISHABLE_KEY;
const file = process.env.MOSAIC_AUTH_LAB_FIXTURE;
const mode = process.argv[2];
const check = (ok, message) => { if (!ok) throw Error(message); };
check(process.env.GITHUB_ACTIONS === 'true' &&
  process.env.MOSAIC_REAL_AUTH_RECOVERY_LAB === '1' &&
  base === 'http://127.0.0.1:54321' &&
  typeof key === 'string' && key.length > 15 &&
  file?.startsWith('/home/runner/work/_temp/') &&
  ['seed','verify'].includes(mode), 'Disposable local Supabase runner only');

async function call(path, { token, data, method = data ? 'POST' : 'GET' } = {}) {
  let response;
  try {
    response = await fetch(base + path, {
      method, redirect: 'error', cache: 'no-store',
      headers: { apikey: key, Authorization: 'Bearer ' + (token || key),
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(path.startsWith('/rest/v1/') ? { Prefer: 'return=representation' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  } catch { throw Error('Local Auth/REST network request failed'); }
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body };
}
const positive = (r, label) => {
  check(r.status >= 200 && r.status < 300, label + ' status ' + r.status);
  return r.body;
};
const secret = () => 'R3covery!' + randomBytes(20).toString('hex');
const signup = async (email, password) =>
  positive(await call('/auth/v1/signup', { data: { email, password } }), 'Local signup');
const login = async (email, password) =>
  positive(await call('/auth/v1/token?grant_type=password', { data: { email, password } }), 'Password re-login');
const acquire = async token =>
  positive(await call('/rest/v1/rpc/mosaic_core_session', {
    token, data: { p_action: 'acquire' },
  }), 'Signed owner lease');

async function run() {
  if (mode === 'seed') {
    const email = 'mosaic-restore-' + randomBytes(8).toString('hex') + '@example.org';
    const password = secret();
    const s = await signup(email, password);
    const userId = s.user?.id;
    const token = s.access_token;
    check(/^[a-f0-9-]{36}$/i.test(userId || '') && typeof token === 'string',
      'Signed local signup did not return user and token');
    const principal = positive(await call('/auth/v1/user', { token }), 'Signed user');
    check(principal.id === userId, 'Initial signed principal mismatch');
    const lease = await acquire(token);
    const canonical = lease.canonicalOwnerId;
    check(canonical === 'sb_' + userId.replaceAll('-', ''), 'Wrong initial canonical owner');
    const now = new Date().toISOString();
    const insertedCategory = positive(await call('/rest/v1/mosaic_candidate_categories?select=id,owner_id,change_seq', {
      token, data: { id: 'cat_restore', owner_id: userId, name: 'Synthetic restore',
        color: '#aaaaaa', order_index: 0 },
    }), 'Signed category insert');
    check(insertedCategory?.length === 1 && insertedCategory[0].owner_id === userId,
      'Signed category insert mismatch');
    const insertedTask = positive(await call('/rest/v1/mosaic_candidate_tasks?select=id,owner_id,change_seq', {
      token, data: { id: 'task_restore', owner_id: userId, title: 'Synthetic recovery',
        category_id: 'cat_restore', order_index: 0, task_date: '2026-10-22',
        created_at: now, updated_at: now },
    }), 'Signed task insert');
    check(insertedTask?.length === 1 && insertedTask[0].owner_id === userId,
      'Signed task insert mismatch');
    await writeFile(file, JSON.stringify({ email, password, userId, canonical, previousToken: token }),
      { mode: 0o600, flag: 'wx' });
    process.stdout.write(JSON.stringify({ stage: 'seed', status: 'PASS', owners: 1 }) + '\n');
    return;
  }
  const { email, password, userId, canonical, previousToken } =
    JSON.parse(await readFile(file, 'utf8'));
  const oldLease = await call('/rest/v1/rpc/mosaic_core_session', {
    token: previousToken, data: { p_action: 'acquire' },
  });
  check(oldLease.status === 401 || oldLease.status === 403,
    'Old signed session unexpectedly gained authority after reset');
  const signed = await login(email, password);
  const token = signed.access_token;
  check(signed.user?.id === userId && token !== previousToken,
    'Recovered password or stable Auth user identity failed');
  const principal = positive(await call('/auth/v1/user', { token }), 'Recovered signed user');
  check(principal.id === userId, 'Recovered JWT owner mismatch');
  const lease = await acquire(token);
  check(lease.canonicalOwnerId === canonical,
    'Restored trusted canonical owner changed');
  const tasks = positive(await call('/rest/v1/mosaic_candidate_tasks?select=id,owner_id,title,category_id,change_seq', {
    token,
  }), 'Read recovered owner tasks');
  const categories = positive(await call('/rest/v1/mosaic_candidate_categories?select=id,owner_id,name,change_seq', {
    token,
  }), 'Read recovered owner categories');
  check(tasks?.length === 1 && tasks[0].id === 'task_restore' &&
    tasks[0].owner_id === userId && tasks[0].category_id === 'cat_restore' &&
    Number(tasks[0].change_seq) > 0, 'Restored task revision or owner corrupted');
  check(categories?.length === 1 && categories[0].id === 'cat_restore' &&
    categories[0].owner_id === userId && Number(categories[0].change_seq) > 0,
  'Restored category revision or owner corrupted');
  const emailB = 'mosaic-restore-foreign-' + randomBytes(6).toString('hex') + '@example.org';
  const other = await signup(emailB, secret());
  check(other.user?.id !== userId && typeof other.access_token === 'string',
    'Distinct signed foreign account required');
  await acquire(other.access_token);
  const foreignTasks = positive(await call('/rest/v1/mosaic_candidate_tasks?select=id', {
    token: other.access_token,
  }), 'Foreign signed task read');
  const foreignCats = positive(await call('/rest/v1/mosaic_candidate_categories?select=id', {
    token: other.access_token,
  }), 'Foreign signed category read');
  check(foreignTasks?.length === 0 && foreignCats?.length === 0,
    'Recovered account data leaked to second signed owner');
  const forged = await call('/rest/v1/mosaic_candidate_tasks', {
    token: other.access_token,
    data: { id: 'forged_restore', owner_id: userId, title: 'Forbidden',
      category_id: 'cat_restore', order_index: 0, task_date: '2026-10-22',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  });
  check(forged.status >= 400, 'Foreign signed owner wrote into recovered account');
  process.stdout.write(JSON.stringify({
    stage: 'verify', status: 'PASS', recoveredOwners: 1,
    newSignedOwnerIsolation: true, restoredTasks: 1, restoredCategories: 1,
    passwordReauthentication: true, previousSessionRejected: true,
  }) + '\n');
}
run().catch(error => {
  process.stderr.write('Disposable real Auth restore test failed: ' + error.message + '\n');
  process.exitCode = 1;
});
