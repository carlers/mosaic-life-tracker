/**
 * Disposable, signed Supabase Auth + PostgREST + RLS + CAS integration test.
 * Local Supabase CLI ONLY. Fail closed against managed project URLs.
 * Users/rows are destroyed with the ephemeral local Supabase stack.
 * No production Mosaic RxDB/Appwrite imports or real user credentials.
 */
import { randomBytes } from 'node:crypto';

const url = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_ANON_KEY;
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url) ||
  !key || typeof key !== 'string') {
  throw new Error('Signed Auth smoke only permits the local Supabase CLI at port 54321');
}

const runId = randomBytes(8).toString('hex');
const counters = {
  verifiedUsers: 0, ownedReads: 0, foreignReads: 0,
  ownerSpoofDenied: 0, directWritesDenied: 0, anonDenied: 0,
  created: 0, duplicateConflicts: 0, casSuccesses: 0,
  staleConflicts: 0, foreignCasConflicts: 0, invalidPatchDenied: 0,
  tombstones: 0, cursorPulls: 0,
};
const tables = {
  tasks: 'mosaic_candidate_tasks',
  categories: 'mosaic_candidate_categories',
};

async function http(path, { method = 'GET', token, body, extra = {} } = {}) {
  let response;
  try {
    response = await fetch(url + path, {
      method,
      redirect: 'error',
      cache: 'no-store',
      headers: {
        apikey: key,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body === undefined ? {} : {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Local signed Auth HTTP request failed');
  }
  return response;
}
async function jsonOk(response, label) {
  if (!response.ok) throw new Error(label + ' rejected with HTTP ' + response.status);
  try { return await response.json(); }
  catch { throw new Error(label + ' returned invalid JSON'); }
}
function assert(condition, label) {
  if (!condition) throw new Error(label);
}
function isDenied(response) {
  return response.status === 401 || response.status === 403;
}
function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
const query = (table, owner, id) => '/rest/v1/' + table + '?select=*&owner_id=eq.' +
  encodeURIComponent(owner) + (id ? '&id=eq.' + encodeURIComponent(id) : '');

async function createUser(label) {
  const email = 'mosaic-' + runId + '-' + label + '@example.org';
  const password = 'Aa!9' + randomBytes(25).toString('hex');
  const signup = await jsonOk(await http('/auth/v1/signup', {
    method: 'POST', body: { email, password },
  }), 'Auth signup');
  assert(isUuid(signup.user?.id), 'Supabase Auth signup lacked a UUID');
  // Exercise the actual password grant rather than trusting signup's JWT.
  const grant = await jsonOk(await http('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  }), 'Auth signed password grant');
  const token = grant.access_token;
  assert(typeof token === 'string' && token.length > 40, 'No signed user token');
  const verified = await jsonOk(await http('/auth/v1/user', { token }), 'Auth verified user');
  assert(verified.id === signup.user.id, 'Auth server returned a different user');
  counters.verifiedUsers++;
  return { id: verified.id, token, label };
}

async function insert(table, user, document) {
  const response = await http('/rest/v1/' + table, {
    method: 'POST', token: user.token, body: { ...document, owner_id: user.id },
  });
  assert(response.status === 201, 'Authenticated row INSERT denied: HTTP ' + response.status);
  const rows = await jsonOk(response, 'Created row representation');
  assert(Array.isArray(rows) && rows.length === 1, 'INSERT lacked authoritative row');
  const row = rows[0];
  assert(row.owner_id === user.id && row.id === document.id &&
    BigInt(row.change_seq) >= 1n, 'Server-generated revision/owner invalid');
  counters.created++;
  return row;
}
async function read(table, user, owner) {
  const rows = await jsonOk(await http(query(table, owner), { token: user.token }),
    'Authenticated owner SELECT');
  assert(Array.isArray(rows), 'Owner SELECT lacked row array');
  return rows;
}
async function cas(user, id, rev, patch) {
  const r = await http('/rest/v1/rpc/mosaic_candidate_cas_task', {
    method: 'POST', token: user.token,
    body: { p_id: id, p_expected_seq: String(rev), p_patch: patch },
  });
  return r;
}

const a = await createUser('a');
const b = await createUser('b');
assert(a.id !== b.id, 'Supabase Auth issued duplicate identities');
const users = [a, b];
for (const u of users) {
  const suffix = u.label + '_' + runId;
  u.category = await insert(tables.categories, u, {
    id: 'ci_category_' + suffix, name: 'Synthetic category', color: '#aabbcc',
    order_index: 0, visibility: 'private', updated_at: '2026-10-19',
  });
  u.task = await insert(tables.tasks, u, {
    id: 'ci_task_' + suffix, title: 'Synthetic task',
    completed: false, category_id: u.category.id, order_index: 0,
    task_date: '2026-10-19', created_at: '2026-10-19',
    updated_at: '2026-10-19', visibility: 'private',
  });
}
for (const [u, other] of [[a, b], [b, a]]) {
  for (const table of Object.values(tables)) {
    const own = await read(table, u, u.id);
    assert(own.length === 1 && own[0].owner_id === u.id,
      'Signed owner SELECT did not return its own fixture');
    counters.ownedReads++;
    const foreign = await read(table, u, other.id);
    assert(foreign.length === 0, 'Signed foreign owner SELECT leaked rows');
    counters.foreignReads++;
  }
}
const unauthorizedInsert = await http('/rest/v1/' + tables.categories, {
  method: 'POST', token: a.token,
  body: { ...a.category, id: 'ci_spoof_' + runId, owner_id: b.id },
});
assert(isDenied(unauthorizedInsert), 'Cross-owner INSERT did not get denied');
counters.ownerSpoofDenied++;

const duplicated = await http('/rest/v1/' + tables.categories, {
  method: 'POST', token: a.token,
  body: {
    id: a.category.id, owner_id: a.id, name: a.category.name,
    color: a.category.color, order_index: 0, visibility: 'private',
    updated_at: '2026-10-19',
  },
});
assert(duplicated.status === 409, 'Duplicate INSERT did not return HTTP 409');
const stillOwned = await jsonOk(await http(query(tables.categories, a.id, a.category.id),
  { token: a.token }), 'Duplicate-conflict authoritative GET');
assert(stillOwned.length === 1 && stillOwned[0].owner_id === a.id,
  'Duplicate conflict changed or lost the authoritative master');
counters.duplicateConflicts++;

for (const method of ['PATCH', 'DELETE']) {
  const response = await http('/rest/v1/' + tables.tasks + '?id=eq.' + a.task.id, {
    method, token: a.token, ...(method === 'PATCH' ? { body: { title: 'forbidden' } } : {}),
  });
  assert(isDenied(response), 'Direct ' + method + ' was permitted');
  counters.directWritesDenied++;
}
const anonymousRead = await http('/rest/v1/' + tables.tasks + '?select=id');
assert(isDenied(anonymousRead), 'Anonymous task SELECT permitted');
counters.anonDenied++;
const anonymousCas = await http('/rest/v1/rpc/mosaic_candidate_cas_task', {
  method: 'POST', body: {
    p_id: a.task.id, p_expected_seq: String(a.task.change_seq),
    p_patch: { title: 'anonymous' },
  },
});
assert(isDenied(anonymousCas), 'Anonymous CAS RPC permitted');
counters.anonDenied++;

const firstRev = BigInt(a.task.change_seq);
const [raceA, raceB] = await Promise.all([
  cas(a, a.task.id, firstRev, { title: 'race-a' }),
  cas(a, a.task.id, firstRev, { title: 'race-b' }),
]);
const one = await jsonOk(raceA, 'Racing CAS A');
const two = await jsonOk(raceB, 'Racing CAS B');
if ((one === null) === (two === null)) {
  const shape = (value) => value === null ? 'null'
    : Array.isArray(value) ? 'array'
    : typeof value !== 'object' ? typeof value
    : value.owner_id === null && value.id === null ? 'null-composite'
    : value.owner_id === a.id && value.id === a.task.id ? 'owned-composite'
    : 'unexpected-composite';
  // Sanitized shape only, no JWTs, passwords, emails or row contents.
  throw new Error('Same-revision CAS response shapes: ' + shape(one) + ' / ' + shape(two));
}
const winner = one ?? two;
assert(winner.id === a.task.id && winner.owner_id === a.id &&
  BigInt(winner.change_seq) > firstRev, 'CAS winner did not advance its revision');
counters.casSuccesses++;

const stale = await jsonOk(await cas(a, a.task.id, firstRev, { title: 'stale' }),
  'Stale CAS');
assert(stale === null, 'Stale CAS overwrote the winner');
counters.staleConflicts++;

const foreign = await jsonOk(await cas(b, a.task.id, firstRev, { title: 'hijacked' }),
  'Foreign CAS');
assert(foreign === null, 'Foreign CAS modified another account');
counters.foreignCasConflicts++;

const injection = await cas(a, a.task.id, winner.change_seq, { owner_id: b.id });
assert(injection.status >= 400 && injection.status < 500,
  'CAS unapproved owner_id patch was accepted');
counters.invalidPatchDenied++;

const tombstone = await jsonOk(await cas(a, a.task.id, winner.change_seq,
  { is_deleted: true }), 'Tombstone CAS');
assert(tombstone.id === a.task.id && tombstone.is_deleted === true &&
  BigInt(tombstone.change_seq) > BigInt(winner.change_seq),
  'Tombstone CAS did not preserve logical deleted row');
counters.tombstones++;

const cursor = await jsonOk(await http(
  '/rest/v1/' + tables.tasks + '?select=id,change_seq,is_deleted' +
  '&owner_id=eq.' + encodeURIComponent(a.id) +
  '&change_seq=gt.' + String(winner.change_seq) +
  '&order=change_seq.asc&limit=100',
  { token: a.token },
), 'Cursor replay');
assert(cursor.length === 1 && cursor[0].id === a.task.id &&
  cursor[0].is_deleted === true, 'Cursor pull skipped the tombstone');
counters.cursorPulls++;

console.log(JSON.stringify({
  ok: true,
  testEnvironment: 'ephemeral-supabase-cli-only',
  // Sanitized counts only; never emit emails, passwords, access tokens or JWTs.
  counters,
}));
