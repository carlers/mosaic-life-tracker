/** #1027 source-only owner-private historical task-link classification.
 * No network, data export, logging, file IO, or runtime activation.
 */
import { createHash } from 'node:crypto';
import type { BucketListDocument, BucketTaskLinkDocument, TaskDocument } from '../src/db/schema';
import { validateCandidateIdentity, type CandidateIdentity } from './candidateMapping';
import { toCandidateBucketWrite, toCandidateBucketLinkWrite } from './candidateBucketMapping';

const SHORT_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const HISTORIC_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;
const LIMIT = 250_000;
type TaskTarget = Pick<TaskDocument, 'id' | 'userId' | 'isDeleted'>;
export type LinkHistoryReason = 'missing-bucket' | 'missing-task' | 'deleted-bucket' |
  'deleted-task' | 'long-task-reference';
export type LinkHistoryDisposition = 'ready' | 'tombstone' | 'quarantined';
export type LinkHistoryClassification = {
  /** Original record is preserved byte-for-byte, including tombstone and IDs. */
  source: BucketTaskLinkDocument;
  disposition: LinkHistoryDisposition;
  reasons: LinkHistoryReason[];
};

function ownerIndex<T extends { id: string; userId: string; isDeleted: boolean }>(
  rows: readonly T[], ownerId: string, validate: (row: T) => void,
): Map<string, T> {
  if (!Array.isArray(rows) || rows.length > LIMIT)
    throw new Error('Historical owner inventory is missing or too large');
  const found = new Map<string, T>();
  for (const row of rows) {
    if (!row || row.userId !== ownerId || typeof row.isDeleted !== 'boolean')
      throw new Error('Historical owner inventory contains a foreign or invalid row');
    validate(row);
    if (found.has(row.id)) throw new Error('Duplicate historical owner inventory ID');
    found.set(row.id, row);
  }
  return found;
}

/** Input arrays MUST be full, independently verified signed-owner inventories.
 * expectedCounts are external source count proofs (including tombstones).
 * Never treat an active-only user ZIP as a complete historical source.
 */
export function classifyOwnerBucketLinkHistory(input: {
  identity: CandidateIdentity;
  tasks: readonly TaskTarget[];
  buckets: readonly BucketListDocument[];
  links: readonly BucketTaskLinkDocument[];
  expectedCounts: { tasks: number; buckets: number; links: number };
}): LinkHistoryClassification[] {
  validateCandidateIdentity(input.identity);
  const owner = input.identity;
  const tasks = ownerIndex(input.tasks, owner.legacyUserId, task => {
    if (!HISTORIC_TASK_ID.test(task.id)) throw new Error('Invalid historical task ID');
  });
  const buckets = ownerIndex(input.buckets, owner.legacyUserId, bucket => {
    toCandidateBucketWrite(bucket, owner);
  });
  const links = ownerIndex(input.links, owner.legacyUserId, link => {
    toCandidateBucketLinkWrite(link, owner);
  });
  for (const [kind, size] of [['tasks', tasks.size], ['buckets', buckets.size],
    ['links', links.size]] as const) {
    const count = input.expectedCounts?.[kind];
    if (!Number.isSafeInteger(count) || count !== size || size > LIMIT)
      throw new Error('Incomplete signed historical ' + kind + ' owner source');
  }
  return Array.from(links.values()).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(link => {
    const bucket = buckets.get(link.bucketListId);
    const task = tasks.get(link.taskId);
    const reasons: LinkHistoryReason[] = [];
    if (!bucket) reasons.push('missing-bucket');
    if (!task) reasons.push('missing-task');
    if (!SHORT_ID.test(link.taskId)) reasons.push('long-task-reference');
    if (!link.isDeleted && bucket?.isDeleted) reasons.push('deleted-bucket');
    if (!link.isDeleted && task?.isDeleted) reasons.push('deleted-task');
    return {
      source: { ...link },
      disposition: reasons.length ? 'quarantined' :
        link.isDeleted ? 'tombstone' : 'ready',
      reasons,
    };
  });
}

/**
 * Pure manifest constructor for the separately age-encrypted offline operator
 * path. `sourceArchiveSha256` MUST come from the independently authenticated
 * complete owner source artifact, not from a regular active-only user ZIP.
 * The hash here binds target identities, not their full task contents.
 */
export function packOwnerBucketHistory(
  input: Parameters<typeof classifyOwnerBucketLinkHistory>[0] & {
    sourceArchiveSha256: string;
  },
) {
  if (!/^[a-f0-9]{64}$/.test(input.sourceArchiveSha256))
    throw new Error('Full owner source needs an independently checked encrypted SHA256');
  const links = classifyOwnerBucketLinkHistory(input);
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en');
  const targetIds = {
    tasks: input.tasks.map(t => ({ id: t.id, userId: t.userId, isDeleted: t.isDeleted })).sort(byId),
    buckets: input.buckets.map(b => ({ id: b.id, userId: b.userId, isDeleted: b.isDeleted })).sort(byId),
  };
  const targetIdentitySha256 = createHash('sha256')
    .update(JSON.stringify(targetIds), 'utf8').digest('hex');
  return {
    format: 'mosaic-owner-bucket-link-history' as const, version: 1 as const,
    owner: {
      legacyUserId: input.identity.legacyUserId,
      supabaseUserId: input.identity.supabaseUserId,
    },
    sourceArchiveSha256: input.sourceArchiveSha256,
    sourceCounts: { ...input.expectedCounts },
    targetIdentitySha256,
    links,
  };
}
