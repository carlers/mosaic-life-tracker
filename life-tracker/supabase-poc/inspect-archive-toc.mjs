#!/usr/bin/env node
// Read pg_restore --list metadata only. Never print archive rows or raw TOC.
const kinds = [
  'MATERIALIZED VIEW DATA', 'DEFAULT ACL', 'FK CONSTRAINT', 'TABLE DATA',
  'SEQUENCE SET', 'MATERIALIZED VIEW', 'EVENT TRIGGER', 'BLOB COMMENTS',
  'PUBLICATION TABLE', 'PUBLICATION', 'SUBSCRIPTION', 'CONSTRAINT', 'FUNCTION',
  'PROCEDURE', 'TRIGGER', 'POLICY', 'INDEX', 'TABLE', 'SEQUENCE', 'SCHEMA',
  'VIEW', 'TYPE', 'DOMAIN', 'ACL', 'COMMENT', 'EXTENSION',
];
const managed = new Set([
  'auth', 'realtime', 'storage', 'supabase_migrations', 'extensions',
  'graphql', 'graphql_public', 'vault', 'pgsodium', 'net',
]);
const personal = new Set(['mosaic_candidate_private', 'mosaic_poc_internal']);
const expected = ['mosaic_candidate_tasks', 'mosaic_candidate_categories'];
// A restorable core account needs more than auth.users: identity provider links,
// the trusted canonical-owner ledger, and server change-sequence high water.
// Session rows are visible separately but must not be treated as reusable tokens.
const criticalData = [
  ['auth', 'users'],
  ['auth', 'identities'],
  ['mosaic_candidate_private', 'core_authorities'],
  ['mosaic_candidate_private', 'owner_revisions'],
  ['public', 'mosaic_candidate_tasks'],
  ['public', 'mosaic_candidate_categories'],
];

export function summarizeToc(source) {
  const entries = [];
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*\d+;\s+\d+\s+\d+\s+(.+)$/.exec(line);
    if (!match) continue;
    const body = match[1];
    const kind = kinds.find((item) => body.startsWith(item + ' '));
    const remainder = kind ? body.slice(kind.length + 1) : '';
    const [schema, name] = remainder.split(/\s+/);
    entries.push({ kind: kind || 'UNKNOWN', schema, name });
  }
  if (entries.length === 0) {
    throw new Error('No PostgreSQL archive TOC entries recognized');
  }
  const mosaic = entries.filter((entry) => (
    personal.has(entry.schema) ||
    (entry.kind === 'SCHEMA' && personal.has(entry.name)) ||
    (entry.schema === 'public' && entry.name?.startsWith('mosaic_'))
  ));
  const platform = entries.filter((entry) => (
    managed.has(entry.schema) || (entry.kind === 'SCHEMA' && managed.has(entry.name))
  ));
  const isData = (entry) => entry.kind === 'TABLE DATA' || entry.kind === 'SEQUENCE SET';
  const missing = [];
  for (const name of expected) {
    for (const kind of ['TABLE', 'TABLE DATA']) {
      if (!entries.some((entry) =>
        entry.schema === 'public' && entry.name === name && entry.kind === kind)) {
        missing.push('public.' + name + ':' + kind);
      }
    }
  }
  const dataPresent = (schema, name) => entries.some((entry) =>
    entry.kind === 'TABLE DATA' && entry.schema === schema && entry.name === name);
  for (const [schema, name] of criticalData) {
    if (!dataPresent(schema, name)) {
      const item = `${schema}.${name}:TABLE DATA`;
      if (!missing.includes(item)) missing.push(item);
    }
  }
  const completeCritical = criticalData.filter(([schema, name]) =>
    dataPresent(schema, name)).length;
  const personalCandidateDataTables = entries.filter((entry) => entry.kind === 'TABLE DATA' &&
    entry.schema === 'public' && entry.name?.startsWith('mosaic_candidate_'))
    .map(entry => 'public.' + entry.name);
  return {
    identityRegistryDataTables: entries.filter(entry => entry.kind === 'TABLE DATA' &&
      entry.schema === 'mosaic_candidate_private' &&
      ['identity_installation', 'mosaic_accounts', 'provider_accounts', 'identity_audit'].includes(entry.name))
      .map(entry => 'mosaic_candidate_private.' + entry.name),
    privateDiaryDataEntryPresent: dataPresent('public', 'mosaic_candidate_diary'),
    personalSettingsDataEntryPresent: dataPresent('public', 'mosaic_candidate_settings'),
    bucketListDataEntryPresent: dataPresent('public', 'mosaic_candidate_buckets'),
    bucketTaskLinksDataEntryPresent: dataPresent('public', 'mosaic_candidate_bucket_task_links'),
    personalCandidateDataTables,
    status: missing.length ? 'INCOMPLETE_METADATA' : 'METADATA_ONLY_NOT_RESTORED',
    archiveTocEntries: entries.length,
    mosaicOwnedEntries: mosaic.length,
    mosaicOwnedDataEntries: mosaic.filter(isData).length,
    managedPlatformEntries: platform.length,
    managedPlatformDefinitionEntries: platform.filter((entry) => !isData(entry)).length,
    authUsersDataEntryPresent: dataPresent('auth', 'users'),
    authIdentitiesDataEntryPresent: dataPresent('auth', 'identities'),
    authSessionsDataEntryPresent: dataPresent('auth', 'sessions'),
    criticalDataEntriesPresent: completeCritical,
    criticalDataEntriesExpected: criticalData.length,
    otherEntries: entries.length - new Set([...mosaic, ...platform]).size,
    missingRequiredEntries: missing,
    restoresPerformed: 0,
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  let toc = '';
  for await (const piece of process.stdin) toc += piece;
  try {
    const report = summarizeToc(toc);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.missingRequiredEntries.length) process.exitCode = 1;
  } catch (error) {
    process.stderr.write('Archive TOC inventory failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
