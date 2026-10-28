/**
 * #1027: isolated mosaic-dev post-registry signed acceptance.
 * Only the existing hosted-core fixture runner may call this module.
 * No administrative database writes, credential logging or release markers.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAGED = Object.freeze([
  '20261028065933', // category retirement
  '20261028065942', // atomic category deletion
  '20261028070002', // identity registry
  '20261028070014', // personal readiness
  '20261028070024', // complete release evidence
]);
const assert = (pass, message) => { if (!pass) throw new Error(message); };
const fixtureEmail = (id, suffix) => 'mosaic-hosted-' + id + '-' + suffix + '@example.org';
const fixtureCategory = id => 'hc_' + id + '_b';
const fixtureTask = id => 'ht_' + id + '_b';
const rejectedTask = id => 'hd_' + id + '_b';

export function assertHostedPostRegistryCatalog(rows) {
  const r = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  assert(r && Number(r.migrations) === 21 && Number(r.staged) === STAGED.length &&
    r.release_evidence === false && r.writer_guard === false &&
    r.category_retirement === true && r.category_cascade === true &&
    r.task_assignment_guard === true && r.registry_private === true,
  'Host post-registry catalog or release fence has changed; refuse disposable fixtures');
  return true;
}

export async function preflightHostedPostRegistry(client) {
  assert(typeof client?.sql === 'function', 'Missing read-only project SQL client');
  const result = await client.sql(`
    SELECT
      (SELECT count(*)::int FROM supabase_migrations.schema_migrations) AS migrations,
      (SELECT count(*)::int FROM supabase_migrations.schema_migrations WHERE version IN (
        '20261028065933','20261028065942','20261028070002',
        '20261028070014','20261028070024'
      )) AS staged,
      EXISTS (SELECT 1 FROM mosaic_candidate_private.identity_installation
        WHERE personal_release_evidence IS NOT NULL) AS release_evidence,
      EXISTS (SELECT 1 FROM pg_proc WHERE proname='has_personal_write_authority'
        AND pronamespace='mosaic_candidate_private'::regnamespace) AS writer_guard,
      EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid='public.mosaic_candidate_categories'::regclass
          AND attname='retired_on' AND NOT attisdropped) AS category_retirement,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgrelid='public.mosaic_candidate_categories'::regclass
          AND tgname='mosaic_candidate_category_task_tombstone'
          AND NOT tgisinternal) AS category_cascade,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgrelid='public.mosaic_candidate_tasks'::regclass
          AND tgname='mosaic_candidate_task_live_category_guard'
          AND NOT tgisinternal) AS task_assignment_guard,
      (SELECT bool_and(relrowsecurity AND NOT has_table_privilege(
        'authenticated',oid,'SELECT,INSERT,UPDATE,DELETE'))
        FROM pg_class WHERE oid IN (
          'mosaic_candidate_private.mosaic_accounts'::regclass,
          'mosaic_candidate_private.provider_accounts'::regclass,
          'mosaic_candidate_private.identity_audit'::regclass,
          'mosaic_candidate_private.identity_installation'::regclass
        )) AS registry_private
  `);
  return assertHostedPostRegistryCatalog(result);
}

function ownOnly(runId, users) {
  assert(/^[a-f0-9]{24}$/.test(runId) && users?.length === 2, 'Invalid fixture run identity');
  for (const [i, user] of users.entries()) {
    assert(UUID.test(user?.id ?? '') && typeof user.token === 'string' &&
      user.token.length > 20 &&
      user.email === fixtureEmail(runId, i === 0 ? 'a' : 'b'),
    'Post-registry requires this invocation\'s two signed, run-marked disposable owners');
  }
  assert(users[0].id !== users[1].id, 'Disposable owners share an identity');
}

function ensureOk(result, label) {
  assert(result?.ok === true, label + ': expected signed success; HTTP ' + result?.status);
  return result.data;
}
function ensureDenied(result, label) {
  assert(result?.ok === false && [400, 401, 403, 404].includes(result.status),
    label + ': request unexpectedly succeeded or returned a non-denial');
}
function mapping(row, user, label) {
  assert(row?.version === 1 && row.provider === 'supabase-cloud' &&
    row.providerUserId === user.id &&
    row.mosaicAccountId === 'sb_' + user.id.replaceAll('-', '') &&
    row.provenance === 'server-enrolled' && row.mappingVersion === 1 &&
    row.consentVersion !== undefined && UUID.test(row.installationId ?? ''),
    label + ': server-owned signed account mapping changed');
}
function sameMapping(a, b) {
  return a.mosaicAccountId === b.mosaicAccountId &&
    a.providerUserId === b.providerUserId &&
    a.installationId === b.installationId && a.mappingVersion === b.mappingVersion;
}

/**
 * Called BEFORE exercising six-domain fixture writes. The two users are
 * provisioned with a server-owned run marker by the existing runner. No real
 * account can be provided through CLI parameters.
 */
export async function checkHostedSignedRegistry({ api, runId, users, onProgress = () => {} }) {
  ownOnly(runId, users);
  assert(typeof api === 'function', 'Missing signed data API');
  const [a, b] = users;
  const status = (owner, start = null, extra = {}) =>
    api('/rest/v1/rpc/mosaic_account_status', {
      ...(owner ? { token: owner.token } : {}),
      body: { p_start_mode: start, ...extra },
    });
  const ready = owner => api('/rest/v1/rpc/mosaic_personal_readiness', {
    ...(owner ? { token: owner.token } : {}), body: {},
  });
  onProgress({ stage: 'registry-initial', runId });
  const originalA = ensureOk(await status(a), 'Owner A mapping');
  const originalB = ensureOk(await status(b), 'Owner B mapping');
  mapping(originalA, a, 'Owner A');
  mapping(originalB, b, 'Owner B');
  assert(originalA.historyState === 'unconfirmed' && originalB.historyState === 'unconfirmed' &&
    originalA.consentVersion === null && originalB.consentVersion === null &&
    originalA.installationId === originalB.installationId &&
    originalA.mosaicAccountId !== originalB.mosaicAccountId,
  'Disposable fresh owners were merged, previously consented, or bound to different installations');

  ensureDenied(await status(null), 'Anonymous account status');
  ensureDenied(await ready(null), 'Anonymous personal readiness');
  ensureDenied(await ready(a), 'Readiness without consent');
  ensureDenied(await status(a, 'recovered'), 'Client historical recovery claim');
  ensureDenied(await status(a, 'fresh', { p_owner_id: b.id }), 'Caller-selected foreign account');
  const unchanged = ensureOk(await status(a), 'Post-forgery owner mapping');
  assert(sameMapping(originalA, unchanged) && unchanged.historyState === 'unconfirmed',
    'Rejected caller-supplied owner changed the mapping');

  const metadata = await api('/auth/v1/user', {
    token: a.token, method: 'PUT', body: { data: {
      mosaic_account_id: originalB.mosaicAccountId,
      legacy_user_id: b.id,
      email: b.email,
    } },
  });
  ensureOk(metadata, 'Disposable user-metadata spoof test');
  const afterMetadata = ensureOk(await status(a), 'Post-metadata mapping');
  assert(sameMapping(originalA, afterMetadata) &&
    afterMetadata.historyState === 'unconfirmed',
  'Client metadata or foreign email rewrote server-owned identity');

  onProgress({ stage: 'registry-new-data-consent', runId });
  const pending = ensureOk(await status(a, 'recovery-pending'), 'Pending-history consent');
  const fresh = ensureOk(await status(b, 'fresh'), 'New-data consent');
  mapping(pending, a, 'Pending owner');
  mapping(fresh, b, 'Fresh owner');
  assert(pending.historyState === 'recovery-pending' &&
    fresh.historyState === 'fresh' &&
    pending.consentVersion === 1 && fresh.consentVersion === 1 &&
    sameMapping(originalA, pending) && sameMapping(originalB, fresh),
  'Consent altered ownership or historical state');
  const again = ensureOk(await status(a, 'recovery-pending'), 'Repeated pending consent');
  assert(JSON.stringify(again) === JSON.stringify(pending), 'Repeated consent was not idempotent');
  ensureDenied(await status(a, 'fresh'), 'Forbidden pending-to-fresh history downgrade');
  ensureDenied(await status(b, 'recovered'), 'Forbidden completed history claim');

  const readyA = ensureOk(await ready(a), 'Post-consent owner A readiness');
  const readyB = ensureOk(await ready(b), 'Post-consent owner B readiness');
  assert(readyA.personalReady === false && readyB.personalReady === false &&
    readyA.mosaicAccountId === originalA.mosaicAccountId &&
    readyB.mosaicAccountId === originalB.mosaicAccountId,
  'Unreleased installation unexpectedly enabled personal writers');
  for (const table of ['mosaic_accounts', 'provider_accounts', 'identity_audit', 'identity_installation']) {
    ensureDenied(await api('/rest/v1/' + table + '?select=*', { token: a.token }),
      'Browser access to private identity table');
  }
  assert(sameMapping(originalA, ensureOk(await status(a), 'Final owner A mapping')) &&
    sameMapping(originalB, ensureOk(await status(b), 'Final owner B mapping')),
  'Signed two-owner registry changed after denial tests');
  onProgress({ stage: 'registry-verified', runId });
  return { registryOwners: 2, consentedFixtureOwners: 2, anonymousAndClaimDenied: true,
    metadataSpoofDenied: true, releaseNotActivated: true };
}

/**
 * Called only AFTER the six-domain signed CAS and foreign-owner audit. Owner B
 * already has a tombstoned synthetic Bucket task link. CAS category deletion
 * must cascade to that user's task without ever touching another owner.
 */
export async function checkHostedAtomicCategory({ api, runId, users, rows, cas, onProgress = () => {} }) {
  ownOnly(runId, users);
  assert(typeof api === 'function' && typeof rows === 'function' &&
    typeof cas === 'function', 'Missing signed atomic-delete helpers');
  const [a, b] = users;
  assert(b.category?.id === fixtureCategory(runId) && b.task?.id === fixtureTask(runId),
    'Atomic-delete fixture owner/category identity mismatch');
  onProgress({ stage: 'category-retirement', runId });
  const retired = ensureOk(await cas(b, 'category', b.category, {
    retired_on: '2026-10-28',
  }), 'Signed category retirement CAS');
  assert(retired.id === b.category.id && retired.owner_id === b.id &&
    retired.retired_on === '2026-10-28' && retired.is_deleted === false &&
    BigInt(retired.change_seq) > BigInt(b.category.change_seq),
  'Category retirement failed to update only its own metadata');
  const before = (await rows(b, 'tasks')).find(t => t.id === b.task.id);
  assert(before?.category_id === retired.id && before.is_deleted === false,
    'Retirement deleted or moved a live task');

  const foreign = ensureOk(await cas(a, 'category', retired, {
    retired_on: '',
  }), 'Foreign retirement CAS');
  assert(foreign === null || (typeof foreign === 'object' &&
    Object.values(foreign).every(x => x === null)),
  'Foreign owner changed another account\'s retired category');
  onProgress({ stage: 'category-atomic-delete', runId });
  const tombstone = ensureOk(await cas(b, 'category', retired, {
    is_deleted: true,
  }), 'Signed atomic category deletion');
  assert(tombstone.owner_id === b.id && tombstone.id === retired.id &&
    tombstone.is_deleted === true && tombstone.retired_on === '2026-10-28' &&
    BigInt(tombstone.change_seq) > BigInt(retired.change_seq),
  'Category deletion failed or lost retirement metadata');
  const after = (await rows(b, 'tasks')).find(t => t.id === b.task.id);
  assert(after?.is_deleted === true && after.category_id === retired.id &&
    BigInt(after.change_seq) > BigInt(before.change_seq),
  'Atomic deletion did not cascade task tombstone in the same owner');
  const ownCategories = await rows(b, 'categories');
  assert(ownCategories.find(c => c.id === retired.id)?.is_deleted === true,
    'Deleted category was resurrected by cascade');

  const resurrection = await cas(b, 'category', tombstone, {
    is_deleted: false,
  });
  assert(resurrection?.ok === false && resurrection?.data?.code === '23514',
    'Forbidden category resurrection was not rejected by server constraint');
  const newTask = await api('/rest/v1/mosaic_candidate_tasks', {
    token: b.token,
    body: {
      owner_id: b.id, id: rejectedTask(runId), title: 'Refuse deleted category',
      category_id: retired.id, order_index: 0, task_date: '2026-10-28',
      created_at: '2026-10-28', updated_at: '2026-10-28',
    },
  });
  assert(newTask?.ok === false && newTask?.data?.code === '23503',
    'Deleted-category assignment was not rejected by FK/trigger');
  assert((await rows(b, 'tasks')).every(t => t.id !== rejectedTask(runId)),
    'Rejected category assignment left a live task');
  assert((await rows(a, 'tasks')).every(t => t.owner_id === a.id) &&
    (await rows(a, 'categories')).every(c => c.owner_id === a.id),
  'Atomic deletion crossed into another owner');
  onProgress({ stage: 'category-verified', runId });
  return { retiredMetadataPreserved: true, atomicCascade: true,
    resurrectionDenied: true, deletedAssignmentDenied: true, crossOwnerUnchanged: true };
}
