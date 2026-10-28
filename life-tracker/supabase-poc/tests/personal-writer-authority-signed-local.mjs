/** Real GoTrue/REST/Storage proof; never accepts a hosted target or admin token. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
const mode = process.argv[2];
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(base, 'http://127.0.0.1:54321');
assert.ok(key?.startsWith('sb_publishable_'));
assert.ok(['blocked', 'ready'].includes(mode));
const id = randomBytes(7).toString('hex');
const email = 'writer-' + id + '@example.org', password = 'Aa!9' + randomBytes(24).toString('hex');
let token;
async function request(path, body, method = body === undefined ? 'GET' : 'POST', blob) {
  const response = await fetch(base + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, ...(token ? { Authorization: 'Bearer ' + token } : {}),
      'Content-Type': blob ? 'image/webp' : 'application/json', Prefer: 'return=representation' },
    ...(body === undefined && !blob ? {} : { body: blob ?? JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
function good(response) {
  assert.ok(response.status >= 200 && response.status < 300, 'Signed request HTTP ' + response.status);
  return response.body;
}
async function rpc(name, body) { return request('/rest/v1/rpc/' + name, body); }
good(await request('/auth/v1/signup', { email, password }));
const signed = good(await request('/auth/v1/token?grant_type=password', { email, password }));
token = signed.access_token;
const owner = signed.user.id;
good(await rpc('mosaic_core_session', { p_action: 'acquire' }));
const now = '2026-10-27T18:00:00Z';
const common = { owner_id: owner, updated_at: now, is_deleted: false };
const category = 'cat_' + id, task = 'task_' + id, bucket = 'bucket_' + id;
const cases = [
  ['categories', 'category', { ...common, id: category, name: 'private', color: '#888888', order_index: 0 }],
  ['tasks', 'task', { ...common, id: task, title: 'private', category_id: category, task_date: '', created_at: now, order_index: 0, completed: false }],
  ['diary', 'diary', { ...common, id: 'diary_' + id, entry_date: '2026-10-27', content: 'private', created_at: now }],
  ['settings', 'setting', { ...common, id: 'setting_' + id, setting_key: 'calendarZoomDays', setting_value: '7' }],
  ['buckets', 'bucket', { ...common, id: bucket, title: 'private', description: '', achieved: false, achieved_at: '', created_at: now }],
  ['bucket_task_links', 'bucket_link', { ...common, id: 'link_' + id, bucket_list_id: bucket, task_id: task, created_at: now }],
];
const photo = '/storage/v1/object/mosaic-personal-photos/' + owner + '/img_' + id + '.webp';
const bytes = Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAIAAoBCJaACdAFAAAD+5Qr/+N4/yXf277eZTblcAAAA', 'base64');
async function deniedWrites(reason) {
  for (const [table, , row] of cases) {
    const result = await request('/rest/v1/mosaic_candidate_' + table, row);
    assert.equal(result.status, 403, reason + ': ' + table);
    assert.deepEqual(good(await request('/rest/v1/mosaic_candidate_' + table + '?select=id')), []);
  }
  const result = await request(photo, undefined, 'POST', bytes);
  assert.ok(result.status === 403 || (result.status === 400 && String(result.body?.statusCode) === '403'),
    reason + ': Storage upload must be denied by authority, not MIME validation');
}
await deniedWrites('unconfirmed owner with valid lease');
good(await rpc('mosaic_account_status', { p_start_mode: 'recovery-pending' }));
if (mode === 'blocked') {
  await deniedWrites('consented owner without released installation');
  console.log('PERSONAL_WRITER_RELEASE_AND_CONSENT_DENIAL_PASS');
} else {
  const saved = [];
  for (const [table, rpcName, row] of cases) {
    const created = good(await request('/rest/v1/mosaic_candidate_' + table, row))[0];
    const updated = good(await rpc('mosaic_candidate_cas_' + rpcName, {
      p_id: row.id, p_expected_seq: String(created.change_seq), p_patch: { updated_at: now },
    }));
    assert.equal(updated.id, row.id);
    saved.push([table, rpcName, updated]);
  }
  good(await request(photo, undefined, 'POST', bytes));
  good(await rpc('mosaic_core_session', { p_action: 'release' }));
  for (const [table, rpcName, row] of saved) {
    const denied = await rpc('mosaic_candidate_cas_' + rpcName, {
      p_id: row.id, p_expected_seq: String(row.change_seq), p_patch: { is_deleted: true, updated_at: now },
    });
    assert.equal(denied.status, 403, table + ': released writer changed row');
    const current = good(await request('/rest/v1/mosaic_candidate_' + table + '?select=*'))[0];
    assert.equal(current.is_deleted, false);
    assert.equal(String(current.change_seq), String(row.change_seq));
  }
  // Storage DELETE may report an empty successful selection under RLS. The
  // decisive assertion is that exact private bytes remain readable afterwards.
  await request(photo, undefined, 'DELETE');
  const read = await fetch(base + photo.replace('/object/', '/object/authenticated/'), {
    headers: { apikey: key, Authorization: 'Bearer ' + token }, redirect: 'error',
  });
  assert.equal(read.status, 200);
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), bytes);
  console.log('PERSONAL_WRITER_SIX_DOMAIN_CAS_AND_STORAGE_FENCE_PASS');
}
