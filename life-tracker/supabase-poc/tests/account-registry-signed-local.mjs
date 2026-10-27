/** #1406 real GoTrue signatures, disposable CLI only; never real user data. */
import { randomBytes } from 'node:crypto';
const base = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
if (base !== 'http://127.0.0.1:54321' || !key?.startsWith('sb_publishable_'))
  throw new Error('Account registry lab requires disposable loopback Supabase');
const suffix = randomBytes(10).toString('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function call(path, token, body, method = body === undefined ? 'GET' : 'POST') {
  return fetch(base + path, { method, redirect: 'error', cache: 'no-store',
    headers: { apikey: key, ...(token ? { Authorization: 'Bearer ' + token } : {}),
      'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function json(response) {
  assert(response.ok, 'Registry lab HTTP ' + response.status);
  return response.json();
}
async function signup(label) {
  const email = 'registry-' + suffix + label + '@example.org';
  const password = 'Aa!9' + randomBytes(24).toString('hex');
  await json(await call('/auth/v1/signup', null, { email, password,
    data: { name: 'Same display name', legacy_user_id: 'untrusted_shared_owner',
      mosaic_account_id: 'untrusted_shared_owner', email: 'shared@example.org' } }));
  const grant = await json(await call('/auth/v1/token?grant_type=password', null, { email, password }));
  return { token: grant.access_token, owner: grant.user.id };
}
const status = (user, mode = null) => call('/rest/v1/rpc/mosaic_account_status', user?.token,
  { p_start_mode: mode });
const a = await signup('a'), b = await signup('b');
const first = await json(await status(a)), other = await json(await status(b));
assert(first.version === 1 && first.providerUserId === a.owner &&
  first.mosaicAccountId === 'sb_' + a.owner.replaceAll('-', '') &&
  first.historyState === 'unconfirmed' && first.consentVersion === null, 'Server-owned initial mapping');
assert(first.mosaicAccountId !== other.mosaicAccountId && first.installationId === other.installationId,
  'User metadata/email/name cannot merge accounts');
const pending = await json(await status(a, 'recovery-pending'));
const readiness = await json(await call('/rest/v1/rpc/mosaic_personal_readiness', a.token, {}));
assert(readiness.personalReady === false, 'Installing schema alone must not approve personal release');
assert(pending.historyState === 'recovery-pending' && pending.consentVersion === 1 &&
  pending.mosaicAccountId === first.mosaicAccountId, 'Pending consent must preserve canonical ID');
assert(JSON.stringify(await json(await status(a, 'recovery-pending'))) === JSON.stringify(pending),
  'Repeated consent must be idempotent');
assert(!(await status(a, 'fresh')).ok, 'Pending history cannot silently become fresh');
assert(!(await status(a, 'recovered')).ok, 'Client cannot claim completed recovery');
assert(!(await call('/rest/v1/rpc/mosaic_account_status', a.token,
  { p_start_mode: 'fresh', p_owner_id: b.owner })).ok, 'Client cannot select a different owner');
const fresh = await json(await status(b, 'fresh'));
assert(fresh.historyState === 'fresh' && fresh.mosaicAccountId === other.mosaicAccountId,
  'Independent fresh owner must remain independent');
assert((await json(await status(a))).historyState === 'recovery-pending', 'Foreign choice changed pending owner');
assert((await json(await status(b, 'recovery-pending'))).historyState === 'recovery-pending',
  'Owner can disclose earlier history later');
assert(!(await status(null)).ok, 'Anonymous registry access');
for (const table of ['mosaic_accounts', 'provider_accounts', 'identity_audit', 'identity_installation']) {
  assert(!(await call('/rest/v1/' + table + '?select=*', a.token)).ok, 'Private registry exposed');
  assert(!(await call('/rest/v1/' + table, a.token, { account_id: first.mosaicAccountId })).ok,
    'Client can write authority registry');
}
await json(await call('/auth/v1/user', a.token, { data: {
  mosaic_account_id: other.mosaicAccountId, legacy_user_id: 'shared@example.org',
} }, 'PUT'));
assert((await json(await status(a))).mosaicAccountId === first.mosaicAccountId, 'Metadata rewrote authority');
const logout = await call('/auth/v1/logout?scope=local', a.token, {});
assert(logout.ok, 'Local signed logout failed');
assert((await status(a)).status === 403, 'Revoked signed session still reads registry');
console.log(JSON.stringify({ ok: true, environment: 'disposable-local-gotrue', owners: 2,
  sameMetadataKeptSeparate: true, pendingPreserved: true, idempotentConsent: true,
  privateRegistryDenied: true, revokedSessionDenied: true, historicalClaimEnabled: false }));
