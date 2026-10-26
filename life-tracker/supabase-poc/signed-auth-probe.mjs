/**
 * Disposable signed-session Supabase Auth/Data API denial-path probe (#967).
 * No fixtures are inserted, no provider is switched, and no runtime imports this.
 * Owner-positive RLS, actual CAS winners and RxDB remain separate acceptance gates.
 * Only existing signed disposable accounts, SELECTs, absent-row writes and
 * denied RPCs. Never inserts rows, registers accounts or prints credentials.
 */
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const ISOLATED_PROJECT_REF = 'hcxtiifzxoaflhjgoglb';
const ISOLATED_ORIGIN = 'https://' + ISOLATED_PROJECT_REF + '.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertConfig(config) {
  if (!config || config.baseUrl !== ISOLATED_ORIGIN ||
    !config.publishableKey || config.publishableKey.trim() !== config.publishableKey ||
    !config.publishableKey.startsWith('sb_publishable_') || /[\r\n]/.test(config.publishableKey)) {
    throw new Error('Probe requires the isolated Mosaic development origin and a public key');
  }
  for (const account of [config.alice, config.bob]) {
    if (!account || typeof account.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) ||
      typeof account.password !== 'string' || account.password.length < 8) {
      throw new Error('Two disposable Auth email/password accounts are required');
    }
  }
  if (config.alice.email.toLowerCase() === config.bob.email.toLowerCase())
    throw new Error('The two disposable accounts must differ');
}

export async function runSignedAuthProbe(config, { fetcher = fetch, nonce = randomUUID() } = {}) {
  assertConfig(config);
  if (!UUID.test(nonce)) throw new Error('Invalid synthetic document nonce');
  const base = new URL(ISOLATED_ORIGIN);
  const totals = { signedUsers: 0, ownReads: 0, foreignReads: 0,
    deniedTableWrites: 0, deniedAnonymousCalls: 0, rpcConflicts: 0, rejectedRpcFields: 0 };

  async function request(path, { token, method = 'GET', body } = {}) {
    return fetcher(new URL(path, base).toString(), {
      method, cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: {
        apikey: config.publishableKey,
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  async function signIn(account) {
    const response = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: account.email, password: account.password },
    });
    if (!response.ok) throw new Error('Disposable Supabase Auth sign-in rejected');
    const payload = await response.json();
    if (!payload || typeof payload.access_token !== 'string' || payload.access_token.length < 12)
      throw new Error('Supabase Auth did not return an access token');
    const verify = await request('/auth/v1/user', { token: payload.access_token });
    if (!verify.ok) throw new Error('Supabase Auth rejected its signed-in token');
    const user = await verify.json();
    if (!user || typeof user.id !== 'string' || !UUID.test(user.id) ||
      (payload.user?.id !== undefined && payload.user.id !== user.id)) {
      throw new Error('Signed-in identity failed server Auth verification');
    }
    totals.signedUsers++;
    return { id: user.id, token: payload.access_token };
  }

  const alice = await signIn(config.alice);
  const bob = await signIn(config.bob);
  if (alice.id === bob.id) throw new Error('Disposable accounts resolved to the same Auth user');

  function assertDenied(response, label) {
    // A 400 SQL type/shape error is not evidence of denied privileges.
    if (response.status !== 401 && response.status !== 403)
      throw new Error(label + ' expected 401/403, got HTTP ' + response.status);
  }
  const tables = [
    'mosaic_candidate_tasks', 'mosaic_candidate_categories', 'mosaic_candidate_diary',
    'mosaic_candidate_settings', 'mosaic_candidate_buckets',
    'mosaic_candidate_bucket_task_links',
  ];
  for (const [user, foreign] of [[alice, bob], [bob, alice]]) {
    for (const table of tables) {
      const own = await request('/rest/v1/' + table + '?select=id,owner_id&limit=1',
        { token: user.token });
      if (!own.ok || !Array.isArray(await own.json()))
        throw new Error('Authenticated own-table SELECT did not return an array');
      totals.ownReads++;
      const foreignRows = await request('/rest/v1/' + table +
        '?select=id,owner_id&owner_id=eq.' + foreign.id + '&limit=1', { token: user.token });
      if (!foreignRows.ok || JSON.stringify(await foreignRows.json()) !== '[]')
        throw new Error('Foreign-owner read was not an empty result');
      totals.foreignReads++;
    }
  }

  const absentId = 'probe_' + nonce.replaceAll('-', '');
  // Never create or alter a row: a fresh absent nonce must be rejected at the grant layer.
  for (const table of tables) {
    for (const method of ['PATCH', 'DELETE']) {
      assertDenied(await request('/rest/v1/' + table + '?id=eq.' + absentId, {
        token: alice.token, method,
        ...(method === 'PATCH' ? { body: { is_deleted: true } } : {}),
      }), 'Direct ' + table + ' ' + method);
      totals.deniedTableWrites++;
    }
    assertDenied(await request('/rest/v1/' + table + '?select=id&limit=1'),
      'Anonymous private ' + table);
    totals.deniedAnonymousCalls++;
  }

  for (const [user, rpc, patch] of [
    [alice, 'mosaic_candidate_cas_task', { title: 'probe' }],
    [bob, 'mosaic_candidate_cas_category', { name: 'probe' }],
    [alice, 'mosaic_candidate_cas_diary', { content: 'probe' }],
    [alice, 'mosaic_candidate_cas_setting', { setting_value: 'probe' }],
    [bob, 'mosaic_candidate_cas_bucket', { title: 'probe' }],
    [alice, 'mosaic_candidate_cas_bucket_link', { is_deleted: true }],
  ]) {
    const missing = { p_id: absentId, p_expected_seq: '1', p_patch: patch };
    const result = await request('/rest/v1/rpc/' + rpc, {
      token: user.token, method: 'POST', body: missing,
    });
    if (!result.ok || await result.json() !== null)
      throw new Error('Missing-row CAS must return explicit null conflict');
    totals.rpcConflicts++;
    const injected = await request('/rest/v1/rpc/' + rpc, {
      token: user.token, method: 'POST',
      body: { ...missing, p_patch: { owner_id: user.id } },
    });
    if (injected.status < 400 || injected.status >= 500)
      throw new Error('Privileged CAS RPC accepted an unapproved owner_id patch');
    totals.rejectedRpcFields++;
    assertDenied(await request('/rest/v1/rpc/' + rpc, {
      method: 'POST', body: missing,
    }), 'Anonymous privileged RPC');
    totals.deniedAnonymousCalls++;
  }
  return totals; // Only non-sensitive counts leave the probe.
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runSignedAuthProbe({
      baseUrl: process.env.MOSAIC_SB_PROBE_URL,
      publishableKey: process.env.MOSAIC_SB_PROBE_PUBLISHABLE_KEY,
      alice: {
        email: process.env.MOSAIC_SB_PROBE_A_EMAIL,
        password: process.env.MOSAIC_SB_PROBE_A_PASSWORD,
      },
      bob: {
        email: process.env.MOSAIC_SB_PROBE_B_EMAIL,
        password: process.env.MOSAIC_SB_PROBE_B_PASSWORD,
      },
    });
    process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
  } catch (error) {
    // Never print token, credential or provider response body.
    process.stderr.write('Signed Supabase probe failed: ' +
      (error instanceof Error ? error.message : 'unknown failure') + '\n');
    process.exitCode = 1;
  }
}
