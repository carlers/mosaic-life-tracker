/**
 * Isolated task/category pull-to-transaction coordinator (#967).
 *
 * Not part of Mosaic's shipped RxDB/Appwrite runtime. The future durable store
 * adapter MUST commit documents + checkpoint in one atomic transaction and
 * compare the previously stored checkpoint; this file cannot make a non-atomic
 * store durable. There is deliberately no automatic retry of an ambiguous
 * transaction or an owner switch.
 */
import type { TaskDocument, CategoryDocument } from '../src/db/schema';
import {
  parseCandidateRevision, validateCandidateIdentity,
  type CandidateIdentity,
} from './candidateMapping';
import {
  pullCandidateTasks, pullCandidateCategories,
  type CandidateChangeTransport, type CandidateCheckpoint,
  type CandidateDomain,
} from './candidatePull';

export type CandidateReplicaDocument =
  | (TaskDocument & { _deleted: false })
  | (CategoryDocument & { _deleted: false });

/** The host must increment epoch on every sign-in, sign-out or session change. */
export interface CandidateAccountSnapshot {
  identity: CandidateIdentity;
  epoch: number;
}
export interface CandidateAccountFence {
  snapshot(): CandidateAccountSnapshot | null;
}

/**
 * A storage provider keyed by BOTH identities + domain. Implementations must:
 * - atomically replace documents and checkpoint (neither if anything fails),
 * - return 'stale' if the expected checkpoint differs, without writes,
 * - call isCurrent in the atomic commit and fail without writes when false,
 * - never apply remote rows over locally pending/unacknowledged edits.
 * The prototype does not implement an IndexedDB/RxDB store provider yet.
 */
export interface CandidateReplicaStore {
  readCheckpoint(scope: CandidateIdentity, domain: CandidateDomain):
    Promise<CandidateCheckpoint | undefined>;
  applyBatch(options: {
    scope: CandidateIdentity;
    domain: CandidateDomain;
    expectedCheckpoint?: CandidateCheckpoint;
    nextCheckpoint: CandidateCheckpoint;
    documents: CandidateReplicaDocument[];
    isCurrent(): boolean;
  }): Promise<'applied' | 'stale'>;
}

function validateSnapshot(snapshot: CandidateAccountSnapshot | null): CandidateAccountSnapshot {
  if (!snapshot || !Number.isSafeInteger(snapshot.epoch) || snapshot.epoch < 0)
    throw new Error('Candidate pull has no valid active account');
  validateCandidateIdentity(snapshot.identity);
  return {
    epoch: snapshot.epoch,
    identity: {
      legacyUserId: snapshot.identity.legacyUserId,
      supabaseUserId: snapshot.identity.supabaseUserId,
    },
  };
}

function sameSnapshot(a: CandidateAccountSnapshot, b: CandidateAccountSnapshot | null): boolean {
  return Boolean(b && b.epoch === a.epoch &&
    b.identity?.legacyUserId === a.identity.legacyUserId &&
    b.identity?.supabaseUserId === a.identity.supabaseUserId);
}

function checkedCheckpoint(checkpoint: CandidateCheckpoint | undefined): CandidateCheckpoint | undefined {
  if (checkpoint === undefined) return undefined;
  if (!checkpoint || typeof checkpoint.changeSeq !== 'string')
    throw new Error('Invalid persisted candidate checkpoint');
  const revision = parseCandidateRevision(checkpoint.changeSeq);
  return { changeSeq: revision.toString() };
}

export async function syncCandidatePullPage(options: {
  domain: CandidateDomain;
  transport: CandidateChangeTransport;
  store: CandidateReplicaStore;
  fence: CandidateAccountFence;
  batchSize: number;
}): Promise<{
  state: 'idle' | 'applied' | 'stale';
  documents: number;
  checkpoint?: CandidateCheckpoint;
}> {
  const { domain, transport, store, fence, batchSize } = options;
  if (domain !== 'tasks' && domain !== 'categories')
    throw new Error('Unsupported candidate sync domain');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100)
    throw new Error('Invalid candidate sync page size');

  const initial = validateSnapshot(fence.snapshot());
  const scope = initial.identity;
  const isCurrent = () => sameSnapshot(initial, fence.snapshot());
  const persisted = checkedCheckpoint(await store.readCheckpoint(scope, domain));
  if (!isCurrent()) throw new Error('Candidate account changed while loading checkpoint');

  const pulled = domain === 'tasks'
    ? await pullCandidateTasks({ identity: scope, transport, checkpoint: persisted, batchSize })
    : await pullCandidateCategories({ identity: scope, transport, checkpoint: persisted, batchSize });
  if (!isCurrent()) throw new Error('Candidate account changed while pulling rows');

  if (!pulled.documents.length)
    return { state: 'idle', documents: 0, checkpoint: persisted };
  const nextCheckpoint = checkedCheckpoint(pulled.checkpoint);
  if (!nextCheckpoint ||
    parseCandidateRevision(nextCheckpoint.changeSeq) <=
      parseCandidateRevision(persisted?.changeSeq ?? '0'))
    throw new Error('Candidate pull did not advance the checkpoint');

  const documents: CandidateReplicaDocument[] = pulled.documents;
  // Do not assume downstream storage is correctly scoped to the owner.
  if (documents.some(row => row.userId !== scope.legacyUserId || row._deleted !== false))
    throw new Error('Candidate pull returned unexpected local owner');

  const state = await store.applyBatch({
    scope,
    domain,
    expectedCheckpoint: persisted,
    nextCheckpoint,
    documents,
    isCurrent,
  });
  if (!isCurrent()) throw new Error('Candidate account changed while committing');
  if (state !== 'applied' && state !== 'stale')
    throw new Error('Invalid candidate storage commit acknowledgment');
  // Stale means another worker committed first. Caller must re-read; no blind
  // checkpoint advance or retry of a potentially non-idempotent commit.
  return {
    state,
    documents: state === 'applied' ? documents.length : 0,
    checkpoint: state === 'applied' ? nextCheckpoint : persisted,
  };
}
