import { describe, expect, it } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { classifyOwnerBucketLinkHistory } from '../../supabase-poc/candidateBucketHistoryAudit';

const identity: CandidateIdentity = {
  legacyUserId: 'legacy_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const foreign = 'legacy_foreign';
const now = '2026-10-26T01:00:00Z';
const bucket: BucketListDocument = {
  id: 'bucket_1', userId: identity.legacyUserId, title: 'Private dream',
  description: 'Unaltered original', achieved: false, achievedAt: '',
  createdAt: now, updatedAt: now, isDeleted: false,
};
const task = { id: 'task_1', userId: identity.legacyUserId, isDeleted: false };
const link: BucketTaskLinkDocument = {
  id: 'link_1', userId: identity.legacyUserId,
  bucketListId: bucket.id, taskId: task.id,
  createdAt: now, updatedAt: now, isDeleted: false,
};
function classify(overrides: Partial<Parameters<typeof classifyOwnerBucketLinkHistory>[0]> = {}) {
  return classifyOwnerBucketLinkHistory({
    identity, tasks: [task], buckets: [bucket], links: [link],
    expectedCounts: { tasks: 1, buckets: 1, links: 1 },
    ...overrides,
  });
}
describe('owner-private complete-history link classification (#1027)', () => {
  it('preserves exact ready source references without touching input objects', () => {
    const source = Object.freeze({ ...link });
    const rows = classify({ links: [source] });
    expect(rows).toEqual([{ source: link, disposition: 'ready', reasons: [] }]);
    expect(rows[0].source).not.toBe(source);
    expect(source).toEqual(link);
  });
  it('keeps tombstone links even when both owned target records were retired', () => {
    const deleted = { ...link, isDeleted: true };
    expect(classify({
      tasks: [{ ...task, isDeleted: true }],
      buckets: [{ ...bucket, isDeleted: true }],
      links: [deleted],
    })).toEqual([{ source: deleted, disposition: 'tombstone', reasons: [] }]);
  });
  it('quarantines missing targets even when the historical link is tombstoned', () => {
    const deleted = { ...link, isDeleted: true };
    expect(classify({
      tasks: [], buckets: [], links: [deleted],
      expectedCounts: { tasks: 0, buckets: 0, links: 1 },
    })).toEqual([{ source: deleted, disposition: 'quarantined',
      reasons: ['missing-bucket', 'missing-task'] }]);
  });
  it('keeps active links referencing deleted owner targets in the review inventory', () => {
    expect(classify({
      tasks: [{ ...task, isDeleted: true }],
      buckets: [{ ...bucket, isDeleted: true }],
    })).toEqual([{ source: link, disposition: 'quarantined',
      reasons: ['deleted-bucket', 'deleted-task'] }]);
  });
  it('preserves a valid 255-char Appwrite task ID instead of rewriting it', () => {
    const veryLong = 't'.repeat(255);
    const original = { ...link, taskId: veryLong };
    expect(classify({
      tasks: [{ ...task, id: veryLong }], links: [original],
    })).toEqual([{ source: original, disposition: 'quarantined',
      reasons: ['long-task-reference'] }]);
  });
  it('never reads foreign target records or emits their content', () => {
    const omittedForeignTaskLink = { ...link, taskId: 'foreign_task' };
    expect(classify({ links: [omittedForeignTaskLink] })).toEqual([{
      source: omittedForeignTaskLink, disposition: 'quarantined', reasons: ['missing-task'],
    }]);
    expect(() => classify({ tasks: [{ ...task, userId: foreign }] })).toThrow(/foreign/);
    expect(() => classify({ buckets: [{ ...bucket, userId: foreign }] })).toThrow(/foreign/);
    expect(() => classify({ links: [{ ...link, userId: foreign }] })).toThrow(/foreign/);
  });
  it('rejects omitted data when signed source count does not match', () => {
    expect(() => classify({
      expectedCounts: { tasks: 2, buckets: 1, links: 1 },
    })).toThrow(/Incomplete signed historical tasks/);
    expect(() => classify({
      expectedCounts: { tasks: 1, buckets: 1, links: 2 },
    })).toThrow(/Incomplete signed historical links/);
    expect(() => classify({
      expectedCounts: { tasks: 0, buckets: 1, links: 1 },
    })).toThrow(/Incomplete signed historical tasks/);
  });
  it('rejects duplicate identity rows and invalid source references', () => {
    expect(() => classify({ tasks: [task, task],
      expectedCounts: { tasks: 2, buckets: 1, links: 1 } })).toThrow(/Duplicate/);
    expect(() => classify({ links: [link, link],
      expectedCounts: { tasks: 1, buckets: 1, links: 2 } })).toThrow(/Duplicate/);
    expect(() => classify({ links: [{ ...link, taskId: '../outside' }] }))
      .toThrow(/Invalid historical/);
    expect(() => classify({ tasks: [{ ...task, isDeleted: 'false' as never }] }))
      .toThrow(/invalid/);
  });
  it('always sorts verified owner links by exact stable ID', () => {
    const a = { ...link, id: 'link_10' };
    const b = { ...link, id: 'link_2', isDeleted: true };
    const x = classify({ links: [b,a],
      expectedCounts: { tasks: 1, buckets: 1, links: 2 } });
    const y = classify({ links: [a,b],
      expectedCounts: { tasks: 1, buckets: 1, links: 2 } });
    expect(x).toEqual(y);
    expect(x.map(q => q.source.id)).toEqual(['link_10','link_2']);
    expect(x.map(q => q.disposition)).toEqual(['ready','tombstone']);
  });
  it('refuses oversized unreviewed inventories, not partial classifications', () => {
    expect(() => classify({ expectedCounts: {
      tasks: Number.MAX_SAFE_INTEGER, buckets: 1, links: 1,
    } })).toThrow();
    expect(() => classify({ expectedCounts: { tasks: -1, buckets: 1, links: 1 } }))
      .toThrow();
  });
});
