/**
 * #1027 source-only, no-network owner-private Bucket/link replay equality.
 * This is not an import, writer lease, signed SQL reader or cutover permit.
 * Both source snapshot and target arrays MUST come from separately verified
 * owner-fenced read paths; an active-only user ZIP cannot provide the source.
 */
import { createHash } from 'node:crypto';
import type { BucketListDocument, BucketTaskLinkDocument, TaskDocument } from '../src/db/schema';
import type { CandidateIdentity } from './candidateMapping';
import { parseCandidateRevision } from './candidateMapping';
import {
  fromCandidateBucketRow, fromCandidateBucketLinkRow,
  toCandidateBucketWrite, toCandidateBucketLinkWrite,
  type CandidateBucketRow, type CandidateBucketLinkRow,
} from './candidateBucketMapping';
import {
  packOwnerBucketHistory, type LinkHistoryClassification,
} from './candidateBucketHistoryAudit';

const SHA = /^[a-f0-9]{64}$/;
type Source = {
  identity: CandidateIdentity;
  tasks: ReadonlyArray<Pick<TaskDocument, 'id' | 'userId' | 'isDeleted'>>;
  buckets: readonly BucketListDocument[];
  links: readonly BucketTaskLinkDocument[];
  expectedCounts: { tasks: number; buckets: number; links: number };
  sourceArchiveSha256: string;
};
type Target = {
  buckets: readonly CandidateBucketRow[];
  links: readonly CandidateBucketLinkRow[];
};
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
function verifiedRevision(row: CandidateBucketRow | CandidateBucketLinkRow): void {
  if (!row || typeof row.server_updated_at !== 'string' ||
      !row.server_updated_at.length || row.server_updated_at.length > 50 ||
      !Number.isFinite(Date.parse(row.server_updated_at)) ||
      parseCandidateRevision(row.change_seq) < 1n)
    throw new Error('Candidate replay target missing authoritative SQL revision/timestamp');
}
function requireExactSourceFields(left: unknown, right: unknown, label: string): void {
  if (JSON.stringify(left) !== JSON.stringify(right))
    throw new Error('Candidate replay changed ' + label + ' source fields');
}

/**
 * Recompute the full historical manifest before comparing mapped SQL rows.
 * A quarantined link MUST remain in encrypted source history and MUST NOT
 * appear as a current remote link. A ready link/tombstone MUST match the
 * original ID, owner, reference, creation/update time and deletion state.
 */
export function verifyBucketLinkReplayParity(input: {
  source: Source;
  expectedManifestSha256: string;
  target: Target;
}) {
  if (!input?.source || !input.target ||
      !SHA.test(input.expectedManifestSha256) ||
      !SHA.test(input.source.sourceArchiveSha256) ||
      !Array.isArray(input.target.buckets) ||
      !Array.isArray(input.target.links))
    throw new Error('Candidate replay requires independently pinned full owner evidence');
  const manifest = packOwnerBucketHistory(input.source);
  if (digest(manifest) !== input.expectedManifestSha256)
    throw new Error('Candidate replay source differs from independently pinned encrypted manifest');
  const { identity, buckets } = input.source;
  const classifications: LinkHistoryClassification[] = manifest.links;
  const accepted = classifications.filter(item => item.disposition !== 'quarantined');
  const quarantined = classifications.filter(item => item.disposition === 'quarantined');
  if (input.target.buckets.length !== buckets.length ||
      input.target.links.length !== accepted.length)
    throw new Error('Candidate replay target bucket/link count mismatch or unapproved quarantined import');
  const sourceBuckets = new Map(buckets.map(b => [b.id, b]));
  const sourceLinks = new Map(accepted.map(item => [item.source.id, item.source]));
  const targetBuckets = new Map<string, ReturnType<typeof toCandidateBucketWrite>>();
  const targetLinks = new Map<string, ReturnType<typeof toCandidateBucketLinkWrite>>();
  for (const row of input.target.buckets) {
    verifiedRevision(row);
    const doc = fromCandidateBucketRow(row, identity);
    if (targetBuckets.has(doc.id)) throw new Error('Duplicate restored Bucket goal identity');
    const original = sourceBuckets.get(doc.id);
    if (!original) throw new Error('Unexpected restored owner Bucket goal identity');
    const sourceWrite = toCandidateBucketWrite(original, identity);
    const restored = toCandidateBucketWrite(doc, identity);
    requireExactSourceFields(restored, sourceWrite, 'Bucket goal');
    targetBuckets.set(doc.id, restored);
  }
  for (const row of input.target.links) {
    verifiedRevision(row);
    const doc = fromCandidateBucketLinkRow(row, identity);
    if (targetLinks.has(doc.id)) throw new Error('Duplicate restored Bucket task-link identity');
    const original = sourceLinks.get(doc.id);
    if (!original) throw new Error('Unexpected or quarantined Bucket link restored to live table');
    const sourceWrite = toCandidateBucketLinkWrite(original, identity);
    const restored = toCandidateBucketLinkWrite(doc, identity);
    requireExactSourceFields(restored, sourceWrite, 'Bucket link original reference/tombstone');
    targetLinks.set(doc.id, restored);
  }
  if (targetBuckets.size !== buckets.length || targetLinks.size !== accepted.length)
    throw new Error('Candidate replay omitted expected owner Bucket/link rows');
  const sortKey = (a: {id:string}, b: {id:string}) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return {
    bucketCount: targetBuckets.size,
    linkedCount: targetLinks.size,
    quarantinedCount: quarantined.length,
    tombstoneCount: accepted.filter(item => item.disposition === 'tombstone').length,
    manifestSha256: input.expectedManifestSha256,
    targetOwnerFieldsSha256: digest({
      buckets: Array.from(targetBuckets.values()).sort(sortKey),
      links: Array.from(targetLinks.values()).sort(sortKey),
    }),
    /** Only one personal domain's offline equality, NEVER release approval. */
    providerCutoverEligible: false as const,
  };
}
