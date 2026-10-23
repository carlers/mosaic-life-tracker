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
function makeHarness(collection?: unknown) {
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
    collection: collection as never,
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

  it('accepts the signed SQL default retired_on on a newly created legacy category', async () => {
    const h = makeHarness();
    // RxDB v2 treats the new field as optional. PostgreSQL inserts '' as
    // column DEFAULT and returns it in the authoritative INSERT response.
    // That is not a competing device edit or an unresolved write.
    h.createCategory.mockResolvedValueOnce({
      state: 'created', row: { ...row(), retired_on: '' }, revision: '1',
    });
    await expect(h.push(initial)).resolves.toEqual([]);
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(h.createCategory).toHaveBeenCalledOnce();
  });

  it('accepts the same default on signed remote reads and category edits', async () => {
    const h = makeHarness();
    h.readCategoryMaster.mockResolvedValue({ ...row(initial, '1'), retired_on: '' });
    h.compareAndSet.mockResolvedValue({
      state: 'applied', row: { ...row(changed, '2'), retired_on: '' },
      revision: '2',
    });
    await expect(h.push(changed, initial)).resolves.toEqual([]);
    expect(h.compareAndSet).toHaveBeenCalledOnce();
    expect(h.compareAndSet.mock.calls[0][0].patch).not.toHaveProperty('retired_on');
    expect(h.pilot.listPendingConflicts()).toEqual([]);
  });

  it('still rejects a genuinely different retirement cutoff', async () => {
    const h = makeHarness();
    h.readCategoryMaster.mockResolvedValue({
      ...row(initial, '1'), retired_on: '2026-10-21',
    });
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
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
      documents: [{ ...initial, isDeleted: true, _deleted: false }],
      checkpoint: { changeSeq: '9007199254740993' },
    });
    expect(h.listChanges.mock.calls[0][0]).toMatchObject({
      domain: 'categories', ownerId: alice.supabaseUserId,
      afterExclusive: '0', batchSize: 100,
    });
  });

  it('checks every signed owner row from revision zero, including tombstones, without modifying local RxDB', async () => {
    const local = { find: vi.fn(() => ({ exec: async () => [
      { toJSON: () => initial },
    ] })) };
    const h = makeHarness(local);
    h.listChanges.mockResolvedValueOnce([row(initial, '3')]).mockResolvedValue([]);
    const scans: unknown[] = [];
    await expect(h.pilot.verifyLocalReplica(scan => scans.push(scan))).resolves.toMatchObject({
      pages: 1, rows: 1, localChecked: 1, localTotal: 1,
    });
    expect(h.listChanges).toHaveBeenCalledWith({
      domain: 'categories', ownerId: alice.supabaseUserId,
      afterExclusive: '0', batchSize: 100,
    });
    expect(scans).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'remote', rows: 1 }),
      expect.objectContaining({ phase: 'local', checked: 1 }),
    ]));
    expect(local.find).toHaveBeenCalledWith();
  });

  it('skips foreign cached RxDB rows without reading or mutating them', async () => {
    const foreign = { ...initial, id: 'foreign_cached', userId: bob.legacyUserId };
    const collection = { find: () => ({ exec: async () => [
      { toJSON: () => initial },
      { toJSON: () => foreign },
    ] }) };
    const h = makeHarness(collection);
    h.listChanges.mockResolvedValueOnce([row(initial, '1')]);
    await expect(h.pilot.verifyLocalReplica()).resolves.toMatchObject({
      rows: 1, localChecked: 1, localTotal: 1,
    });
    expect(h.createCategory).not.toHaveBeenCalled();
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('refuses behind-checkpoint drift and missing remote rows without overwriting offline drafts', async () => {
    const toJSON = vi.fn(() => initial);
    const collection = { find: () => ({ exec: async () => [{ toJSON }] }) };
    const h = makeHarness(collection);
    h.listChanges.mockResolvedValueOnce([row(changed, '2')]);
    await expect(h.pilot.verifyLocalReplica()).rejects.toThrow(/local\/cloud verification/);
    expect(toJSON).toHaveBeenCalled();
    expect(h.createCategory).not.toHaveBeenCalled();
    expect(h.compareAndSet).not.toHaveBeenCalled();
    h.listChanges.mockResolvedValue([]);
    await expect(h.pilot.verifyLocalReplica()).rejects.toThrow(/local\/cloud verification/);
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('rejects foreign/out-of-order page data and account rotations mid-audit', async () => {
    const h = makeHarness({ find: () => ({ exec: async () => [] }) });
    h.listChanges.mockResolvedValueOnce([{ ...row(), owner_id: bob.supabaseUserId }]);
    await expect(h.pilot.verifyLocalReplica()).rejects.toThrow(/foreign/);
    h.listChanges.mockResolvedValueOnce([row(initial, '5'), row(initial, '4')]);
    await expect(h.pilot.verifyLocalReplica()).rejects.toThrow(/out-of-order|duplicate/);
    h.listChanges.mockImplementationOnce(async () => {
      h.switchTo(bob.supabaseUserId);
      return [row()];
    });
    await expect(h.pilot.verifyLocalReplica()).rejects.toThrow(/owner|account/);
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
    expect(options.push.handler).not.toBe(h.pilot.push);
    expect(typeof options.push.handler).toBe('function');
    started.resync();
    await started.stop();
    expect(reSync).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('parks a native RxDB conflicting push without polling Auth/master and resumes after explicit checked CAS', async () => {
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed }) }),
    });
    const h = makeHarness({ findOne });
    let remoteRow = row({ ...initial, name: 'Remote winner' }, '2');
    h.readCategoryMaster.mockImplementation(async () => remoteRow);
    h.compareAndSet.mockImplementation(async () => {
      remoteRow = row(changed, '3');
      return { state: 'applied', row: remoteRow, revision: '3' };
    });
    replicate.mockReturnValue({
      cancel: vi.fn().mockResolvedValue(true), reSync: vi.fn(),
    });
    const active = h.pilot.start({ findOne } as never);
    const nativeHandler = replicate.mock.calls[0][0].push.handler as typeof h.pilot.push;
    let settled = false;
    const pending = nativeHandler([{
      newDocumentState: changed, assumedMasterState: initial,
    }] as never).finally(() => { settled = true; });
    await vi.waitFor(() => expect(h.pilot.listPendingConflicts()).toHaveLength(1));
    const reads = h.readCategoryMaster.mock.calls.length;
    const verifications = h.session.getVerifiedSession.mock.calls.length;
    // Allow multiple event-loop turns: no repeat read or Auth call should
    // occur while the review remains unresolved.
    await new Promise(resolve => setTimeout(resolve, 35));
    expect(settled).toBe(false);
    expect(h.readCategoryMaster).toHaveBeenCalledTimes(reads);
    expect(h.session.getVerifiedSession).toHaveBeenCalledTimes(verifications);
    expect(h.pilot.listPendingConflicts()[0].remoteRevision).toBe('2');
    await expect(h.pilot.resolveKeepLocal(initial.id, '2')).resolves.toEqual({
      state: 'applied', revision: '3',
    });
    await expect(pending).resolves.toEqual([]);
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(h.readCategoryMaster).toHaveBeenCalledTimes(reads + 2);
    await active.stop();
  });

  it('explicit refresh releases a parked push only after another writer converges with the unchanged local draft', async () => {
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed }) }),
    });
    const h = makeHarness({ findOne });
    let master = row({ ...initial, name: 'Competing remote draft' }, '2');
    h.readCategoryMaster.mockImplementation(async () => master);
    replicate.mockReturnValue({ cancel: vi.fn().mockResolvedValue(true), reSync: vi.fn() });
    const active = h.pilot.start({ findOne } as never);
    const native = replicate.mock.calls[0][0].push.handler as typeof h.pilot.push;
    const pending = native([{
      newDocumentState: changed, assumedMasterState: initial,
    }] as never);
    await vi.waitFor(() => expect(h.pilot.listPendingConflicts()).toHaveLength(1));
    const readsBefore = h.readCategoryMaster.mock.calls.length;
    const authBefore = h.session.getVerifiedSession.mock.calls.length;
    master = row(changed, '9007199254740993'); // independently applied winner
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'converged', revision: '9007199254740993',
    });
    await expect(pending).resolves.toEqual([]);
    expect(h.readCategoryMaster.mock.calls.length).toBe(readsBefore + 2);
    expect(h.session.getVerifiedSession.mock.calls.length).toBeGreaterThan(authBefore);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    await active.stop();
  });

  it('explicit refresh changes only the review on divergent/missing remote masters, without waking the parked writer', async () => {
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed }) }),
    });
    const h = makeHarness({ findOne });
    const events: unknown[] = [];
    h.pilot.conflictEvents$.subscribe(value => events.push(value));
    let remote = row({ ...initial, name: 'Other' }, '2');
    h.readCategoryMaster.mockImplementation(async () => remote);
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    const eventCount = events.length;
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'unchanged', revision: '2',
    });
    expect(events).toHaveLength(eventCount);
    remote = row({ ...initial, name: 'Third edit' }, '3');
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'updated', revision: '3',
    });
    expect(h.pilot.listPendingConflicts()[0]).toMatchObject({
      reason: 'divergent-master', remoteRevision: '3', remote: { name: 'Third edit' },
      local: { name: 'New' },
    });
    // Name equality alone is insufficient: a different stored timestamp
    // means the remote has NOT independently converged to the local draft.
    remote = row({ ...changed, updatedAt: '2026-10-22' }, '4');
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'updated', revision: '4',
    });
    expect(h.pilot.listPendingConflicts()[0].remoteRevision).toBe('4');
    expect(h.pilot.listPendingConflicts()[0].remote?.name).toBe('New');
    expect(h.compareAndSet).not.toHaveBeenCalled();
    remote = null as never;
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'updated', revision: null,
    });
    expect(h.pilot.listPendingConflicts()[0]).toMatchObject({
      reason: 'missing-master', remote: null, remoteRevision: null,
    });
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'unchanged', revision: null,
    });
    expect(h.compareAndSet).not.toHaveBeenCalled();
    expect(events.filter(event => (event as { type: string }).type === 'cleared')).toHaveLength(0);
  });

  it('never clears a review when the local document changed or the owner switched mid-refresh', async () => {
    let local = { ...changed };
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...local }) }),
    });
    const h = makeHarness({ findOne });
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Other' }, '2'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    const reads = h.readCategoryMaster.mock.calls.length;
    local = { ...changed, name: 'Further local edit' };
    await expect(h.pilot.refreshPendingConflict(initial.id)).resolves.toEqual({
      state: 'local-changed', revision: '2',
    });
    expect(h.readCategoryMaster).toHaveBeenCalledTimes(reads);
    expect(h.pilot.listPendingConflicts()[0].local.name).toBe('New');

    local = { ...changed };
    h.readCategoryMaster.mockImplementationOnce(async () => {
      h.switchTo(bob.supabaseUserId);
      return row(changed, '3');
    });
    await expect(h.pilot.refreshPendingConflict(initial.id)).rejects.toBeInstanceOf(CandidateAuthError);
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('requires a current review and explicit collection before performing any refresh reads', async () => {
    const h = makeHarness();
    await expect(h.pilot.refreshPendingConflict(initial.id)).rejects.toThrow('No pending');
    expect(h.session.getVerifiedSession).not.toHaveBeenCalled();
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Other' }, '2'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    const reads = h.readCategoryMaster.mock.calls.length;
    await expect(h.pilot.refreshPendingConflict(initial.id)).rejects.toThrow('collection required');
    expect(h.readCategoryMaster).toHaveBeenCalledTimes(reads);
  });

  it('releases a parked push before cancellation without acknowledging it or leaking review snapshots', async () => {
    const h = makeHarness();
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Remote winner' }, '2'));
    const cancel = vi.fn().mockResolvedValue(true);
    replicate.mockReturnValue({ cancel, reSync: vi.fn() });
    const active = h.pilot.start({ name: 'test-only-candidate' } as never);
    const nativeHandler = replicate.mock.calls[0][0].push.handler as typeof h.pilot.push;
    const pending = nativeHandler([{
      newDocumentState: changed, assumedMasterState: initial,
    }] as never);
    await vi.waitFor(() => expect(h.pilot.listPendingConflicts()).toHaveLength(1));
    await active.stop();
    await expect(pending).rejects.toThrow('stopped');
    expect(cancel).toHaveBeenCalledOnce();
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(h.readCategoryMaster).toHaveBeenCalledTimes(1);
  });

  it('surfaces an owner-scoped conflict review without acknowledging or replacing the offline draft', async () => {
    const h = makeHarness();
    const events: unknown[] = [];
    h.pilot.conflictEvents$.subscribe(value => events.push(value));
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Other device' }, '10'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    const pending = h.pilot.listPendingConflicts();
    expect(pending).toEqual([{
      domain: 'categories', documentId: 'category_a', reason: 'divergent-master',
      local: changed, base: initial,
      remote: { ...initial, name: 'Other device' }, remoteRevision: '10',
    }]);
    expect(events).toEqual([{ type: 'pending', review: pending[0] }]);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    // UI consumers cannot mutate the private snapshot registry by editing a returned object.
    pending[0].local.name = 'Mutated by a UI consumer';
    expect(h.pilot.listPendingConflicts()[0].local.name).toBe('New');

    h.readCategoryMaster.mockResolvedValue(row(changed, '11'));
    await expect(h.push(changed, initial)).resolves.toEqual([]);
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(events.at(-1)).toEqual({ type: 'cleared', documentId: 'category_a' });
  });

  it('only explicitly keeps a reviewed local version when fresh server revision still matches', async () => {
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed }) }),
    });
    const h = makeHarness({ findOne });
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Remote edit' }, '2'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    await expect(h.pilot.resolveKeepLocal(initial.id, '1')).rejects.toThrow('reviewed remote revision');
    expect(h.compareAndSet).not.toHaveBeenCalled();
    h.compareAndSet.mockResolvedValue({
      state: 'applied', row: row(changed, '3'), revision: '3',
    });
    await expect(h.pilot.resolveKeepLocal(initial.id, '2')).resolves.toEqual({
      state: 'applied', revision: '3',
    });
    expect(findOne).toHaveBeenCalledWith(initial.id);
    expect(h.compareAndSet).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: alice.supabaseUserId, documentId: initial.id,
      expectedRevision: '2',
      patch: expect.objectContaining({ name: 'New' }),
    }));
    expect(h.pilot.listPendingConflicts()).toEqual([]);
  });

  it('refuses resolution after server revision advances, or local draft changes since review', async () => {
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed }) }),
    });
    const h = makeHarness({ findOne });
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Remote edit' }, '2'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'New remote revision' }, '3'));
    await expect(h.pilot.resolveKeepLocal(initial.id, '2'))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.pilot.listPendingConflicts()[0]).toMatchObject({
      reason: 'divergent-master', remoteRevision: '3',
      remote: { name: 'New remote revision' },
    });
    expect(h.compareAndSet).not.toHaveBeenCalled();

    findOne.mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed, name: 'New unsaved local version' }) }),
    });
    await expect(h.pilot.resolveKeepLocal(initial.id, '3'))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('keeps a conflict pending on a racing CAS loss; account switching clears sensitive previews', async () => {
    const findOne = vi.fn().mockReturnValue({
      exec: async () => ({ toJSON: () => ({ ...changed }) }),
    });
    const h = makeHarness({ findOne });
    h.readCategoryMaster.mockResolvedValue(row({ ...initial, name: 'Other' }, '4'));
    await expect(h.push(changed, initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    h.compareAndSet.mockResolvedValue({ state: 'conflict' });
    h.readCategoryMaster.mockResolvedValueOnce(row({ ...initial, name: 'Other' }, '4'))
      .mockResolvedValueOnce(row({ ...initial, name: 'After CAS race' }, '5'));
    await expect(h.pilot.resolveKeepLocal(initial.id, '4'))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.pilot.listPendingConflicts()[0]).toMatchObject({
      reason: 'cas-conflict', remoteRevision: '5',
    });
    const events: unknown[] = [];
    h.pilot.conflictEvents$.subscribe(event => events.push(event));
    h.switchTo(bob.supabaseUserId);
    await expect(h.pilot.resolveKeepLocal(initial.id, '5'))
      .rejects.toBeInstanceOf(CandidateAuthError);
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(events).toContainEqual({ type: 'cleared', documentId: initial.id });
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
