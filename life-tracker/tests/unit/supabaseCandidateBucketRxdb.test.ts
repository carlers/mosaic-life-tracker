import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import {
  CandidateBucketTargetsPendingError, toCandidateBucketWrite, toCandidateBucketLinkWrite,
} from '../../supabase-poc/candidateBucketMapping';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import {
  CandidatePendingConflictError, createCandidateRxdbPilot,
} from '../../supabase-poc/candidateRxdbPilot';
import { CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';

const { replicate } = vi.hoisted(() => ({ replicate: vi.fn() }));
vi.mock('rxdb/plugins/replication', () => ({ replicateRxCollection: replicate }));
const owner: CandidateIdentity = {
  legacyUserId: 'legacy_owner', supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const other: CandidateIdentity = {
  legacyUserId: 'legacy_foreign', supabaseUserId: '22222222-2222-4222-8222-222222222222',
};
const bucket: BucketListDocument & { _deleted: false } = {
  id: 'goal_1', userId: owner.legacyUserId,
  title: 'Climb the mountain', description: 'Personal dream',
  achieved: false, achievedAt: '', createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T11:00:00Z', isDeleted: false, _deleted: false,
};
const edited = { ...bucket, title: 'Climbed 🗻', achieved: true,
  achievedAt: '2026-10-25T11:00:00Z', updatedAt: '2026-10-25T11:00:00Z' };
const link: BucketTaskLinkDocument & { _deleted: false } = {
  id: 'link_1', userId: owner.legacyUserId, bucketListId: bucket.id,
  taskId: 'task_1', createdAt: bucket.createdAt, updatedAt: bucket.updatedAt,
  isDeleted: false, _deleted: false,
};
const linkedTombstone = { ...link, isDeleted: true, updatedAt: edited.updatedAt };
const rev = '9007199254740993', newer = '9007199254740994';
const bucketRow = (doc: BucketListDocument = bucket, change_seq = rev) => ({
  ...toCandidateBucketWrite(doc, owner), change_seq, server_updated_at: edited.updatedAt,
});
const linkRow = (doc: BucketTaskLinkDocument = link, change_seq = rev) => ({
  ...toCandidateBucketLinkWrite(doc, owner), change_seq, server_updated_at: edited.updatedAt,
});
const references = () => ({
  buckets: new Map([[bucket.id, { userId: owner.legacyUserId, isDeleted: false }]]),
  tasks: new Map([[link.taskId, { userId: owner.legacyUserId, isDeleted: false }]]),
});
function setup(domain: 'buckets' | 'bucket_task_links', withInventory = true, collection?: unknown) {
  let user = { userId: owner.supabaseUserId, accessToken: 'owner-token', sessionEpoch: 1 };
  const session = { getVerifiedSession: vi.fn(async () => user) };
  const changes = { listChanges: vi.fn().mockResolvedValue([]) };
  const writer = {
    readBucketMaster: vi.fn().mockResolvedValue(null),
    readBucketLinkMaster: vi.fn().mockResolvedValue(null),
    createBucket: vi.fn().mockResolvedValue({ state: 'created', row: bucketRow(), revision: rev }),
    createBucketLink: vi.fn().mockResolvedValue({ state: 'created', row: linkRow(), revision: rev }),
  };
  const cas = { compareAndSet: vi.fn().mockResolvedValue({ state: 'applied',
    row: bucketRow(edited, newer), revision: newer }) };
  const targets = vi.fn(async () => references());
  const pilot = createCandidateRxdbPilot<BucketListDocument | BucketTaskLinkDocument>({
    domain, identity: owner, session, changes, writer: writer as never, cas: cas as never,
    collection: collection as never,
    ...(withInventory ? { verifyBucketLinkTargets: targets } : {}),
  });
  const push = (doc: BucketListDocument | BucketTaskLinkDocument, assumed?: typeof doc) =>
    pilot.push([{ newDocumentState: doc, assumedMasterState: assumed }] as never);
  return { pilot, push, changes, writer, cas, targets, session,
    switchToForeign: () => { user = {
      userId: other.supabaseUserId, accessToken: 'foreign-token', sessionEpoch: 2,
    }; },
  };
}
beforeEach(() => vi.clearAllMocks());

describe('source-only owner-private Bucket List RxDB pilot (#1027)', () => {
  it('pulls signed goal revisions and logical tombstones without physical RxDB delete', async () => {
    const h = setup('buckets');
    h.changes.listChanges.mockResolvedValueOnce([
      { ...bucketRow(), is_deleted: true },
    ]);
    expect(await h.pilot.pull({ changeSeq: '9007199254740992' }, 10)).toEqual({
      documents: [{ ...bucket, isDeleted: true, _deleted: false }],
      checkpoint: { changeSeq: rev },
    });
    expect(h.changes.listChanges).toHaveBeenCalledWith({
      domain: 'buckets', ownerId: owner.supabaseUserId,
      afterExclusive: '9007199254740992', batchSize: 10,
    });
  });

  it('creates owner-private goals once and compares signed server fields before ack', async () => {
    const h = setup('buckets');
    await expect(h.push(bucket)).resolves.toEqual([]);
    expect(h.writer.createBucket).toHaveBeenCalledWith(bucket, owner);
    expect(h.writer.readBucketMaster).toHaveBeenCalledOnce();
    expect(h.cas.compareAndSet).not.toHaveBeenCalled();
  });

  it('CAS edits only the allowlisted achieved, description and deletion fields at exact bigint revision', async () => {
    const h = setup('buckets');
    h.writer.readBucketMaster.mockResolvedValue(bucketRow());
    h.cas.compareAndSet.mockResolvedValue({ state: 'applied',
      row: bucketRow(edited, newer), revision: newer });
    await expect(h.push(edited, bucket)).resolves.toEqual([]);
    expect(h.cas.compareAndSet).toHaveBeenCalledWith({
      domain: 'buckets', ownerId: owner.supabaseUserId, documentId: bucket.id,
      expectedRevision: rev,
      patch: { title: edited.title, description: edited.description,
        achieved: true, achieved_at: edited.achievedAt,
        updated_at: edited.updatedAt, is_deleted: false },
    });
  });

  it('parks a changed original creation timestamp and never sends a CAS', async () => {
    const h = setup('buckets');
    h.writer.readBucketMaster.mockResolvedValue(bucketRow());
    await expect(h.push({ ...edited, createdAt: edited.updatedAt }, bucket))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.cas.compareAndSet).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()).toEqual([
      expect.objectContaining({ reason: 'protected-field-change', documentId: bucket.id }),
    ]);
  });

  it('refuses foreign remote masters and invalid inserts without acknowledging owner drafts', async () => {
    const h = setup('buckets');
    h.writer.readBucketMaster.mockResolvedValue({ ...bucketRow(), owner_id: other.supabaseUserId });
    await expect(h.push(bucket)).rejects.toThrow(/foreign/);
    expect(h.cas.compareAndSet).not.toHaveBeenCalled();
    h.writer.readBucketMaster.mockResolvedValue(null);
    await expect(h.push({ ...bucket, userId: other.legacyUserId })).resolves.toEqual([]);
    expect(h.writer.createBucket).not.toHaveBeenCalled();
  });
});

describe('source-only owner-private Bucket task-link RxDB pilot (#1027)', () => {
  it('pulls signed link tombstones and preserves original task IDs', async () => {
    const h = setup('bucket_task_links');
    h.changes.listChanges.mockResolvedValueOnce([linkRow(linkedTombstone)]);
    await expect(h.pilot.pull(undefined, 20)).resolves.toEqual({
      documents: [{ ...linkedTombstone, _deleted: false }],
      checkpoint: { changeSeq: rev },
    });
    expect(h.changes.listChanges).toHaveBeenCalledWith({
      domain: 'bucket_task_links', ownerId: owner.supabaseUserId,
      afterExclusive: '0', batchSize: 20,
    });
  });

  it('creates links only with explicitly verified same-owner target inventory', async () => {
    const h = setup('bucket_task_links');
    await expect(h.push(link)).resolves.toEqual([]);
    expect(h.targets).toHaveBeenCalledWith(link);
    expect(h.writer.createBucketLink).toHaveBeenCalledWith(link, owner, references());
    expect(h.cas.compareAndSet).not.toHaveBeenCalled();
  });

  it('retries an explicitly pending target without parking or acknowledging the link', async () => {
    const h = setup('bucket_task_links');
    h.targets.mockRejectedValueOnce(new CandidateBucketTargetsPendingError());
    await expect(h.push(link)).rejects.toBeInstanceOf(CandidateBucketTargetsPendingError);
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(h.writer.readBucketLinkMaster).not.toHaveBeenCalled();
    expect(h.writer.createBucketLink).not.toHaveBeenCalled();
    await expect(h.push(link)).resolves.toEqual([]);
    expect(h.writer.createBucketLink).toHaveBeenCalledWith(link, owner, references());
  });

  it('parks missing, deleted-active, foreign and long target IDs before remote master lookup', async () => {
    for (const form of ['missing', 'foreign', 'deleted', 'long', 'no-inventory'] as const) {
      const h = setup('bucket_task_links', form !== 'no-inventory');
      if (form === 'missing') h.targets.mockResolvedValue({
        ...references(), tasks: new Map(),
      });
      if (form === 'foreign') h.targets.mockResolvedValue({
        ...references(), tasks: new Map([[link.taskId, {
          userId: other.legacyUserId, isDeleted: false,
        }]]),
      });
      if (form === 'deleted') h.targets.mockResolvedValue({
        ...references(), tasks: new Map([[link.taskId, {
          userId: owner.legacyUserId, isDeleted: true,
        }]]),
      });
      await expect(h.push(form === 'long' ? { ...link, taskId: 'x'.repeat(70) } : link))
        .rejects.toBeInstanceOf(CandidatePendingConflictError);
      expect(h.writer.readBucketLinkMaster).not.toHaveBeenCalled();
      expect(h.writer.createBucketLink).not.toHaveBeenCalled();
      expect(h.cas.compareAndSet).not.toHaveBeenCalled();
      expect(h.pilot.listPendingConflicts()).toEqual([
        expect.objectContaining({ reason: 'protected-field-change' }),
      ]);
    }
  });

  it('permits a logical link tombstone with known, same-owner retired targets', async () => {
    const h = setup('bucket_task_links');
    h.targets.mockResolvedValue({
      buckets: new Map([[bucket.id, { userId: owner.legacyUserId, isDeleted: true }]]),
      tasks: new Map([[link.taskId, { userId: owner.legacyUserId, isDeleted: true }]]),
    });
    h.writer.createBucketLink.mockResolvedValue({
      state: 'created', row: linkRow(linkedTombstone), revision: rev,
    });
    await expect(h.push(linkedTombstone)).resolves.toEqual([]);
    expect(h.writer.createBucketLink).toHaveBeenCalledOnce();
  });

  it('requires immutable original target IDs and exact expected references on link CAS', async () => {
    const h = setup('bucket_task_links');
    h.writer.readBucketLinkMaster.mockResolvedValue(linkRow());
    h.cas.compareAndSet.mockResolvedValue({ state: 'applied',
      row: linkRow(linkedTombstone, newer), revision: newer });
    await expect(h.push(linkedTombstone, link)).resolves.toEqual([]);
    expect(h.cas.compareAndSet).toHaveBeenCalledWith({
      domain: 'bucket_task_links', ownerId: owner.supabaseUserId, documentId: link.id,
      expectedRevision: rev,
      patch: { updated_at: linkedTombstone.updatedAt, is_deleted: true },
      expectedLinkReferences: { bucketListId: link.bucketListId, taskId: link.taskId },
    });
    h.cas.compareAndSet.mockClear();
    await expect(h.push({ ...linkedTombstone, taskId: 'task_2' }, link))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.cas.compareAndSet).not.toHaveBeenCalled();
  });

  it('rejects corrupt signed remote link targets before acknowledging read or master', async () => {
    const h = setup('bucket_task_links');
    h.changes.listChanges.mockResolvedValueOnce([
      { ...linkRow(), task_id: 'x'.repeat(70) },
    ]);
    await expect(h.pilot.pull(undefined, 10)).rejects.toThrow(/quarantine|reference/);
    h.writer.readBucketLinkMaster.mockResolvedValue({
      ...linkRow(), task_id: 'x'.repeat(70),
    });
    await expect(h.push(link)).rejects.toThrow(/reference/);
    expect(h.writer.createBucketLink).not.toHaveBeenCalled();
  });

  it('fences account replacement after asynchronous target inventory and never sends owner write', async () => {
    const h = setup('bucket_task_links');
    h.targets.mockImplementationOnce(async () => {
      h.switchToForeign();
      return references();
    });
    await expect(h.push(link)).rejects.toBeInstanceOf(CandidateAuthError);
    expect(h.writer.readBucketLinkMaster).not.toHaveBeenCalled();
    expect(h.cas.compareAndSet).not.toHaveBeenCalled();
  });

  it('does not activate replication without an explicitly isolated collection and target proof', () => {
    const h = setup('bucket_task_links', false);
    expect(() => h.pilot.start({ name: 'isolated_links' } as never))
      .toThrow(/target inventory/);
    const guarded = setup('bucket_task_links');
    expect(() => guarded.pilot.start()).toThrow(/collection required/);
    replicate.mockReturnValue({ reSync: vi.fn(), cancel: vi.fn().mockResolvedValue(true) });
    const started = guarded.pilot.start({ name: 'isolated_bucket_links' } as never);
    expect(replicate.mock.calls[0][0].replicationIdentifier)
      .toBe('mosaic-supabase-poc-v1:bucket_task_links:' +
        owner.legacyUserId + ':' + owner.supabaseUserId);
    expect(started.resync).toBeTypeOf('function');
  });
});
