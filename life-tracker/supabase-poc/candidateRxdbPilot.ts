/**
 * Isolated #967 RxDB replication pilot: tasks/categories only.
 *
 * NOT imported by Mosaic's shipped Appwrite replication or database bootstrap.
 * RxDB owns its native durable pull/push checkpoints. Do not add a second
 * checkpoint store or start this alongside the Appwrite pilot on shared data.
 *
 * Ambiguous owner edits never return a default master-wins result. Direct
 * push callers receive a typed conflict; active RxDB replication instead
 * suspends that batch until explicit resolution, avoiding 5-second retries
 * that would otherwise spend Auth and PostgREST reads indefinitely.
 */
import type {
  RxCollection, RxReplicationPullStreamItem, RxReplicationWriteToMasterRow,
  WithDeletedAndAttachments,
} from 'rxdb';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { Subject } from 'rxjs';
import type { TaskDocument, CategoryDocument } from '../src/db/schema';
import {
  fromCandidateCategoryRow, fromCandidateTaskRow,
  parseCandidateRevision, toCandidateCategoryWrite, toCandidateTaskWrite,
  validateCandidateIdentity, type CandidateCategoryRow, type CandidateTaskRow,
  type CandidateIdentity,
} from './candidateMapping';
import {
  pullCandidateCategories, pullCandidateTasks,
  type CandidateChangeTransport, type CandidateCheckpoint, type CandidateDomain,
} from './candidatePull';
import type { createCandidateCreateTransport } from './candidateCreateTransport';
import type { createCandidateCasTransport } from './candidateCasTransport';
import { CandidateAuthError, type CandidateSessionProvider } from './candidateHttpTransport';

type Document = TaskDocument | CategoryDocument;
type Row = CandidateTaskRow | CandidateCategoryRow;
type Replicated<D extends Document> = WithDeletedAndAttachments<D>;
type Writer = ReturnType<typeof createCandidateCreateTransport>;
type Cas = ReturnType<typeof createCandidateCasTransport>;

export type CandidateConflictReason =
  | 'missing-master' | 'divergent-master' | 'duplicate-create'
  | 'cas-conflict' | 'unconfirmed-write';

export interface CandidateConflictReview<D extends Document> {
  domain: CandidateDomain;
  documentId: string;
  reason: CandidateConflictReason;
  /** Snapshot at the rejected push. Still pending in local RxDB. */
  local: Replicated<D>;
  /** RxDB's assumed master, when provided by the replicator. */
  base: Replicated<D> | null;
  /** Last verified owner-scoped authoritative master. */
  remote: Replicated<D> | null;
  remoteRevision: string | null;
}

export type CandidateConflictReviewEvent<D extends Document> =
  | { type: 'pending'; review: CandidateConflictReview<D> }
  | { type: 'cleared'; documentId: string };

export class CandidatePendingConflictError extends Error {
  constructor(readonly domain: CandidateDomain, readonly documentId: string) {
    super('Supabase candidate remote conflict requires explicit local-edit resolution');
    this.name = 'CandidatePendingConflictError';
  }
}

export interface CandidateRxdbPilotOptions<D extends Document> {
  domain: CandidateDomain;
  identity: CandidateIdentity;
  session: CandidateSessionProvider;
  changes: CandidateChangeTransport;
  writer: Writer;
  cas: Cas;
  /** Must be an isolated test collection, never a currently Appwrite-replicated collection. */
  collection?: RxCollection<D>;
}

function assertedDomain(value: CandidateDomain): void {
  if (value !== 'tasks' && value !== 'categories')
    throw new Error('Unsupported candidate RxDB replication domain');
}

/** Compare fields that Mosaic actually stores; ignore SQL-only revision/time. */
function canonical(domain: CandidateDomain, doc: Document, owner: CandidateIdentity): string {
  return JSON.stringify(domain === 'tasks'
    ? toCandidateTaskWrite(doc as TaskDocument, owner)
    : toCandidateCategoryWrite(doc as CategoryDocument, owner));
}

export function createCandidateRxdbPilot<D extends Document>(
  options: CandidateRxdbPilotOptions<D>,
) {
  const { identity, domain, session, changes, writer, cas } = options;
  validateCandidateIdentity(identity);
  assertedDomain(domain);

  // These are process-local, owner-scoped review snapshots. The actual pending
  // edits remain durably stored in RxDB, not in this map. A retry/restart
  // rebuilds the review from the unacknowledged push. Never log these values.
  const pendingConflicts = new Map<string, CandidateConflictReview<D>>();
  const conflictEvents = new Subject<CandidateConflictReviewEvent<D>>();
  // A parked RxDB push holds its pending checkpoint and makes NO Auth/REST
  // calls until the owner resolves the conflict. Only the review event's
  // document id is used as a wakeup; local document contents stay in RxDB.
  const conflictWaiters = new Map<string, Set<() => void>>();
  function wakeConflictWaiters(documentId: string) {
    const waiters = conflictWaiters.get(documentId);
    conflictWaiters.delete(documentId);
    for (const resume of waiters ?? []) resume();
  }
  function waitForReviewClear(documentId: string): Promise<void> {
    if (!pendingConflicts.has(documentId)) return Promise.resolve();
    return new Promise(resolve => {
      const waiters = conflictWaiters.get(documentId) ?? new Set<() => void>();
      waiters.add(resolve);
      conflictWaiters.set(documentId, waiters);
    });
  }
  const copy = <T>(value: T): T => structuredClone(value);
  function clearReview(documentId: string) {
    if (pendingConflicts.delete(documentId)) {
      conflictEvents.next({ type: 'cleared', documentId });
      wakeConflictWaiters(documentId);
    }
  }
  function clearAllReviews() {
    for (const documentId of pendingConflicts.keys()) clearReview(documentId);
  }
  function saveConflictReview(
    local: Replicated<D>, base: Replicated<D> | null,
    remote: { document: Replicated<D>; revision: string } | null,
    reason: CandidateConflictReason,
  ): CandidateConflictReview<D> {
    if (local.userId !== identity.legacyUserId ||
      base && base.userId !== identity.legacyUserId ||
      remote && remote.document.userId !== identity.legacyUserId) {
      throw new CandidateAuthError('Candidate conflict review owner mismatch');
    }
    if (!pendingConflicts.has(local.id) && pendingConflicts.size >= 100)
      throw new Error('Candidate pending conflict review capacity exceeded; push not acknowledged');
    const review: CandidateConflictReview<D> = {
      domain, documentId: local.id, reason,
      local: copy(local), base: base ? copy(base) : null,
      remote: remote ? copy(remote.document) : null,
      remoteRevision: remote?.revision ?? null,
    };
    pendingConflicts.set(local.id, review);
    conflictEvents.next({ type: 'pending', review: copy(review) });
    return review;
  }
  function recordConflict(
    local: Replicated<D>, base: Replicated<D> | null,
    remote: { document: Replicated<D>; revision: string } | null,
    reason: CandidateConflictReason,
  ): never {
    saveConflictReview(local, base, remote, reason);
    throw new CandidatePendingConflictError(domain, local.id);
  }
  function listPendingConflicts(): CandidateConflictReview<D>[] {
    return Array.from(pendingConflicts.values(), copy);
  }

  type Revisioned = { row: Row; document: Replicated<D>; revision: string };
  const readDocument = (row: Row): Replicated<D> => ({
    ...(domain === 'tasks'
      ? fromCandidateTaskRow(row as CandidateTaskRow, identity)
      : fromCandidateCategoryRow(row as CandidateCategoryRow, identity)) as D,
    _deleted: false,
  });

  function checkedRow(row: Row): Revisioned {
    if (!row || row.owner_id !== identity.supabaseUserId ||
      typeof row.is_deleted !== 'boolean' ||
      parseCandidateRevision(row.change_seq) < 1n) {
      throw new Error('Malformed or foreign Supabase candidate master');
    }
    return {
      row,
      document: readDocument(row),
      revision: parseCandidateRevision(row.change_seq).toString(),
    };
  }

  async function guardedSession() {
    const value = await session.getVerifiedSession();
    if (!value || value.userId !== identity.supabaseUserId ||
      !value.accessToken || !Number.isSafeInteger(value.sessionEpoch) ||
      value.sessionEpoch < 0) {
      clearAllReviews();
      throw new CandidateAuthError('Candidate RxDB has no verified owner session');
    }
    return value;
  }

  async function pull(
    checkpoint: CandidateCheckpoint | undefined,
    batchSize: number,
  ): Promise<{ documents: Replicated<D>[]; checkpoint: CandidateCheckpoint | undefined }> {
    const before = await guardedSession();
    const result = domain === 'tasks'
      ? await pullCandidateTasks({ identity, transport: changes, checkpoint, batchSize })
      : await pullCandidateCategories({ identity, transport: changes, checkpoint, batchSize });
    const after = await guardedSession();
    if (after.sessionEpoch !== before.sessionEpoch || after.accessToken !== before.accessToken) {
      clearAllReviews();
      throw new CandidateAuthError('Candidate RxDB account changed during pull');
    }
    return {
      documents: result.documents as Replicated<D>[],
      checkpoint: result.checkpoint,
    };
  }

  async function readMaster(id: string): Promise<Revisioned | null> {
    const row = domain === 'tasks'
      ? await writer.readTaskMaster(id, identity)
      : await writer.readCategoryMaster(id, identity);
    return row ? checkedRow(row) : null;
  }

  async function create(doc: Replicated<D>): Promise<Revisioned | null> {
    const result = domain === 'tasks'
      ? await writer.createTask(doc as TaskDocument, identity)
      : await writer.createCategory(doc as CategoryDocument, identity);
    const remote = checkedRow(result.row);
    if (result.revision !== remote.revision)
      throw new Error('Candidate inserted row had inconsistent revision');
    // An idempotent duplicate is accepted only when content is the same.
    if (result.state === 'conflict') {
      if (canonical(domain, doc, identity) !== canonical(domain, remote.document, identity))
        recordConflict(doc, null, remote, 'duplicate-create');
      return remote;
    }
    // Failed normalization must never acknowledge an unexpected stored row.
    if (canonical(domain, doc, identity) !== canonical(domain, remote.document, identity))
      recordConflict(doc, null, remote, 'unconfirmed-write');
    return null;
  }

  async function push(rows: RxReplicationWriteToMasterRow<D>[]): Promise<Replicated<D>[]> {
    if (!Array.isArray(rows) || rows.length > 20)
      throw new Error('Invalid Supabase candidate push batch');
    const initial = await guardedSession();
    const fence = async () => {
      const next = await guardedSession();
      if (next.sessionEpoch !== initial.sessionEpoch ||
        next.accessToken !== initial.accessToken) {
        clearAllReviews();
        throw new CandidateAuthError('Candidate RxDB account changed during push');
      }
    };
    for (const row of rows) {
      await fence();
      const next = row.newDocumentState as Replicated<D>;
      // Account-shared RxDB can contain other owners. Never write their rows.
      if (next.userId !== identity.legacyUserId) continue;
      if (next._deleted)
        throw new Error('Physical deletes are forbidden; use isDeleted tombstones');
      if (row.assumedMasterState &&
        row.assumedMasterState.userId !== identity.legacyUserId)
        throw new Error('Foreign assumed RxDB master');
      const assumed = row.assumedMasterState as Replicated<D> | undefined;

      const master = await readMaster(next.id);
      await fence();
      if (!master) {
        // The remote master unexpectedly disappeared after an acknowledged
        // revision. Do not recreate a missing/tombstoned record silently.
        if (assumed) recordConflict(next, assumed, null, 'missing-master');
        await create(next);
        await fence();
        clearReview(next.id);
        continue;
      }

      const remote = canonical(domain, master.document, identity);
      const nextValue = canonical(domain, next, identity);
      if (remote === nextValue) {
        clearReview(next.id); // Response-lost replay or already synced.
        continue;
      }

      // Never auto-win on timestamp alone when no assumed master exists.
      if (!assumed || canonical(domain, assumed, identity) !== remote)
        recordConflict(next, assumed ?? null, master, 'divergent-master');

      const write = domain === 'tasks'
        ? toCandidateTaskWrite(next as TaskDocument, identity)
        : toCandidateCategoryWrite(next as CategoryDocument, identity);
      const { owner_id: _owner, id: _id, ...patch } = write;
      void _owner;
      void _id;
      const result = await cas.compareAndSet<Row>({
        domain,
        ownerId: identity.supabaseUserId,
        documentId: next.id,
        expectedRevision: master.revision,
        patch,
      });
      await fence();
      if (result.state === 'conflict') {
        // A server write may have succeeded before a connection failure or
        // simultaneous writer: re-read the master before deciding to retry.
        const latest = await readMaster(next.id);
        await fence();
        if (latest && canonical(domain, latest.document, identity) === nextValue) {
          clearReview(next.id);
          continue;
        }
        recordConflict(next, assumed, latest, 'cas-conflict');
      }
      const accepted = checkedRow(result.row);
      if (accepted.revision !== result.revision ||
        canonical(domain, accepted.document, identity) !== nextValue)
        recordConflict(next, assumed, accepted, 'unconfirmed-write');
      clearReview(next.id);
    }
    await fence();
    // No conflicts are passed to RxDB's default master-wins merge; unsafe
    // conflicts throw and keep the pending local push checkpoint unadvanced.
    return [];
  }

  /**
   * A user-initiated single refresh for a parked conflict. No interval,
   * automatic resync or additional durable cursor is created.
   *
   * Only identical, owner-verified local and remote content may unblock a
   * pending native push. Diverging/missing masters update its review in place
   * without waking the push or sending CAS. Concurrent review replacement,
   * account switch and local edits fail closed.
   */
  async function refreshPendingConflict(documentId: string): Promise<
    | { state: 'converged'; revision: string }
    | { state: 'updated' | 'unchanged' | 'local-changed'; revision: string | null }
  > {
    const review = pendingConflicts.get(documentId);
    if (!review) throw new Error('No pending candidate conflict to refresh');
    if (!options.collection) throw new Error('Explicit isolated RxDB collection required for refresh');

    const before = await guardedSession();
    const fence = async () => {
      const now = await guardedSession();
      if (now.sessionEpoch !== before.sessionEpoch ||
        now.accessToken !== before.accessToken) {
        clearAllReviews();
        throw new CandidateAuthError('Candidate account switched during conflict refresh');
      }
      if (pendingConflicts.get(documentId) !== review)
        throw new CandidatePendingConflictError(domain, documentId);
    };
    const document = await options.collection.findOne(documentId).exec();
    await fence();
    if (!document)
      return { state: 'local-changed', revision: review.remoteRevision };
    const local = document.toJSON() as Replicated<D>;
    if (local.userId !== identity.legacyUserId) {
      clearAllReviews();
      throw new CandidateAuthError('Candidate conflict refresh owner mismatch');
    }
    // A parked native RxDB batch may still contain an earlier version.
    // Never wake it or silently acknowledge a newer local edit.
    if (canonical(domain, local, identity) !== canonical(domain, review.local, identity))
      return { state: 'local-changed', revision: review.remoteRevision };

    const master = await readMaster(documentId);
    await fence();
    if (master && canonical(domain, master.document, identity) === canonical(domain, local, identity)) {
      clearReview(documentId);
      return { state: 'converged', revision: master.revision };
    }
    if (master?.revision === review.remoteRevision &&
      (master && review.remote
        ? canonical(domain, master.document, identity) === canonical(domain, review.remote, identity)
        : !master && !review.remote))
      return { state: 'unchanged', revision: review.remoteRevision };
    if (!master && !review.remote)
      return { state: 'unchanged', revision: null };
    saveConflictReview(local, review.base, master, master ? 'divergent-master' : 'missing-master');
    return { state: 'updated', revision: master?.revision ?? null };
  }

  async function resolveKeepLocal(documentId: string, reviewedRevision: string) {
    const review = pendingConflicts.get(documentId);
    if (!review || review.remoteRevision === null ||
      review.remoteRevision !== reviewedRevision)
      throw new Error('Candidate resolution requires the exact reviewed remote revision');
    if (!options.collection) throw new Error('Explicit isolated RxDB collection required for resolution');
    const before = await guardedSession();
    const fence = async () => {
      const now = await guardedSession();
      if (now.sessionEpoch !== before.sessionEpoch ||
        now.accessToken !== before.accessToken) {
        clearAllReviews();
        throw new CandidateAuthError('Candidate account switched during conflict resolution');
      }
    };
    const document = await options.collection.findOne(documentId).exec();
    await fence();
    if (!document) throw new CandidatePendingConflictError(domain, documentId);
    const local = document.toJSON() as Replicated<D>;
    if (local.userId !== identity.legacyUserId ||
      canonical(domain, local, identity) !== canonical(domain, review.local, identity))
      throw new CandidatePendingConflictError(domain, documentId);
    const master = await readMaster(documentId);
    await fence();
    if (!master || master.revision !== reviewedRevision ||
      !review.remote ||
      canonical(domain, master.document, identity) !== canonical(domain, review.remote, identity)) {
      recordConflict(local, review.base, master, 'divergent-master');
    }
    if (canonical(domain, local, identity) === canonical(domain, master.document, identity)) {
      clearReview(documentId);
      return { state: 'already-applied' as const, revision: master.revision };
    }
    const write = domain === 'tasks'
      ? toCandidateTaskWrite(local as TaskDocument, identity)
      : toCandidateCategoryWrite(local as CategoryDocument, identity);
    const { owner_id: _owner, id: _id, ...patch } = write;
    void _owner;
    void _id;
    const result = await cas.compareAndSet<Row>({
      domain, ownerId: identity.supabaseUserId, documentId,
      expectedRevision: master.revision, patch,
    });
    await fence();
    if (result.state === 'conflict') {
      const latest = await readMaster(documentId);
      await fence();
      if (latest && canonical(domain, latest.document, identity) === canonical(domain, local, identity)) {
        clearReview(documentId);
        return { state: 'already-applied' as const, revision: latest.revision };
      }
      recordConflict(local, review.base, latest, 'cas-conflict');
    }
    const accepted = checkedRow(result.row);
    if (result.revision !== accepted.revision ||
      canonical(domain, accepted.document, identity) !== canonical(domain, local, identity))
      recordConflict(local, review.base, accepted, 'unconfirmed-write');
    clearReview(documentId);
    // RxDB's next retry still sees this pending draft. Its master read will
    // match the exact local state and only then acknowledge the push.
    return { state: 'applied' as const, revision: accepted.revision };
  }

  function start(collection = options.collection) {
    if (!collection) throw new Error('Isolated RxDB candidate collection required');
    const stream = new Subject<RxReplicationPullStreamItem<D, CandidateCheckpoint>>();
    // No realtime guarantee yet. Caller must reSync() on foreground and
    // reconnect; RxDB itself persists checkpoints and retries failed pushes.
    let stopped = false;
    const pushAfterReview = async (
      rows: RxReplicationWriteToMasterRow<D>[],
    ): Promise<Replicated<D>[]> => {
      for (;;) {
        if (stopped) throw new Error('Candidate RxDB replication was stopped');
        try {
          return await push(rows);
        } catch (error) {
          if (!(error instanceof CandidatePendingConflictError)) throw error;
          // The only wakeups are explicit review resolution, an owner/session
          // invalidation, or stop. No interval or background Auth/network
          // polling runs while a human decision is outstanding.
          await waitForReviewClear(error.documentId);
        }
      }
    };
    const state = replicateRxCollection<D, CandidateCheckpoint>({
      replicationIdentifier:
        'mosaic-supabase-poc-v1:' + domain + ':' +
        identity.legacyUserId + ':' + identity.supabaseUserId,
      collection,
      live: true,
      retryTime: 5_000,
      waitForLeadership: true,
      toggleOnDocumentVisible: true,
      pull: {
        batchSize: 100,
        stream$: stream.asObservable(),
        handler: pull,
      },
      push: {
        batchSize: 20,
        handler: pushAfterReview,
      },
    });
    return {
      state,
      resync: () => state.reSync(),
      stop: async () => {
        // Release parked jobs BEFORE awaiting RxDB cancellation so close,
        // logout, and tab teardown cannot deadlock on an unresolved draft.
        stopped = true;
        clearAllReviews();
        stream.complete();
        try {
          await state.cancel();
        } finally {
          conflictEvents.complete();
        }
      },
    };
  }

  return {
    pull, push, start, listPendingConflicts, refreshPendingConflict, resolveKeepLocal,
    conflictEvents$: conflictEvents.asObservable(),
  };
}
