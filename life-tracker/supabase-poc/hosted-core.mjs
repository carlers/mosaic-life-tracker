/**
 * Isolated mosaic-dev rollout and real signed security verification (#1027).
 * Defaults to read-only inspection. No arbitrary project/SQL/identity input.
 * Credentials and generated passwords stay in memory; output is counts only.
 */
import { createHash, randomBytes } from 'node:crypto';
import { runSignedAuthProbe } from './signed-auth-probe.mjs';
import { preflightHostedPostRegistry, checkHostedSignedRegistry, checkHostedAtomicCategory } from './hosted-post-registry.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inspectEmailPolicy, previewEmailPolicy, EMAIL_PREVIEW, EMAIL_PREVIEW_SHA, requireDeployedPreviewAccess } from './email-policy.mjs';

export const PROJECT = 'hcxtiifzxoaflhjgoglb';
export const ORIGIN = `https://${PROJECT}.supabase.co`;
const MANAGEMENT = `https://api.supabase.com/v1/projects/${PROJECT}`;
const BASELINE = [
  '20261018144453', '20261018144905', '20261018145222',
  '20261018151733', '20261018151832', '20261018202021', '20261018202113',
];
const MIGRATIONS = [
  ['20261020130000', 'candidate_task_protected_fields', '20261020_candidate_task_protected_fields.sql'],
  ['20261020130001', 'core_fresh_identity_authority', '20261020_core_fresh_identity_authority.sql'],
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PERSONAL_TABLES = Object.freeze([
  'tasks', 'categories', 'diary', 'settings', 'buckets', 'bucket_task_links',
]);
/**
 * Negative hosted write assertion. Test a real existing owner row using a
 * column shared by all six personal tables; invalid-column HTTP 400 is NOT
 * evidence of denied UPDATE. Never allow a SQL-shape error to pass here.
 */
export async function assertDirectTableWritesBlocked(api, owner, domain, rowId) {
  check(PERSONAL_TABLES.includes(domain) && UUID.test(owner?.id) &&
    typeof owner.token === 'string' && owner.token.length > 0 &&
    /^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/.test(rowId ?? ''),
  'Direct-write denial requires a signed user and exact owned fixture row');
  const path = `/rest/v1/mosaic_candidate_${domain}?id=eq.${rowId}&owner_id=eq.${owner.id}`;
  for (const method of ['PATCH', 'DELETE']) {
    const response = await api(path, {
      token: owner.token, method,
      ...(method === 'PATCH' ? { body: { is_deleted: true } } : {}),
    });
    check(response.status === 401 || response.status === 403,
      `Direct ${method} ${domain}: expected permission denial, got HTTP ${response.status}`);
  }
  return 2;
}

export function sixDomainFixtureRows(runId, suffix, ownerId, taskId) {
  check(/^[a-f0-9]{24}$/.test(runId) && ['a', 'b'].includes(suffix) &&
    UUID.test(ownerId) && typeof taskId === 'string' &&
    taskId === `ht_${runId}_${suffix}`, 'Invalid six-domain fixture identity');
  const id = type => `h${type}_${runId}_${suffix}`;
  const stamp = '2026-10-27T00:00:00.000Z';
  const shared = { owner_id: ownerId, created_at: stamp, updated_at: stamp, is_deleted: false };
  const bucketId = id('b');
  const records = [
    ['diary', { ...shared, id: id('d'), entry_date: suffix === 'a' ? '2026-10-27' : '2026-10-28',
      content: 'Six-domain disposable hosted probe', emoji: '', photos: '[]' }],
    ['settings', { owner_id: ownerId, id: id('s'), setting_key: 'calendarZoomDays',
      setting_value: '7', updated_at: stamp, is_deleted: false }],
    ['buckets', { ...shared, id: bucketId, title: 'Disposable private goal',
      description: 'Test only', achieved: false, achieved_at: '' }],
    ['bucket_task_links', { ...shared, id: id('l'), bucket_list_id: bucketId, task_id: taskId }],
  ];
  check(records.every(([,row]) => row.owner_id === ownerId &&
    /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/.test(row.id)), 'Unsafe disposable fixture ID');
  return records;
}
function check(condition, message) { if (!condition) throw new Error(message); }
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const digest = value => createHash('sha256').update(value).digest('hex');

export function isCasConflict(row) {
  return row === null || (row && typeof row === 'object' && !Array.isArray(row) &&
    ['owner_id', 'id', 'change_seq', 'is_deleted'].every(field =>
      Object.hasOwn(row, field) && row[field] === null) &&
    Object.values(row).every(value => value === null));
}

export function assertProject(project) {
  check(project?.id === PROJECT && project.name === 'mosaic-dev' &&
    project.status === 'ACTIVE_HEALTHY', 'Expected healthy isolated mosaic-dev project');
}

export function migrationQuery(sources) {
  check(sources.length === MIGRATIONS.length && sources.every(s => typeof s === 'string' && s.length > 100),
    'Missing reviewed migration sources');
  // The zero-user/zero-row checks execute inside the SAME transaction, with
  // locks preventing concurrent signup/writes between inspection and rollout.
  return `begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table auth.users, public.mosaic_candidate_tasks, public.mosaic_candidate_categories,
  supabase_migrations.schema_migrations in share row exclusive mode;
do $guard$
begin
  if exists(select 1 from auth.users)
    or exists(select 1 from public.mosaic_candidate_tasks)
    or exists(select 1 from public.mosaic_candidate_categories)
    or to_regclass('mosaic_candidate_private.core_authorities') is not null
    or (select array_agg(version::text order by version)
        from supabase_migrations.schema_migrations)
       is distinct from array[${BASELINE.map(quote).join(',')}]::text[]
  then raise exception 'Rollout requires the reviewed empty isolated baseline'; end if;
end $guard$;
${sources.map((source, i) => `${source}
insert into supabase_migrations.schema_migrations(version,name,statements)
values(${quote(MIGRATIONS[i][0])},${quote(MIGRATIONS[i][1])},array[${quote(source)}]);`).join('\n')}
notify pgrst, 'reload schema';
commit;`;
}

export async function connect({ token, fetcher = fetch } = {}) {
  check(typeof token === 'string' && token.length > 10 && !/[\r\n]/.test(token),
    'SUPABASE_ACCESS_TOKEN is required');
  async function request(base, path, { body, method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) {
    check(path === '' || (path.startsWith('/') && !path.startsWith('//')), 'Invalid API path');
    // Only GET transport failures are retried. Never replay CAS/Auth/lease writes.
    const maxAttempts = method === 'GET' && body === undefined ? 3 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response;
      const controller = new AbortController();
    // Keep the deadline referenced while proxy sockets are idle. An unref'ed
    // AbortSignal.timeout can let Node exit with an unsettled top-level await,
    // skipping fixture retirement.
      const deadline = setTimeout(() => controller.abort(), 30_000);
      try {
      response = await fetcher(base + path, {
        method, redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // Never include provider bodies, fetch causes or credentials in errors.
      let data = null;
      try { data = await response.json(); }
      catch { if (controller.signal.aborted) throw new Error(); /* logout can be empty */ }
      return { status: response.status, ok: response.ok, data };
      } catch {
        if (attempt + 1 === maxAttempts)
          throw new Error('Isolated Supabase request failed (network or redirect)');
      } finally { clearTimeout(deadline); }
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
    throw new Error('Unreachable bounded GET retry');
  }
  const management = (path, body) => request(MANAGEMENT, path, {
    body, headers: { Authorization: `Bearer ${token}` },
  });
  async function requireOk(result, label) {
    check(result.ok, `${label}: HTTP ${result.status}`);
    return result.data;
  }
  const project = await requireOk(await management(''), 'Project inspection');
  assertProject(project);
  async function sql(query, readOnly = true) {
    return requireOk(await management('/database/query' + (readOnly ? '/read-only' : ''), { query }),
      readOnly ? 'Database inspection' : 'Scoped database operation');
  }
  let keys;
  async function dataApi(path, { token: userToken, admin = false, ...options } = {}) {
    if (!keys) keys = await requireOk(await management('/api-keys?reveal=true'), 'Project key access');
    const publicKey = keys.find(k => k.type === 'publishable')?.api_key;
    const adminKey = keys.find(k => k.type === 'secret')?.api_key;
    check(publicKey?.startsWith('sb_publishable_'), 'Modern publishable key required');
    if (admin) check(adminKey?.startsWith('sb_secret_'), 'Admin key required for disposable fixtures');
    check(!admin || path.startsWith('/auth/v1/admin/users'), 'Admin key limited to fixture Auth administration');
    return request(ORIGIN, path, {
      ...options,
      headers: {
        apikey: admin ? adminKey : publicKey,
        ...(admin ? { Authorization: `Bearer ${adminKey}` } :
          userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        Prefer: 'return=representation',
      },
    });
  }
  async function fixtureEmailLink({ id, runId, type, password }) {
    check(UUID.test(id ?? '') && /^[a-f0-9]{24}$/.test(runId ?? '') &&
      ['signup', 'recovery'].includes(type), 'Invalid disposable email action');
    const user = await requireOk(await dataApi('/auth/v1/admin/users/' + id, { admin: true }),
      'Fixture email identity inspection');
    check(user.id === id && user.app_metadata?.mosaic_disposable_run === runId &&
      user.email === `mosaic-hosted-${runId}-email-b@example.org`,
    'Email links require the exact server-marked disposable account');
    if (type === 'signup') check(typeof password === 'string' && password.length >= 20 &&
      !user.email_confirmed_at, 'Signup link requires an unconfirmed fixture');
    // This dedicated operation does not broaden dataApi's admin endpoint guard.
    const adminKey = keys.find(k => k.type === 'secret')?.api_key;
    const result = await requireOk(await request(ORIGIN, '/auth/v1/admin/generate_link', {
      body: { type, email: user.email, ...(type === 'signup' ? { password } : {}) },
      headers: { apikey: adminKey, Authorization: 'Bearer ' + adminKey },
    }), 'Disposable email link generation');
    check(result.id === id && /^[a-f0-9]{32,128}$/i.test(result.hashed_token ?? '') &&
      /^\d{6,10}$/.test(result.email_otp ?? ''),
      'Generated email code owner or token mismatch');
    return { tokenHash: result.hashed_token, code: result.email_otp };
  }
  async function configurePreviewEmailPolicy() {
    const before = await requireOk(await management('/config/auth'), 'Auth email policy inspection');
    const patch = previewEmailPolicy(before);
    await requireOk(await request(MANAGEMENT, '/config/auth', {
      method: 'PATCH', body: patch, headers: { Authorization: `Bearer ${token}` },
    }), 'Isolated Preview Auth email configuration');
    const after = await requireOk(await management('/config/auth'), 'Auth email policy readback');
    check(Object.entries(patch).every(([name, value]) => after[name] === value) &&
      after.mailer_autoconfirm === false, 'Auth email configuration readback mismatch');
    return inspectEmailPolicy(after);
  }
  const publishableKey = () => {
    const key = keys?.find(k => k.type === 'publishable')?.api_key;
    check(key?.startsWith('sb_publishable_'), 'Verified public key unavailable');
    return key;
  };
  return { management, sql, dataApi, requireOk, fixtureEmailLink,
    configurePreviewEmailPolicy, publishableKey };
}

export async function inspect(client) {
  const [migrations, state, auth, advisors] = await Promise.all([
    client.sql('select version,name from supabase_migrations.schema_migrations order by version'),
    client.sql(`select (select count(*) from auth.users) as users,
      (select count(*) from public.mosaic_candidate_tasks) as tasks,
      (select count(*) from public.mosaic_candidate_categories) as categories,
      to_regclass('mosaic_candidate_private.core_authorities') is not null as authority_installed`),
    client.management('/config/auth'),
    client.management('/advisors/security'),
  ]);
  return {
    project: PROJECT, migrations, ...state[0], authConfigStatus: auth.status,
    // Deliberately whitelist fields; Auth configuration may contain secrets.
    auth: auth.ok ? Object.fromEntries(['disable_signup', 'mailer_autoconfirm',
      'refresh_token_rotation_enabled', 'security_refresh_token_reuse_interval', 'jwt_exp']
      .map(k => [k, auth.data[k]])) : null,
    advisorStatus: advisors.status,
    advisors: advisors.ok ? advisors.data.lints.map(l => ({
      name: l.name, level: l.level, schema: l.metadata?.schema, function: l.metadata?.name,
    })) : null,
  };
}

export async function applyEmptyProject(client) {
  const sources = await Promise.all(MIGRATIONS.map(m =>
    readFile(new URL('./migrations/' + m[2], import.meta.url), 'utf8')));
  await client.sql(migrationQuery(sources), false);
  const installed = await client.sql(`select version,statements from supabase_migrations.schema_migrations
    where version in (${MIGRATIONS.map(m => quote(m[0])).join(',')}) order by version`);
  check(installed.length === sources.length &&
    installed.every((row, i) => row.statements?.[0] === sources[i]), 'Migration readback differs from reviewed source');
  return MIGRATIONS.map((m, i) => ({ version: m[0], sha256: digest(sources[i]) }));
}

export async function runHostedProbe(client, { exerciseUi, onProgress = () => {}, sixDomains = false, postRegistry = false } = {}) {
  check(typeof sixDomains === 'boolean' && !(sixDomains && exerciseUi) &&
    typeof postRegistry === 'boolean' && (!postRegistry || (sixDomains && !exerciseUi)),
    'Post-registry signed acceptance requires non-browser six-domain disposable fixtures');
  const checkedTables = sixDomains ? PERSONAL_TABLES : PERSONAL_TABLES.slice(0, 2);
  const checkedFunctions = sixDomains ?
    ['mosaic_candidate_cas_task', 'mosaic_candidate_cas_category', 'mosaic_candidate_cas_diary',
      'mosaic_candidate_cas_setting', 'mosaic_candidate_cas_bucket',
      'mosaic_candidate_cas_bucket_link', 'mosaic_core_session'] :
    ['mosaic_candidate_cas_task', 'mosaic_candidate_cas_category', 'mosaic_core_session'];
  const privileges = await client.sql(`select count(*)::int as total,
    bool_and(c.relrowsecurity
      and has_table_privilege('authenticated',c.oid,'SELECT')
      and has_table_privilege('authenticated',c.oid,'INSERT')
      and not has_table_privilege('authenticated',c.oid,'UPDATE,DELETE,TRUNCATE')
      and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) as safe
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in (${checkedTables.map(t => quote('mosaic_candidate_' + t)).join(',')})`);
  check(Number(privileges[0]?.total) === checkedTables.length && privileges[0]?.safe === true,
    'Hosted table privileges or RLS differ from required contract');
  const functions = await client.sql(`select p.proname,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as signed
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      (${checkedFunctions.map(quote).join(',')})`);
  check(functions.length === checkedFunctions.length && functions.every(f =>
    f.prosecdef && f.proconfig?.includes('search_path=""') && !f.anon && f.signed),
  'Hosted RPC grants/search paths differ from required contract');
  const privateAccess = await client.sql(`select
    has_schema_privilege('anon','mosaic_candidate_private','USAGE') as anon,
    has_schema_privilege('authenticated','mosaic_candidate_private','USAGE') as signed`);
  check(!privateAccess[0]?.anon && !privateAccess[0]?.signed, 'Private authority schema is exposed');
  // The current 21-migration contract must be verified read-only *before*
  // allocating any additional hosted accounts or data.
  if (postRegistry) await preflightHostedPostRegistry(client);
  const runId = randomBytes(12).toString('hex');
  onProgress({ stage: 'fixtures', runId });
  const fixtures = [];
  const counts = { verifiedUsers: 0, createdRows: 0, foreignReads: 0, deniedWrites: 0,
    casWinners: 0, staleConflicts: 0, tombstones: 0, guardDenials: 0, retiredUsers: 0,
    strictVerifiedFixtures: 0, strictForeignIdDenials: 0 };
  const ok = client.requireOk;
  const api = client.dataApi;
  const denied = (response, label) => {
    check([401, 403].includes(response.status), `${label}: expected permission denial, got HTTP ${response.status}`);
    counts.deniedWrites++;
  };
  async function signIn(user) {
    const grant = await ok(await api('/auth/v1/token?grant_type=password', {
      body: { email: user.email, password: user.password },
    }), 'Disposable password sign-in');
    check(grant.user?.id === user.id && typeof grant.access_token === 'string', 'Signed fixture identity mismatch');
    user.token = grant.access_token;
    const verified = await ok(await api('/auth/v1/user', { token: user.token }), 'Signed user verification');
    check(verified.id === user.id, 'Auth verification mismatch');
  }
  async function account(label) {
    const user = { email: `mosaic-hosted-${runId}-${label}@example.org`,
      password: 'Aa!9' + randomBytes(24).toString('hex') };
    const created = await ok(await api('/auth/v1/admin/users', { admin: true, body: {
      ...user, email_confirm: true, app_metadata: { mosaic_disposable_run: runId },
    } }), 'Disposable Auth provisioning');
    check(UUID.test(created.id), 'Invalid fixture UUID');
    user.id = created.id;
    fixtures.push(user); // Retire even when a later login/assertion fails.
    await signIn(user);
    counts.verifiedUsers++;
    return user;
  }
  async function acquire(user) {
    const lease = await ok(await api('/rest/v1/rpc/mosaic_core_session', {
      token: user.token, body: { p_action: 'acquire' },
    }), 'Signed lease acquisition');
    check(lease.ownerId === user.id && lease.canonicalOwnerId === 'sb_' + user.id.replaceAll('-', '') &&
      lease.backend === 'supabase-cloud' && lease.provenance === 'fresh-supabase', 'Unexpected core identity');
  }
  async function rows(user, domain, owner = user.id) {
    return ok(await api(`/rest/v1/mosaic_candidate_${domain}?owner_id=eq.${owner}&select=*`,
      { token: user.token }), 'Signed owner read');
  }
  const cas = (user, domain, row, patch) => api(`/rest/v1/rpc/mosaic_candidate_cas_${domain}`, {
    token: user.token, body: { p_id: row.id, p_expected_seq: String(row.change_seq), p_patch: patch },
  });
  async function fixtureSql(user, command) {
    check(fixtures.includes(user) && UUID.test(user.id), 'Refusing non-fixture database mutation');
    // Verify the server-owned marker again inside every transaction. No caller
    // can substitute an unrelated identity through a CLI flag or SQL parameter.
    return client.sql(`begin;
      do $guard$ begin
        if not exists(select 1 from auth.users where id=${quote(user.id)}::uuid
          and raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)})
        then raise exception 'Disposable fixture ownership changed'; end if;
      end $guard$;
      ${command}
      commit;`, false);
  }
  let failure;
  try {
    const a = await account('a');
    const b = await account('b');
    check(a.id !== b.id, 'Fixture identities must differ');
    if (postRegistry) Object.assign(counts, await checkHostedSignedRegistry({
      api, runId, users: [a, b], onProgress,
    }));
    for (const user of [a, b]) {
      const suffix = user === a ? 'a' : 'b';
      const category = { owner_id: user.id, id: `hc_${runId}_${suffix}`, name: 'Hosted private list',
        color: '#345678', order_index: 0, visibility: 'public' };
      denied(await api('/rest/v1/mosaic_candidate_categories', { token: user.token, body: category }),
        'Unleased legacy writer');
      await acquire(user);
      const inserted = await ok(await api('/rest/v1/mosaic_candidate_categories',
        { token: user.token, body: category }), 'Signed category creation');
      user.category = inserted[0];
      const task = { owner_id: user.id, id: `ht_${runId}_${suffix}`, title: 'Hosted private task',
        category_id: category.id, order_index: 0, task_date: '2026-10-20',
        created_at: '2026-10-20', updated_at: '2026-10-20', visibility: 'public' };
      user.task = (await ok(await api('/rest/v1/mosaic_candidate_tasks',
        { token: user.token, body: task }), 'Signed task creation'))[0];
      counts.createdRows += 2;
      if (sixDomains) {
        for (const [domain, record] of sixDomainFixtureRows(runId, suffix, user.id, task.id)) {
          const inserted = await ok(await api('/rest/v1/mosaic_candidate_' + domain,
            { token: user.token, body: record }), 'Signed ' + domain + ' creation');
          check(Array.isArray(inserted) && inserted.length === 1 &&
            inserted[0].id === record.id && inserted[0].owner_id === user.id &&
            BigInt(inserted[0].change_seq) > 0n, 'Missing signed owner fixture or revision');
          user[domain] = inserted[0];
          counts.createdRows++;
        }
      }
      for (const domain of checkedTables) {
        const own = await rows(user, domain);
        check(own.length === 1 && own[0].owner_id === user.id,
          'Own fixture not readable');
        const foreign = user === a ? b : a;
        check((await rows(foreign, domain, user.id)).length === 0, 'Foreign-owner row disclosure');
        counts.foreignReads++;
        denied(await api(`/rest/v1/mosaic_candidate_${domain}`), 'Anonymous table access');
        counts.deniedWrites += await assertDirectTableWritesBlocked(api, user, domain, own[0].id);
      }
      denied(await api('/rest/v1/mosaic_candidate_tasks', { token: (user === a ? b : a).token,
        body: { ...task, id: 'spoof_' + suffix } }), 'Foreign insert');
    }
    const casCases = [
      ['task', a.task, { title: 'CAS winner' }, a, b],
      ['category', a.category, { name: 'CAS winner' }, a, b],
      ...(sixDomains ? [
        ['diary', a.diary, { content: 'CAS winner' }, a, b],
        ['setting', a.settings, { setting_value: '{"probe":true}' }, a, b],
        ['bucket', b.buckets, { title: 'CAS winner' }, b, a],
        ['bucket_link', b.bucket_task_links, { is_deleted: true }, b, a],
      ] : []),
    ];
    for (const [domain, row, patch, owner, other] of casCases) {
      onProgress({ stage: 'concurrent-cas', domain, runId });
      const foreign = await ok(await cas(other, domain, row, patch), 'Foreign CAS result');
      check(isCasConflict(foreign), 'Foreign CAS did not return a conflict');
      const race = await Promise.all([cas(owner, domain, row, patch), cas(owner, domain, row, patch)]);
      const results = await Promise.all(race.map(r => ok(r, 'Concurrent CAS')));
      check(results.filter(r => !isCasConflict(r)).length === 1, 'CAS must have exactly one winner');
      const winner = results.find(r => !isCasConflict(r));
      check(winner.owner_id === owner.id && winner.id === row.id &&
        BigInt(winner.change_seq) > BigInt(row.change_seq), 'CAS returned wrong identity or revision');
      counts.casWinners++;
      counts.staleConflicts++;
      for (const forbidden of [{ owner_id: other.id }, { change_seq: 1 }, { id: 'replaced' },
        ...(domain === 'task' ? [{ created_at: 'changed' }, { reactions: 'changed' }] :
          domain === 'diary' ? [{ entry_date: '2020-01-01' }] :
          domain === 'setting' ? [{ setting_key: 'hijack' }] :
          domain === 'bucket_link' ? [{ task_id: 'hijack' }] : [])]) {
        const r = await cas(owner, domain, winner, forbidden);
        check(r.status === 400, 'Protected CAS field accepted or failed for an unrelated reason');
      }
      denied(await api(`/rest/v1/rpc/mosaic_candidate_cas_${domain}`, {
        body: { p_id: row.id, p_expected_seq: row.change_seq, p_patch: patch },
      }), 'Anonymous privileged RPC');
    }
    // Denials must preserve both data and revision. Check expiry, freeze and
    // epoch mismatch independently, renewing only between cases.
    for (const [label, command] of [
      ['expired', `update mosaic_candidate_private.core_sessions set expires_at=now()-interval '1 second'
        where owner_id=${quote(a.id)}::uuid;`],
      ['frozen', `update mosaic_candidate_private.core_authorities set backend='frozen'
        where owner_id=${quote(a.id)}::uuid;`],
      ['epoch', `update mosaic_candidate_private.core_authorities set epoch=epoch+1
        where owner_id=${quote(a.id)}::uuid;`],
    ]) {
      onProgress({ stage: 'writer-guard', guard: label, runId });
      const before = (await rows(a, 'tasks'))[0];
      await fixtureSql(a, command);
      denied(await cas(a, 'task', before, { title: 'Denied ' + label }), label + ' writer');
      if (label === 'frozen') {
        denied(await api('/rest/v1/rpc/mosaic_core_session',
          { token: a.token, body: { p_action: 'acquire' } }), 'Frozen lease acquisition');
        await fixtureSql(a, `update mosaic_candidate_private.core_authorities set backend='supabase-cloud'
          where owner_id=${quote(a.id)}::uuid;`);
      }
      check(JSON.stringify((await rows(a, 'tasks'))[0]) === JSON.stringify(before),
        label + ' denial changed stored data');
      counts.guardDenials++;
      await acquire(a);
    }
    onProgress({ stage: 'lease-release', runId });
    await ok(await api('/rest/v1/rpc/mosaic_core_session',
      { token: a.token, body: { p_action: 'release' } }), 'Lease release');
    onProgress({ stage: 'released-writer-denial', runId });
    denied(await cas(a, 'task', (await rows(a, 'tasks'))[0], { title: 'Released' }), 'Released writer');
    await acquire(a);
    onProgress({ stage: 'session-revocation', runId });
    await ok(await api('/auth/v1/logout?scope=local', { token: a.token, body: {} }), 'Session revocation');
    denied(await cas(a, 'task', (await rows(a, 'tasks'))[0], { title: 'Revoked' }), 'Revoked writer');
    denied(await api('/rest/v1/rpc/mosaic_core_session',
      { token: a.token, body: { p_action: 'acquire' } }), 'Revoked lease acquisition');
    counts.guardDenials += 2;
    onProgress({ stage: 'signed-identity-refresh', runId });
    await signIn(a);
    if (sixDomains) {
      onProgress({ stage: 'signed-six-domain-owner-audit', runId });
      const proof = await runSignedAuthProbe({
        baseUrl: ORIGIN, publishableKey: client.publishableKey(),
        alice: { email: a.email, password: a.password },
        bob: { email: b.email, password: b.password },
      }, { requireOwnedFixtures: true });
      check(proof.signedUsers === 2 && proof.verifiedOwnedFixtures === 12 &&
        proof.deniedFixtureById === 12 && proof.deniedTableWrites === 12,
      'Strict signed two-owner six-domain proof incomplete');
      counts.strictVerifiedFixtures = proof.verifiedOwnedFixtures;
      counts.strictForeignIdDenials = proof.deniedFixtureById;
    }
    if (postRegistry) Object.assign(counts, await checkHostedAtomicCategory({
      api, runId, users: [a, b], rows, cas, onProgress,
    }));
    if (exerciseUi) {
      onProgress({ stage: 'browser', runId });
      await exerciseUi([await account('ui-a'), await account('ui-b')]);
    }
  } catch (error) { failure = error; }
  finally {
    onProgress({ stage: 'retirement', runId });
    const cleanupErrors = [];
    for (const user of fixtures) {
      try {
        await fixtureSql(user, `update mosaic_candidate_private.core_authorities set backend='supabase-cloud'
          where owner_id=${quote(user.id)}::uuid;`);
        await signIn(user);
        await acquire(user);
        const retireTables = sixDomains ? [
          ['bucket_task_links', 'bucket_link'], ['buckets', 'bucket'],
          ['settings', 'setting'], ['diary', 'diary'],
          ['tasks', 'task'], ['categories', 'category'],
        ] : [['tasks', 'task'], ['categories', 'category']];
        for (const [table, domain] of retireTables) {
          for (const row of await rows(user, table)) {
            if (!row.is_deleted) {
              const deleted = await ok(await cas(user, domain, row, { is_deleted: true }), 'Fixture tombstone');
              check(deleted?.is_deleted === true, 'Fixture tombstone conflicted');
              counts.tombstones++;
            }
          }
        }
      } catch { cleanupErrors.push('Fixture tombstone incomplete'); }
      // Freeze and ban even if tombstoning failed. Never hard-delete rows/users.
      try {
        await fixtureSql(user, `update mosaic_candidate_private.core_authorities set backend='frozen',epoch=epoch+1
          where owner_id=${quote(user.id)}::uuid;`);
        await ok(await api(`/auth/v1/admin/users/${user.id}`, {
          admin: true, method: 'PUT', body: { ban_duration: '876000h' },
        }), 'Fixture account retirement');
        counts.retiredUsers++;
      } catch { cleanupErrors.push('Fixture retirement incomplete'); }
    }
    if (cleanupErrors.length) throw new Error(
      `${failure ? failure.message + '; ' : ''}${cleanupErrors.join('; ')}`);
    if (fixtures.length) {
      const retired = await client.sql(`select count(*) as users,
        bool_and(a.backend='frozen' and u.banned_until>now()) as retired,
        ${checkedTables.map(t => `(select count(*) from public.mosaic_candidate_${t} x
          join auth.users owner on owner.id=x.owner_id
          where owner.raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)}
            and not x.is_deleted) as live_${t}`).join(',')}
        from auth.users u left join mosaic_candidate_private.core_authorities a on a.owner_id=u.id
        where u.raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)}`);
      check(Number(retired[0]?.users) === fixtures.length && retired[0]?.retired === true &&
        checkedTables.every(t => Number(retired[0]['live_' + t]) === 0),
      'Fixture retirement readback failed');
      onProgress({ stage: 'retirement-verified', runId, retiredUsers: fixtures.length,
        remainingLiveRows: 0, checkedDomains: checkedTables.length });
    }
  }
  if (failure) throw failure;
  return { runId, ...counts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2] ?? '--inspect';
    check(process.argv.length <= 3 &&
      ['--inspect', '--apply-empty-project', '--probe', '--six-domains', '--post-registry', '--ui', '--conflicts', '--offline', '--ui-preview'].includes(mode),
    'Usage: hosted-core.mjs [--inspect|--apply-empty-project|--probe|--six-domains|--post-registry|--ui|--conflicts|--offline|--ui-preview]');
    const preview = mode === '--ui-preview' ? { origin: EMAIL_PREVIEW, sha: EMAIL_PREVIEW_SHA } : null;
    if (preview) requireDeployedPreviewAccess(preview, process.env.MOSAIC_CORE_PREVIEW_SHARE_URL);
    const client = await connect({ token: process.env.SUPABASE_ACCESS_TOKEN });
    const result = mode === '--apply-empty-project' ? await applyEmptyProject(client) :
      ['--probe', '--six-domains', '--post-registry', '--ui', '--conflicts', '--offline', '--ui-preview'].includes(mode) ? await runHostedProbe(client, {
        sixDomains: mode === '--six-domains' || mode === '--post-registry',
        postRegistry: mode === '--post-registry',
        onProgress: progress => process.stdout.write(JSON.stringify(progress) + '\n'),
        ...(['--ui', '--conflicts', '--offline', '--ui-preview'].includes(mode) ? { exerciseUi: async accounts => {
          const { exerciseHostedUi } = await import('./hosted-core-ui.mjs');
          await exerciseHostedUi(client, accounts, ORIGIN, preview,
            mode === '--conflicts' ? 'lost write acknowledgement' :
              mode === '--offline' ? 'offline cold start' : 'real Mosaic UI');
        } } : {}),
      }) : await inspect(client);
    process.stdout.write(JSON.stringify({ ok: true, mode, result }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('Hosted core verification failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
