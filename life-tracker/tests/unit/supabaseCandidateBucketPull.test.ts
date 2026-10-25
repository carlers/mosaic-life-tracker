import { describe, expect, it, vi } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { toCandidateBucketWrite, toCandidateBucketLinkWrite,
  classifyCandidateLinkReferences } from '../../supabase-poc/candidateBucketMapping';
import { pullCandidateBuckets, pullCandidateBucketLinks } from '../../supabase-poc/candidatePull';
import { createCandidateHttpTransport, CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';

const owner: CandidateIdentity = {
  legacyUserId: 'legacy_bucket_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const other: CandidateIdentity = {
  legacyUserId: 'legacy_other',
  supabaseUserId: '22222222-2222-4222-8222-222222222222',
};
const bucket: BucketListDocument = {
  id: 'bucket_123', userId: owner.legacyUserId, title: 'Learn 🏊',
  description: 'Do not normalize 🌙', achieved: true,
  achievedAt: '2026-10-25T10:00:00Z', createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-10-25T11:00:00Z', isDeleted: false,
};
const link: BucketTaskLinkDocument = {
  id: 'link_123', userId: owner.legacyUserId,
  bucketListId: bucket.id, taskId: 'task_123',
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-10-25T11:00:00Z', isDeleted: true,
};
const bucketRow = {
  ...toCandidateBucketWrite(bucket, owner),
  change_seq: '9007199254740993', server_updated_at: '2026-10-25T11:02:00Z',
};
const linkRow = {
  ...toCandidateBucketLinkWrite(link, owner),
  change_seq: '9007199254740994', server_updated_at: '2026-10-25T11:03:00Z',
};
const signed = { userId: owner.supabaseUserId,
  accessToken: 'signed_bucket_owner_token', sessionEpoch: 3 };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function harness(rows: unknown[] = [bucketRow]) {
  const session = { getVerifiedSession: vi.fn().mockResolvedValue(signed) };
  const fetcher = vi.fn(async () => json(rows));
  const transport = createCandidateHttpTransport({
    baseUrl: 'https://synthetic.supabase.co',
    publishableKey: 'sb_publishable_synthetic_only', session,
    fetcher: fetcher as unknown as typeof fetch,
  });
  return { fetcher, session, transport };
}
describe('source-only signed Bucket List and link incremental read (#1027)', () => {
  it('reads exact private Bucket fields, tombstones and 64-bit cursor via bearer', async () => {
    const h = harness([{ ...bucketRow, is_deleted: true }]);
    const result = await pullCandidateBuckets({
      transport: h.transport, identity: owner,
      checkpoint: { changeSeq: '9007199254740992' }, batchSize: 20,
    });
    expect(result.documents).toEqual([{ ...bucket, isDeleted: true, _deleted: false }]);
    expect(result.checkpoint).toEqual({ changeSeq: '9007199254740993' });
    const [url,init] = h.fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/rest/v1/mosaic_candidate_buckets');
    expect(parsed.searchParams.get('owner_id')).toBe('eq.' + owner.supabaseUserId);
    expect(parsed.searchParams.get('change_seq')).toBe('gt.9007199254740992');
    expect(parsed.searchParams.get('order')).toBe('change_seq.asc');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store',
      headers: { Authorization: 'Bearer signed_bucket_owner_token' } });
    expect(h.session.getVerifiedSession).toHaveBeenCalledTimes(2);
  });

  it('reads stable linked task and link tombstones without physical RxDB delete', async () => {
    const h = harness([linkRow]);
    const result = await pullCandidateBucketLinks({
      transport: h.transport, identity: owner, batchSize: 10,
    });
    expect(result.documents).toEqual([{ ...link, _deleted: false }]);
    expect(result.checkpoint).toEqual({ changeSeq: linkRow.change_seq });
    const [signedUrl] = h.fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(signedUrl).pathname)
      .toBe('/rest/v1/mosaic_candidate_bucket_task_links');
    // A returned row is NOT proof that a local target exists. Its classification
    // must be explicit and owner-scoped before any future import/link writer.
    expect(classifyCandidateLinkReferences(link, owner, {
      buckets: new Map(), tasks: new Map(),
    })).toBe('tombstone');
    expect(classifyCandidateLinkReferences({ ...link, isDeleted: false }, owner, {
      buckets: new Map(), tasks: new Map(),
    })).toBe('quarantined');
  });

  it('preserves checkpoint on empty pages and validates full page before advancing', async () => {
    const original = { changeSeq: '9007199254740992' };
    await expect(pullCandidateBuckets({
      transport: harness([]).transport, identity: owner,
      checkpoint: original, batchSize: 10,
    })).resolves.toEqual({ documents: [], checkpoint: original });
    const bad = [bucketRow, { ...bucketRow, owner_id: other.supabaseUserId,
      id: 'foreign_456', change_seq: '9007199254740994' }];
    await expect(pullCandidateBuckets({
      transport: harness(bad).transport, identity: owner,
      checkpoint: original, batchSize: 10,
    })).rejects.toThrow(/foreign owner/);
  });

  it('rejects malformed owner, fields, tombstones, duplicates, and out-of-order revisions', async () => {
    for (const bad of [
      { ...bucketRow, title: null },
      { ...bucketRow, id: 'invalid-id' },
      { ...bucketRow, achieved: 'true' },
      { ...bucketRow, is_deleted: undefined },
      { ...bucketRow, change_seq: Number.MAX_SAFE_INTEGER + 1 },
      { ...bucketRow, change_seq: '0' },
    ]) {
      await expect(pullCandidateBuckets({
        transport: harness([bad]).transport, identity: owner, batchSize: 5,
      })).rejects.toThrow();
    }
    for (const bad of [
      { ...linkRow, owner_id: other.supabaseUserId },
      { ...linkRow, task_id: '../foreign' },
      { ...linkRow, task_id: 't'.repeat(70) },
      { ...linkRow, is_deleted: null },
    ]) {
      await expect(pullCandidateBucketLinks({
        transport: harness([bad]).transport, identity: owner, batchSize: 5,
      })).rejects.toThrow();
    }
    for (const rows of [
      [bucketRow, { ...bucketRow, change_seq: bucketRow.change_seq }],
      [bucketRow, { ...bucketRow, change_seq: '9007199254740992' }],
    ]) {
      await expect(pullCandidateBuckets({
        transport: harness(rows).transport, identity: owner, batchSize: 2,
      })).rejects.toThrow(/out of order or duplicated/);
    }
    await expect(pullCandidateBucketLinks({
      transport: harness([linkRow,linkRow]).transport,
      identity: owner, batchSize: 1,
    })).rejects.toThrow(/response size/);
  });

  it('rejects unsafe checkpoints and user identities before a backend request', async () => {
    const h = harness();
    await expect(pullCandidateBuckets({
      transport: h.transport, identity: { ...owner, supabaseUserId: 'spoofed' },
      batchSize: 10,
    })).rejects.toThrow();
    await expect(pullCandidateBuckets({
      transport: h.transport, identity: owner, batchSize: 0,
    })).rejects.toThrow();
    await expect(pullCandidateBucketLinks({
      transport: h.transport, identity: owner, batchSize: 10,
      checkpoint: { changeSeq: '-1' },
    })).rejects.toThrow();
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it('refuses owner switch or token replacement after the HTTP page arrives', async () => {
    for (const changed of [
      { ...signed, userId: other.supabaseUserId },
      { ...signed, accessToken: 'rotated_without_epoch' },
      { ...signed, sessionEpoch: signed.sessionEpoch + 1 },
    ]) {
      const h = harness([linkRow]);
      h.session.getVerifiedSession.mockResolvedValueOnce(signed)
        .mockResolvedValueOnce(changed);
      await expect(pullCandidateBucketLinks({
        transport: h.transport, identity: owner, batchSize: 1,
      })).rejects.toBeInstanceOf(CandidateAuthError);
    }
  });
});
