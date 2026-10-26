import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import {
  toCandidateBucketWrite, toCandidateBucketLinkWrite,
} from '../../supabase-poc/candidateBucketMapping';
import { packOwnerBucketHistory } from '../../supabase-poc/candidateBucketHistoryAudit';
import { verifyBucketLinkReplayParity } from '../../supabase-poc/candidateBucketReplayParity';

const identity: CandidateIdentity = {
  legacyUserId: 'original_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const other = '22222222-2222-4222-8222-222222222222';
const at = '2026-10-26T00:00:00Z';
const task = (id: string, isDeleted = false) =>
  ({ id, userId: identity.legacyUserId, isDeleted });
const bucket: BucketListDocument = {
  id: 'goal_1', userId: identity.legacyUserId,
  title: 'Learn piano', description: 'Private history', achieved: false,
  achievedAt: '', createdAt: at, updatedAt: at, isDeleted: false,
};
const link = (id: string, taskId: string, isDeleted = false): BucketTaskLinkDocument => ({
  id, userId: identity.legacyUserId, bucketListId: bucket.id, taskId,
  createdAt: at, updatedAt: at, isDeleted,
});
const source = {
  identity,
  tasks: [task('task_1'), task('task_2', true), task('x'.repeat(70))],
  buckets: [bucket],
  links: [
    link('link_1', 'task_1'),
    link('link_2', 'task_2', true),
    link('link_3', 'x'.repeat(70), true),
    link('link_4', 'missing'),
  ],
  expectedCounts: { tasks: 3, buckets: 1, links: 4 },
  sourceArchiveSha256: 'a'.repeat(64),
};
const bRow = (doc: BucketListDocument = bucket) => ({
  ...toCandidateBucketWrite(doc, identity),
  change_seq: '9007199254740993',
  server_updated_at: at,
});
const lRow = (doc: BucketTaskLinkDocument) => ({
  ...toCandidateBucketLinkWrite(doc, identity),
  change_seq: '9007199254740993',
  server_updated_at: at,
});
const target = {
  buckets: [bRow()],
  links: [lRow(source.links[0]), lRow(source.links[1])],
};
function sha(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
function check(
  overrides: Partial<Parameters<typeof verifyBucketLinkReplayParity>[0]> = {},
) {
  return verifyBucketLinkReplayParity({
    source,
    expectedManifestSha256: sha(packOwnerBucketHistory(source)),
    target,
    ...overrides,
  });
}

describe('source-only Bucket and link replay parity after independent owner readback (#1027)', () => {
  it('requires exact ready/tombstone records and separately retained quarantined originals', () => {
    const result = check();
    expect(result).toMatchObject({
      bucketCount: 1, linkedCount: 2, quarantinedCount: 2,
      tombstoneCount: 1, providerCutoverEligible: false,
    });
    expect(result.targetOwnerFieldsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.manifestSha256).toBe(sha(packOwnerBucketHistory(source)));
  });
  it('detects a missing remote link or a silent attempt to import an unsafe quarantined link', () => {
    expect(() => check({ target: {
      ...target, links: [target.links[0]],
    } })).toThrow(/count mismatch/);
    expect(() => check({ target: {
      ...target, links: [...target.links, lRow(source.links[2])],
    } })).toThrow(/count mismatch/);
    expect(() => check({ target: {
      ...target, links: [target.links[0], lRow(source.links[2])],
    } })).toThrow(/quarantined|Unexpected/);
  });
  it('refuses changed target task or Bucket reference even if total counts match', () => {
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], task_id: 'task_other' }, target.links[1]],
    } })).toThrow(/reference|source fields/);
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], bucket_list_id: 'goal_other' }, target.links[1]],
    } })).toThrow(/reference|source fields/);
  });
  it('refuses changed historical creation/update dates or tombstone status', () => {
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], created_at: '2026-10-25T00:00:00Z' }, target.links[1]],
    } })).toThrow(/source fields/);
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], is_deleted: true }, target.links[1]],
    } })).toThrow(/source fields/);
  });
  it('fails closed when a live Bucket goal is missing, changed, deleted or additional', () => {
    expect(() => check({ target: { ...target, buckets: [] } })).toThrow(/count mismatch/);
    expect(() => check({ target: {
      ...target, buckets: [{ ...target.buckets[0], title: 'Changed dream' }],
    } })).toThrow(/source fields/);
    expect(() => check({ target: {
      ...target, buckets: [{ ...target.buckets[0], is_deleted: true }],
    } })).toThrow(/source fields/);
    expect(() => check({ target: {
      ...target, buckets: [...target.buckets, bRow({ ...bucket, id: 'goal_extra' })],
    } })).toThrow(/count mismatch/);
  });
  it('never accepts wrong-owner, duplicated or malformed authoritative target revisions', () => {
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], owner_id: other }, target.links[1]],
    } })).toThrow(/owner/);
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], change_seq: '0' }, target.links[1]],
    } })).toThrow(/revision/);
    expect(() => check({ target: {
      ...target, links: [target.links[0], target.links[0]],
    } })).toThrow(/Duplicate/);
    expect(() => check({ target: {
      ...target, links: [{ ...target.links[0], server_updated_at: 'invalid' }, target.links[1]],
    } })).toThrow(/revision/);
  });
  it('rejects source tampering against an independently pinned original encrypted manifest', () => {
    expect(() => check({
      source: { ...source, links: [
        { ...source.links[0], taskId: 'task_other' },
        ...source.links.slice(1),
      ] },
    })).toThrow(/independently pinned encrypted manifest/);
    expect(() => check({ expectedManifestSha256: '0'.repeat(64) }))
      .toThrow(/independently pinned encrypted manifest/);
    expect(() => check({ source: {
      ...source, expectedCounts: { ...source.expectedCounts, links: 3 },
    } })).toThrow(/Incomplete/);
  });
  it('rejects foreign or duplicated original source records before any target comparison', () => {
    expect(() => check({ source: {
      ...source, links: [{ ...source.links[0], userId: 'foreign' }, ...source.links.slice(1)],
    } })).toThrow(/foreign/);
    expect(() => check({ source: {
      ...source, links: [source.links[0], source.links[0], ...source.links.slice(2)],
    } })).toThrow(/Duplicate/);
  });
  it('matches exact large bigint server revisions without treating them as client-owned data', () => {
    const result = check({ target: {
      buckets: [{ ...target.buckets[0], change_seq: '9007199254740999' }],
      links: target.links.map(row => ({ ...row, change_seq: '9007199254740999' })),
    } });
    expect(result).toMatchObject({ bucketCount: 1, linkedCount: 2 });
  });
});
