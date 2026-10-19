import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument } from '../../src/db/schema';
import {
  type CandidateCategoryRow, type CandidateIdentity, toCandidateCategoryWrite,
} from '../../supabase-poc/candidateMapping';
import {
  CandidatePendingConflictError, createCandidateRxdbPilot,
} from '../../supabase-poc/candidateRxdbPilot';
import { CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';

const { replicate } = vi.hoisted(() => ({ replicate: vi.fn() }));
vi.mock('rxdb/plugins/replication', () => ({
  replicateRxCollection: replicate,
}));

const alice: CandidateIdentity = {
  legacyUserId: 'legacy_alice',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const bob: CandidateIdentity = {
  legacyUserId: 'legacy_bob',
  supabaseUserId: '22222222-2222-4222-8222-222222222222',
};
const initial: CategoryDocument & { _deleted: false } = {
  id: 'category_a', userId: alice.legacyUserId, name: 'Old', color: '#123456',
  order: 0, visibility: 'private', icon: '', updatedAt: '2026-10-19',
  isDeleted: false, _deleted: false,
};
const changed = { ...initial, name: 'New', updatedAt: '2026-10-20' };
function row(doc = initial, revision = '1'): CandidateCategoryRow {
  return { ...toCandidateCategoryWrite(doc, alice), change_seq: revision, server_updated_at: 'today' };
}
function makeHarness() {
  const readCategoryMaster = vi.fn<(id: string) => Promise<CandidateCategoryRow | null>>()
    .mockResolvedValue(null);
  const createCategory = vi.fn().mockResolvedValue({
    state: 'created', row: row(), revision: '1',
  });
  const compareAndSet = vi.fn().mockResolvedValue({
    state: 'applied', row: row(changed, '2'), revision: '2',
  });
  const listChanges = vi.fn().mockResolvedValue([]);
  let verified: {userId: string; accessToken: string; sessionEpoch: number} | null = {
    userId: alice.supabaseUserId, accessToken: 'signed-token', sessionEpoch: 1,
  };
  const session = { getVerifiedSession: vi.fn(async () => verified) };
  const writer = {
    readCategoryMaster, createCategory,
    readTaskMaster: vi.fn(), createTask: vi.fn(),
  };
  const pilot = createCandidateRxdbPilot<CategoryDocument>({
    domain: 'categories', identity: alice, session,
    changes: { listChanges },
    writer: writer as never,
    cas: { compareAndSet } as never,
  });
  const push = (next = initial, assumed?: typeof initial) =>
    pilot.push([{ newDocumentState: next, assumedMasterState: assumed }] as never);
  return {
    pilot, push, session, writer, readCategoryMaster, createCategory,
    compareAndSet, listChanges,
    switchTo(id: string | null, epoch = 2) {
      verified = id ? { userId: id, accessToken: 'different-token', sessionEpoch: epoch } : null;
    },
  };
}
beforeEach(() => vi.clearAllMocks());

describe('isolated Supabase RxDB native replication bridge (#967)', () => {
  it('creates a new row once and confirms its exact authoritative representation', async () => {
    const h = makeHarness();
    await expect(h.push()).resolves.toEqual([]);
    expect(h.createCategory).toHaveBeenCalledTimes(1);
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('replays ambiguous already-applied new rows without duplicate remote writes', async () => {
    const h = makeHarness();
    h.readCategoryMaster.mockResolvedValue(row());
    await expect(h.push()).resolves.toEqual([]);
    expect(h.createCategory).not.toHaveBeenCalled();
  });

  it('blocks divergent bootstrap, duplicate-ID, or assumed-master conflicts; never discards local edits', async () => {
    const h = makeHarness();
    h.readCategoryMaster.mockResolvedValue(row(changed, '2'));
    await expect(h.push(initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.compareAndSet).not.toHaveBeenCalled();

    h.readCategoryMaster.mockResolvedValue(null);
    h.createCategory.mockResolvedValueOnce({
      state: 'conflict', row: row(changed, '2'), revision: '2',
    });
    await expect(h.push(initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);

    h.readCategoryMaster.mockResolvedValue(row(changed, '2'));
    await expect(h.push(initial, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
  });

  it('updates an assumed unchanged master via server-revision CAS without client cursor writes', async () => {
    const h = makeHarness();
    h.readCategoryMaster.mockResolvedValue(row(initial, '9007199254740993'));
    h.compareAndSet.mockResolvedValue({
      state: 'applied', revision: '9007199254740994',
      row: row(changed, '9007199254740994'),
    });
    await expect(h.push(changed, initial)).resolves.toEqual([]);
    const arg = h.compareAndSet.mock.calls[0][0];
    expect(arg).toMatchObject({
      domain: 'categories', ownerId: alice.supabaseUserId, documentId: initial.id,
      expectedRevision: '9007199254740993',
      patch: {
        name: 'New', updated_at: '2026-10-20',
        is_deleted: false,
      },
    });
    expect(arg.patch).not.toHaveProperty('owner_id');
    expect(arg.patch).not.toHaveProperty('id');
    expect(arg.patch).not.toHaveProperty('change_seq');
    expect(arg.patch).not.toHaveProperty('server_updated_at');
  });

  it('re-reads a CAS conflict to distinguish successful replay from unrelated remote changes', async () => {
    const h = makeHarness();
    h.readCategoryMaster
      .mockResolvedValueOnce(row(initial, '1'))
      .mockResolvedValueOnce(row(changed, '2'));
    h.compareAndSet.mockResolvedValue({ state: 'conflict' });
    await expect(h.push(changed, initial)).resolves.toEqual([]);

    h.readCategoryMaster
      .mockReset()
      .mockResolvedValueOnce(row(initial, '1'))
      .mockResolvedValueOnce(row({ ...initial, name: 'Other' }, '2'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
  });

  it('forbids physical deletes and future foreign-account writes', async () => {
    const h = makeHarness();
    await expect(h.push({ ...initial, _deleted: true } as never)).rejects.toThrow('Physical deletes');
    expect(h.readCategoryMaster).not.toHaveBeenCalled();
    await expect(h.push({ ...initial, userId: bob.legacyUserId })).resolves.toEqual([]);
    expect(h.readCategoryMaster).not.toHaveBeenCalled();
    await expect(h.pilot.push([{ newDocumentState: changed,
      assumedMasterState: { ...initial, userId: bob.legacyUserId } }] as never))
      .rejects.toThrow('Foreign assumed');
  });

  it('rejects account changes mid-pull, mid-push, and after a remote create', async () => {
    const h = makeHarness();
    h.listChanges.mockImplementationOnce(async () => {
      h.switchTo(bob.supabaseUserId);
      return [];
    });
    await expect(h.pilot.pull(undefined, 20)).rejects.toBeInstanceOf(CandidateAuthError);
    h.switchTo(alice.supabaseUserId, 3);
    h.createCategory.mockImplementationOnce(async () => {
      h.switchTo(null);
      return { state: 'created', row: row(), revision: '1' };
    });
    await expect(h.push()).rejects.toBeInstanceOf(CandidateAuthError);
  });

  it('maps pull pages and exact revisions to RxDB documents while preserving logical tombstones', async () => {
    const h = makeHarness();
    h.listChanges.mockResolvedValueOnce([
      { ...row(initial, '9007199254740993'), is_deleted: true },
    ]);
    await expect(h.pilot.pull(undefined, 100)).resolves.toEqual({
      documents: [{ ...initial, isDeleted: true, icon: undefined, _deleted: false }],
      checkpoint: { changeSeq: '9007199254740993' },
    });
    expect(h.listChanges.mock.calls[0][0]).toMatchObject({
      domain: 'categories', ownerId: alice.supabaseUserId,
      afterExclusive: '0', batchSize: 100,
    });
  });

  it('starts only on an explicitly supplied collection and uses native RxDB checkpoints', async () => {
    const h = makeHarness();
    expect(() => h.pilot.start()).toThrow('collection required');
    const cancel = vi.fn().mockResolvedValue(true);
    const reSync = vi.fn();
    replicate.mockReturnValue({ cancel, reSync });
    const local = { name: 'candidate_categories' } as never;
    const started = h.pilot.start(local);
    const options = replicate.mock.calls[0][0];
    expect(options.replicationIdentifier).toBe(
      'mosaic-supabase-poc-v1:categories:' + alice.legacyUserId + ':' + alice.supabaseUserId
    );
    expect(options.waitForLeadership).toBe(true);
    expect(options.live).toBe(true);
    expect(options.pull.batchSize).toBe(100);
    expect(options.push.batchSize).toBe(20);
    expect(options.push.initialCheckpoint).toBeUndefined();
    expect(options.pull.stream$).toBeDefined();
    expect(options.collection).toBe(local);
    expect(options.pull.handler).toBe(h.pilot.pull);
    expect(options.push.handler).toBe(h.pilot.push);
    started.resync();
    await started.stop();
    expect(reSync).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid push batches, malformed server owner and expired sessions', async () => {
    const h = makeHarness();
    await expect(h.pilot.push(Array.from({length: 21}, () => ({
      newDocumentState: initial,
    })) as never)).rejects.toThrow('batch');
    h.readCategoryMaster.mockResolvedValue({
      ...row(), owner_id: bob.supabaseUserId,
    });
    await expect(h.push()).rejects.toThrow('foreign');
    h.switchTo(null);
    await expect(h.pilot.pull(undefined, 1)).rejects.toBeInstanceOf(CandidateAuthError);
  });
});
