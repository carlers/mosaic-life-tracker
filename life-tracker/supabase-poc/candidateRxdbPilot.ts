/**
 * Isolated #967 RxDB replication pilot: tasks/categories only.
 *
 * NOT imported by Mosaic's shipped Appwrite replication or database bootstrap.
 * RxDB owns its native durable pull/push checkpoints. Do not add a second
 * checkpoint store or start this alongside the Appwrite pilot on shared data.
 *
 * Until a conflict UI/merge strategy exists, ambiguous owner edits throw
 * instead of returning conflicting masters to RxDB's default winner strategy,
 * which could silently discard offline local changes.
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
    if (after.sessionEpoch !== before.sessionEpoch || after.accessToken !== before.accessToken)
      throw new CandidateAuthError('Candidate RxDB account changed during pull');
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
        throw new CandidatePendingConflictError(domain, doc.id);
      return remote;
    }
    // Failed normalization must never acknowledge an unexpected stored row.
    if (canonical(domain, doc, identity) !== canonical(domain, remote.document, identity))
      throw new CandidatePendingConflictError(domain, doc.id);
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
        if (assumed) throw new CandidatePendingConflictError(domain, next.id);
        await create(next);
        await fence();
        continue;
      }

      const remote = canonical(domain, master.document, identity);
      const nextValue = canonical(domain, next, identity);
      if (remote === nextValue) continue; // Response-lost replay or already synced.

      // Never auto-win on timestamp alone when no assumed master exists.
      if (!assumed || canonical(domain, assumed, identity) !== remote)
        throw new CandidatePendingConflictError(domain, next.id);

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
        if (latest && canonical(domain, latest.document, identity) === nextValue) continue;
        throw new CandidatePendingConflictError(domain, next.id);
      }
      const accepted = checkedRow(result.row);
      if (accepted.revision !== result.revision ||
        canonical(domain, accepted.document, identity) !== nextValue)
        throw new CandidatePendingConflictError(domain, next.id);
    }
    await fence();
    // No conflicts are passed to RxDB's default master-wins merge; unsafe
    // conflicts throw and keep the pending local push checkpoint unadvanced.
    return [];
  }

  function start(collection = options.collection) {
    if (!collection) throw new Error('Isolated RxDB candidate collection required');
    const stream = new Subject<RxReplicationPullStreamItem<D, CandidateCheckpoint>>();
    // No realtime guarantee yet. Caller must reSync() on foreground and
    // reconnect; RxDB itself persists checkpoints and retries failed pushes.
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
        handler: push,
      },
    });
    return {
      state,
      resync: () => state.reSync(),
      stop: async () => {
        stream.complete();
        await state.cancel();
      },
    };
  }

  return { pull, push, start };
}
