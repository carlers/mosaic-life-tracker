import { describe, expect, it, vi } from 'vitest';
import type { CandidateCategoryRow, CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { CandidateChangeTransport, CandidateDomain, CandidateCheckpoint } from '../../supabase-poc/candidatePull';
import {
  syncCandidatePullPage,
  type CandidateReplicaStore, type CandidateReplicaDocument,
  type CandidateAccountSnapshot,
} from '../../supabase-poc/candidatePullCoordinator';

const alice: CandidateIdentity = {
  legacyUserId: 'legacy_alice',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const bob: CandidateIdentity = {
  legacyUserId: 'legacy_bob',
  supabaseUserId: '22222222-2222-4222-8222-222222222222',
};
const sample: CandidateCategoryRow = {
  owner_id: alice.supabaseUserId, id: 'legacy_category', name: 'Tasks',
  color: '#000', order_index: 0, visibility: 'private',
  icon: null, updated_at: 'today', is_deleted: false,
  change_seq: '9007199254740993', server_updated_at: 'today',
};
function makeScope(initial: CandidateIdentity = alice) {
  let current: CandidateAccountSnapshot | null = { identity: initial, epoch: 1 };
  return {
    fence: { snapshot: () => current },
    switchTo(identity: CandidateIdentity | null, epoch = 2) {
      current = identity ? { identity, epoch } : null;
    },
  };
}

function makeStore() {
  const checkpoints = new Map<string, CandidateCheckpoint>();
  const docs = new Map<string, CandidateReplicaDocument>();
  const pending = new Set<string>();
  const key = (scope: CandidateIdentity, domain: CandidateDomain) =>
    scope.legacyUserId + '/' + scope.supabaseUserId + '/' + domain;
  const applyBatch = vi.fn(async (options: Parameters<CandidateReplicaStore['applyBatch']>[0]) => {
    const k = key(options.scope, options.domain);
    const old = checkpoints.get(k);
    if (!options.isCurrent()) throw new Error('Fenced account changed during commit');
    if ((old?.changeSeq ?? undefined) !== (options.expectedCheckpoint?.changeSeq ?? undefined))
      return 'stale' as const;
    if (options.documents.some(doc => pending.has(k + '/' + doc.id)))
      throw new Error('Unacknowledged local write cannot be overwritten');
    if (options.documents.some(doc => doc.userId !== options.scope.legacyUserId))
      throw new Error('Foreign local document');
    // A stand-in for a single IndexedDB/RxDB transaction: no partial writes.
    for (const doc of options.documents) docs.set(k + '/' + doc.id, doc);
    checkpoints.set(k, options.nextCheckpoint);
    return 'applied' as const;
  });
  const store: CandidateReplicaStore = {
    async readCheckpoint(scope, domain) { return checkpoints.get(key(scope, domain)); },
    applyBatch,
  };
  return { store, checkpoints, docs, pending, key, applyBatch };
}
function makeTransport(...pages: CandidateCategoryRow[][]) {
  const listChanges = vi.fn(async () => pages.shift() ?? []);
  return { transport: { listChanges } as unknown as CandidateChangeTransport, listChanges };
}
const baseOptions = { domain: 'categories' as const, batchSize: 100 };

describe('Supabase candidate atomic pull/checkpoint coordinator (isolated, #967)', () => {
  it('commits tombstones and cursor together, then resumes from the cursor after restart', async () => {
    const { store, checkpoints, docs, key } = makeStore();
    const { fence } = makeScope();
    const next = { ...sample, id: 'second', change_seq: '9007199254740994', is_deleted: true };
    const { transport, listChanges } = makeTransport([sample], [next], []);
    const options = { ...baseOptions, store, transport, fence };
    expect(await syncCandidatePullPage(options)).toMatchObject({
      state: 'applied', documents: 1, checkpoint: { changeSeq: '9007199254740993' },
    });
    expect(await syncCandidatePullPage(options)).toMatchObject({
      state: 'applied', documents: 1, checkpoint: { changeSeq: '9007199254740994' },
    });
    expect(await syncCandidatePullPage(options)).toMatchObject({ state: 'idle', documents: 0 });
    expect(listChanges.mock.calls).toHaveLength(3);
    expect(checkpoints.get(key(alice, 'categories'))).toEqual({ changeSeq: '9007199254740994' });
    expect(docs.get(key(alice, 'categories') + '/second'))
      .toMatchObject({ userId: alice.legacyUserId, isDeleted: true, _deleted: false });
  });

  it('does not advance on failed atomic commit; retry replays the same remote page', async () => {
    const state = makeStore();
    const { fence } = makeScope();
    const listChanges = vi.fn(async () => [sample]);
    const transport = { listChanges } as unknown as CandidateChangeTransport;
    const failure: CandidateReplicaStore = {
      ...state.store,
      applyBatch: vi.fn().mockRejectedValue(new Error('disk full')),
    };
    await expect(syncCandidatePullPage({ ...baseOptions, store: failure, transport, fence }))
      .rejects.toThrow('disk full');
    expect(state.checkpoints.size).toBe(0);
    expect(state.docs.size).toBe(0);
    expect(await syncCandidatePullPage({ ...baseOptions, store: state.store, transport, fence }))
      .toMatchObject({ state: 'applied', documents: 1 });
    expect(listChanges).toHaveBeenCalledTimes(2);
    expect(listChanges.mock.calls[1][0]).toMatchObject({ afterExclusive: '0' });
  });

  it('rejects network failures without acknowledging a checkpoint, then recovers from offline', async () => {
    const { store, checkpoints } = makeStore();
    const { fence } = makeScope();
    const listChanges = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([sample]);
    const transport = { listChanges } as unknown as CandidateChangeTransport;
    const options = { ...baseOptions, store, transport, fence };
    await expect(syncCandidatePullPage(options)).rejects.toThrow('offline');
    expect(checkpoints.size).toBe(0);
    expect(await syncCandidatePullPage(options)).toMatchObject({ state: 'applied' });
  });

  it('rejects changed accounts after network or inside atomic commit and keeps owners separate', async () => {
    const state = makeStore();
    const session = makeScope();
    const transport = {
      listChanges: vi.fn(async () => { session.switchTo(bob); return [sample]; }),
    } as unknown as CandidateChangeTransport;
    await expect(syncCandidatePullPage({ ...baseOptions, store: state.store, transport, fence: session.fence }))
      .rejects.toThrow('account changed');
    expect(state.checkpoints.size).toBe(0);

    const afterRead = makeScope();
    const withinCommit: CandidateReplicaStore = {
      ...state.store,
      applyBatch: async args => {
        afterRead.switchTo(bob);
        if (!args.isCurrent()) throw new Error('Fenced account changed during commit');
        return 'applied';
      },
    };
    await expect(syncCandidatePullPage({
      ...baseOptions, store: withinCommit, fence: afterRead.fence,
      transport: makeTransport([sample]).transport,
    })).rejects.toThrow('Fenced account changed');
    expect(state.docs.size).toBe(0);
  });

  it('prevents concurrent pull workers from committing the same checkpoint twice', async () => {
    const state = makeStore();
    const { fence } = makeScope();
    const gate: { release?: () => void } = {};
    const latch = new Promise<void>(resolve => { gate.release = resolve; });
    let seen = 0;
    const transport = {
      listChanges: vi.fn(async () => { seen++; await latch; return [sample]; }),
    } as unknown as CandidateChangeTransport;
    const args = { ...baseOptions, store: state.store, transport, fence };
    const a = syncCandidatePullPage(args);
    const b = syncCandidatePullPage(args);
    await vi.waitFor(() => expect(seen).toBe(2));
    gate.release?.();
    const outcomes = await Promise.all([a, b]);
    expect(outcomes.map(o => o.state).sort()).toEqual(['applied', 'stale']);
    expect(state.applyBatch).toHaveBeenCalledTimes(2);
    expect(state.docs.size).toBe(1);
  });

  it('fails closed on remote foreign ownership or pending unsynced local edits', async () => {
    const state = makeStore();
    const { fence } = makeScope();
    const foreign = { ...sample, owner_id: bob.supabaseUserId };
    await expect(syncCandidatePullPage({
      ...baseOptions, store: state.store, fence,
      transport: makeTransport([foreign]).transport,
    })).rejects.toThrow('foreign owner');
    const key = state.key(alice, 'categories') + '/' + sample.id;
    state.pending.add(key);
    await expect(syncCandidatePullPage({
      ...baseOptions, store: state.store, fence,
      transport: makeTransport([sample]).transport,
    })).rejects.toThrow('Unacknowledged local write');
    expect(state.checkpoints.size).toBe(0);
    expect(state.docs.size).toBe(0);
  });

  it('rejects malformed persisted cursor and inactive sessions before network', async () => {
    const state = makeStore();
    const session = makeScope();
    const { transport, listChanges } = makeTransport([sample]);
    const corrupt: CandidateReplicaStore = {
      ...state.store,
      readCheckpoint: async () => ({ changeSeq: '1.1' }),
    };
    await expect(syncCandidatePullPage({ ...baseOptions, store: corrupt, fence: session.fence, transport }))
      .rejects.toThrow('revision');
    session.switchTo(null);
    await expect(syncCandidatePullPage({ ...baseOptions, store: state.store, fence: session.fence, transport }))
      .rejects.toThrow('active account');
    expect(listChanges).not.toHaveBeenCalled();
  });
});
