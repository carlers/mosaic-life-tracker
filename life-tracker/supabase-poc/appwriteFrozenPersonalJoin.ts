/**
 * #1027 no-network, source-only seven-domain identity/content join.
 *
 * Each scanner independently checks signed owner access and an externally
 * server-issued read-only writer lease. This module verifies that their
 * returned readbacks agree on the EXACT lease, installation, identities,
 * tombstones and source hashes. It is NOT an authenticating archive signer,
 * photo binary snapshot, server writer-fence or permission to cut over.
 */
import { createHash } from 'node:crypto';
import type { AppwriteHistoryReadback } from './appwriteOwnerHistoryRead';
import type {
  FrozenPersonalSnapshot, PersonalDomain, FrozenPersonalRow,
} from './appwritePersonalSourceRead';

const DOMAINS: readonly PersonalDomain[] =
  ['tasks', 'categories', 'diary', 'settings'];
const HISTORICAL = ['tasks', 'buckets', 'links'] as const;
const SHA = /^[a-f0-9]{64}$/;
function sha(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
function rowsHash(rows: readonly unknown[]) {
  const hash = createHash('sha256');
  for (const row of rows) {
    const json = JSON.stringify(row);
    hash.update(Buffer.byteLength(json, 'utf8').toString(10) + ':');
    hash.update(json, 'utf8');
  }
  return hash.digest('hex');
}
function orderedOwner(rows: readonly {id: string; userId: string; isDeleted: boolean}[],
    owner: string, domain: string) {
  let previous = '';
  if (!Array.isArray(rows)) throw new Error('Missing owner ' + domain + ' data');
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id ||
        row.id <= previous || row.userId !== owner ||
        typeof row.isDeleted !== 'boolean')
      throw new Error('Foreign, duplicate, or unsorted owner history in ' + domain);
    previous = row.id;
  }
}
function assertCount(value: unknown, actual: number, domain: string) {
  if (!Number.isSafeInteger(value) || value !== actual || actual > 250_000)
    throw new Error('Frozen owner history count mismatch for ' + domain);
}
function sameIdentity(a: FrozenPersonalRow, b: {
  id: string; userId: string; isDeleted: boolean;
}) {
  return a.id === b.id && a.userId === b.userId &&
    a.isDeleted === b.isDeleted;
}

/**
 * A second source reader cannot silently replace deleted records or link
 * different account epochs to task content. The caller must independently
 * verify the actual source FREEZE lease and encrypted source archive before
 * this proof can be used in a migration tool.
 */
export function joinFrozenAppwriteOwnerSources(input: {
  personal: FrozenPersonalSnapshot;
  history: AppwriteHistoryReadback;
}) {
  const personal = input?.personal;
  const history = input?.history;
  if (!personal || !history || personal.completeSourceArchive !== false ||
      personal.providerCutoverEligible !== false)
    throw new Error('Appwrite owner join needs two separately fenced preliminary snapshots');
  if (!personal.identity || !history.owner ||
      personal.identity.legacyUserId !== history.owner.legacyUserId ||
      personal.identity.supabaseUserId !== history.owner.supabaseUserId ||
      !personal.identity.legacyUserId ||
      !personal.identity.supabaseUserId)
    throw new Error('Appwrite owner source identity mapping mismatch');
  if (!personal.sourceDeploymentId ||
      personal.sourceDeploymentId !== history.sourceDeploymentId ||
      !personal.leaseId || personal.leaseId !== history.leaseId ||
      !personal.generation || personal.generation !== history.generation)
    throw new Error('Appwrite owner source installation or frozen lease mismatch');
  const owner = personal.identity.legacyUserId;
  if (!personal.originalOwnerCounts || !personal.sourceOwnerCounts ||
      !personal.fingerprintSha256 || !personal.rows ||
      !history.expectedCounts || !history.fingerprints)
    throw new Error('Incomplete seven-domain owner source witness');
  for (const domain of DOMAINS) {
    const rows = personal.rows[domain];
    orderedOwner(rows, owner, domain);
    assertCount(personal.originalOwnerCounts[domain], rows.length, domain);
    if (!SHA.test(personal.fingerprintSha256[domain]) ||
        rowsHash(rows) !== personal.fingerprintSha256[domain])
      throw new Error('Appwrite personal source content changed after signed readback: ' + domain);
  }
  for (const domain of HISTORICAL) {
    const rows = history[domain];
    orderedOwner(rows, owner, domain);
    assertCount(history.expectedCounts[domain], rows.length, domain);
    assertCount(personal.sourceOwnerCounts[domain], rows.length, domain);
    if (!SHA.test(history.fingerprints[domain]) ||
        rowsHash(rows) !== history.fingerprints[domain])
      throw new Error('Appwrite historical source changed after signed readback: ' + domain);
  }
  if (personal.originalOwnerCounts.tasks !==
      personal.sourceOwnerCounts.tasks ||
      personal.originalOwnerCounts.tasks !== history.expectedCounts.tasks)
    throw new Error('Frozen Appwrite task identity/content totals disagree');
  for (let i = 0; i < history.tasks.length; i++) {
    if (!sameIdentity(personal.rows.tasks[i], history.tasks[i]))
      throw new Error('Task identity/tombstone mismatch across source snapshots');
  }
  const scan = {
    deployment: personal.sourceDeploymentId,
    owner, generation: personal.generation,
    originalOwnerCounts: personal.originalOwnerCounts,
    sourceOwnerCounts: personal.sourceOwnerCounts,
    fingerprintSha256: personal.fingerprintSha256,
  };
  if (!SHA.test(personal.scanSha256) || sha(scan) !== personal.scanSha256)
    throw new Error('Appwrite personal source summary checksum changed');
  return {
    owner: { ...personal.identity },
    sourceDeploymentId: personal.sourceDeploymentId,
    leaseId: personal.leaseId,
    generation: personal.generation,
    counts: {
      tasks: history.tasks.length, categories: personal.rows.categories.length,
      diary: personal.rows.diary.length, settings: personal.rows.settings.length,
      buckets: history.buckets.length, links: history.links.length,
    },
    taskIdentitySha256: rowsHash(history.tasks),
    sevenDomainScanSha256: sha({
      personal: personal.scanSha256, historical: history.fingerprints,
      leaseId: personal.leaseId, owner, generation: personal.generation,
    }),
    /** An in-memory cross-read consistency result, not a frozen archive. */
    fullEncryptedSourceAuthenticated: false as const,
    providerCutoverEligible: false as const,
  };
}
