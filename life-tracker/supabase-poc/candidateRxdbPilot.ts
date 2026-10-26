/**
 * Isolated #967/#1027 RxDB pilot: private tasks/categories/Diary/Settings/Bucket List and links.
 * Settings, Bucket List and links are strictly source-only and not activated by the core bridge.
 *
 * Imported by the gated app-owned core bridge, not by Mosaic's shipped
 * Appwrite replication or automatic database bootstrap.
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
import type { TaskDocument, CategoryDocument, DiaryDocument, SettingsDocument, BucketListDocument, BucketTaskLinkDocument } from '../src/db/schema';
import { fromCandidateBucketRow, fromCandidateBucketLinkRow, toCandidateBucketWrite, toCandidateBucketLinkWrite,
  type CandidateBucketRow, type CandidateBucketLinkRow } from './candidateBucketMapping';
import { fromCandidateSettingRow, toCandidateSettingWrite, type CandidateSettingRow } from './candidateSettingsMapping';
import {
  fromCandidateCategoryRow, fromCandidateTaskRow, fromCandidateDiaryRow,
  parseCandidateRevision, toCandidateCategoryWrite, toCandidateTaskWrite, toCandidateDiaryWrite,
  validateCandidateIdentity, type CandidateCategoryRow, type CandidateTaskRow, type CandidateDiaryRow,
  type CandidateIdentity,
} from './candidateMapping';
import {
  pullCandidateCategories, pullCandidateTasks, pullCandidateDiary, pullCandidateSettings,
  pullCandidateBuckets, pullCandidateBucketLinks,
  type CandidateChangeTransport, type CandidateCheckpoint, type CandidateReadDomain,
} from './candidatePull';
import type { createCandidateCreateTransport } from './candidateCreateTransport';
import type { createCandidateCasTransport } from './candidateCasTransport';
import { CandidateAuthError, type CandidateSessionProvider } from './candidateHttpTransport';

type Document = TaskDocument | CategoryDocument | DiaryDocument | SettingsDocument | BucketListDocument | BucketTaskLinkDocument;
type Row = CandidateTaskRow | CandidateCategoryRow | CandidateDiaryRow | CandidateSettingRow | CandidateBucketRow | CandidateBucketLinkRow;
type Replicated<D extends Document> = WithDeletedAndAttachments<D>;
type Writer = ReturnType<typeof createCandidateCreateTransport>;
type Cas = ReturnType<typeof createCandidateCasTransport>;
export type CandidateVerifiedBucketLinkTargets = Parameters<Writer['createBucketLink']>[2];
const SHORT_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;

export interface CandidateReplicaScan {
  phase: 'remote' | 'local';
  pages: number;
  rows: number;
  checked: number;
  total: number;
}

export type CandidateConflictReason =
  | 'missing-master' | 'divergent-master' | 'duplicate-create'
  | 'cas-conflict' | 'unconfirmed-write' | 'protected-field-change';

export interface CandidateConflictReview<D extends Document> {
  domain: CandidateReadDomain;
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
  readonly domain: CandidateReadDomain;
  readonly documentId: string;
  constructor(domain: CandidateReadDomain, documentId: string) {
    super('Supabase candidate remote conflict requires explicit local-edit resolution');
    this.domain = domain;
    this.documentId = documentId;
    this.name = 'CandidatePendingConflictError';
  }
}

export interface CandidateRxdbPilotOptions<D extends Document> {
  domain: CandidateReadDomain;
  identity: CandidateIdentity;
  session: CandidateSessionProvider;
  changes: CandidateChangeTransport;
  writer: Writer;
  cas: Cas;
  /** Must be an isolated test collection, never a currently Appwrite-replicated collection. */
  collection?: RxCollection<D>;
  /**
   * Explicit, trusted *complete owner* target inventory for each attempted
   * link push. A missing, long, deleted-active or foreign reference is parked,
   * not guessed/rewritten. A verified session is rechecked after every await.
   */
  verifyBucketLinkTargets?: (doc: BucketTaskLinkDocument) => Promise<CandidateVerifiedBucketLinkTargets>;
}

function assertedDomain(value: CandidateReadDomain): void {
  if (value !== 'tasks' && value !== 'categories' && value !== 'diary' && value !== 'settings' &&
      value !== 'buckets' && value !== 'bucket_task_links')
    throw new Error('Unsupported candidate RxDB replication domain');
}

/** Compare fields that Mosaic actually stores; ignore SQL-only revision/time. */
function canonical(domain: CandidateReadDomain, doc: Document, owner: CandidateIdentity): string {
  return JSON.stringify(domain === 'tasks'
    ? toCandidateTaskWrite(doc as TaskDocument, owner)
    : domain === 'categories'
      // PostgreSQL returns the newly-added retirement column's empty
      // default even when an older local RxDB category omits this optional
      // field. Compare normalized values, without inventing a client write
      // or discarding a real retirement cutoff.
      ? toCandidateCategoryWrite({
          ...(doc as CategoryDocument),
          retiredOn: (doc as CategoryDocument).retiredOn ?? '',
        }, owner)
      : domain === 'diary'
        ? toCandidateDiaryWrite(doc as DiaryDocument, owner)
        : domain === 'settings' ? toCandidateSettingWrite(doc as SettingsDocument, owner)
        : domain === 'buckets' ? toCandidateBucketWrite(doc as BucketListDocument, owner)
        : toCandidateBucketLinkWrite(doc as BucketTaskLinkDocument, owner));
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
      : domain === 'categories'
        ? fromCandidateCategoryRow(row as CandidateCategoryRow, identity)
        : domain === 'diary'
          ? fromCandidateDiaryRow(row as CandidateDiaryRow, identity)
          : domain === 'settings'
            ? fromCandidateSettingRow(row as CandidateSettingRow, identity)
            : domain === 'buckets'
              ? fromCandidateBucketRow(row as CandidateBucketRow, identity)
              : fromCandidateBucketLinkRow(row as CandidateBucketLinkRow, identity)) as D,
    _deleted: false,
  });

  function checkedRow(row: Row): Revisioned {
    if (!row || row.owner_id !== identity.supabaseUserId ||
      typeof row.is_deleted !== 'boolean' ||
      parseCandidateRevision(row.change_seq) < 1n) {
      throw new Error('Malformed or foreign Supabase candidate master');
    }
    if (domain === 'bucket_task_links') {
      const link = row as CandidateBucketLinkRow;
      if (!SHORT_REFERENCE.test(link.bucket_list_id) ||
          !SHORT_REFERENCE.test(link.task_id))
        throw new Error('Remote Bucket link has an unrepresentable historical target reference');
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
      : domain === 'categories'
        ? await pullCandidateCategories({ identity, transport: changes, checkpoint, batchSize })
        : domain === 'diary'
          ? await pullCandidateDiary({ identity, transport: changes, checkpoint, batchSize })
          : domain === 'settings'
            ? await pullCandidateSettings({ identity, transport: changes, checkpoint, batchSize })
            : domain === 'buckets'
              ? await pullCandidateBuckets({ identity, transport: changes, checkpoint, batchSize })
              : await pullCandidateBucketLinks({ identity, transport: changes, checkpoint, batchSize });
    const after = await guardedSession();
    if (after.sessionEpoch !== before.sessionEpoch || after.accessToken !== before.accessToken) {
      clearAllReviews();
      throw new CandidateAuthError('Candidate RxDB account changed during pull');
    }
    return {
      // The selected domain fixes D at runtime; TS cannot narrow the generic
      // from the runtime domain union. Owner/schema validation happens in pull.
      documents: result.documents as unknown as Replicated<D>[],
      checkpoint: result.checkpoint,
    };
  }

  async function readMaster(id: string): Promise<Revisioned | null> {
    const row = domain === 'tasks'
      ? await writer.readTaskMaster(id, identity)
      : domain === 'categories'
        ? await writer.readCategoryMaster(id, identity)
        : domain === 'diary'
          ? await writer.readDiaryMaster(id, identity)
          : domain === 'settings'
            ? await writer.readSettingMaster(id, identity)
            : domain === 'buckets'
              ? await writer.readBucketMaster(id, identity)
              : await writer.readBucketLinkMaster(id, identity);
    return row ? checkedRow(row) : null;
  }

  async function create(doc: Replicated<D>, references?: CandidateVerifiedBucketLinkTargets): Promise<Revisioned | null> {
    if (domain === 'bucket_task_links' && !references)
      throw new Error('Bucket task-link insert requires independently verified targets');
    if (domain === 'tasks' && ((doc as TaskDocument).reactions ?? '') !== '')
      recordConflict(doc, null, null, 'protected-field-change');
    const result = domain === 'tasks'
      ? await writer.createTask(doc as TaskDocument, identity)
      : domain === 'categories'
        ? await writer.createCategory(doc as CategoryDocument, identity)
        : domain === 'diary'
          ? await writer.createDiary(doc as DiaryDocument, identity)
          : domain === 'settings'
            ? await writer.createSetting(doc as SettingsDocument, identity)
            : domain === 'buckets'
              ? await writer.createBucket(doc as BucketListDocument, identity)
              : await writer.createBucketLink(doc as BucketTaskLinkDocument, identity,
                  references as CandidateVerifiedBucketLinkTargets);
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

  function makeOwnerPatch(
    local: Replicated<D>, master: Replicated<D>,
  ): Record<string, string | number | boolean | null> | null {
    if (domain === 'tasks') {
      const current = toCandidateTaskWrite(local as TaskDocument, identity);
      const previous = toCandidateTaskWrite(master as TaskDocument, identity);
      if (current.created_at !== previous.created_at ||
          current.reactions !== previous.reactions) return null;
      const { owner_id: _owner, id: _id, created_at: _created,
        reactions: _reactions, ...patch } = current;
      void _owner;
      void _id;
      void _created;
      void _reactions;
      return patch;
    }
    if (domain === 'diary') {
      const current = toCandidateDiaryWrite(local as DiaryDocument, identity);
      const previous = toCandidateDiaryWrite(master as DiaryDocument, identity);
      // Calendar date, visibility, owner and creation time remain immutable.
      // Owner-private photo arrays use the same revision-fenced Diary CAS.
      if (current.entry_date !== previous.entry_date ||
          current.visibility !== previous.visibility ||
          current.created_at !== previous.created_at) return null;
      return {
        content: current.content, emoji: current.emoji,
        photos: current.photos,
        updated_at: current.updated_at, is_deleted: current.is_deleted,
      };
    }
    if (domain === 'buckets') {
      const current = toCandidateBucketWrite(local as BucketListDocument, identity);
      const previous = toCandidateBucketWrite(master as BucketListDocument, identity);
      if (current.created_at !== previous.created_at) return null;
      return {
        title: current.title, description: current.description, achieved: current.achieved,
        achieved_at: current.achieved_at, updated_at: current.updated_at,
        is_deleted: current.is_deleted,
      };
    }
    if (domain === 'bucket_task_links') {
      const current = toCandidateBucketLinkWrite(local as BucketTaskLinkDocument, identity);
      const previous = toCandidateBucketLinkWrite(master as BucketTaskLinkDocument, identity);
      if (current.created_at !== previous.created_at ||
          current.bucket_list_id !== previous.bucket_list_id ||
          current.task_id !== previous.task_id) return null;
      return { updated_at: current.updated_at, is_deleted: current.is_deleted };
    }
    if (domain === 'settings') {
      const current = toCandidateSettingWrite(local as SettingsDocument, identity);
      const previous = toCandidateSettingWrite(master as SettingsDocument, identity);
      // A settings key names one unique owner preference. Never change it with
      // CAS, even if another device or local cache changed the row contents.
      if (current.setting_key !== previous.setting_key) return null;
      return {
        setting_value: current.setting_value,
        updated_at: current.updated_at,
        is_deleted: current.is_deleted,
      };
    }
    const category = toCandidateCategoryWrite(local as CategoryDocument, identity);
    // Fixed concrete category CAS shape; optional retirement is deliberately
    // absent rather than an own-property with undefined. PostgREST must never
    // receive a patch whose JSON shape depends on TypeScript union inference.
    return {
      name: category.name,
      color: category.color,
      order_index: category.order_index,
      visibility: category.visibility,
      icon: category.icon,
      updated_at: category.updated_at,
      is_deleted: category.is_deleted,
      ...(category.retired_on !== undefined ? { retired_on: category.retired_on } : {}),
    };
  }

  async function verifiedLinkReferences(
    doc: Replicated<D>, fence: () => Promise<void>,
  ): Promise<CandidateVerifiedBucketLinkTargets> {
    const link = doc as BucketTaskLinkDocument;
    const refs = options.verifyBucketLinkTargets;
    if (!refs) throw new Error('Isolated Bucket link replica has no trusted target inventory');
    const value = toCandidateBucketLinkWrite(link, identity);
    // The source mapper retains 255-character historic Appwrite IDs for
    // quarantine. They are NEVER silently sent to the 36-char SQL table.
    if (!SHORT_REFERENCE.test(value.task_id))
      throw new Error('Historical Bucket link is unrepresentable; quarantine before replication');
    const checked = await refs(link);
    await fence();
    if (!checked || !(checked.buckets instanceof Map) || !(checked.tasks instanceof Map))
      throw new Error('Bucket link target inventory is absent or incomplete');
    const bucket = checked.buckets.get(link.bucketListId);
    const task = checked.tasks.get(link.taskId);
    if (!bucket || !task ||
        bucket.userId !== identity.legacyUserId || task.userId !== identity.legacyUserId ||
        (!link.isDeleted && (bucket.isDeleted || task.isDeleted)))
      throw new Error('Bucket link has missing, foreign or retired targets; quarantine required');
    return checked;
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
      // Validate the whole next/assumed setting *before* ANY remote master
      // read or create. The transport also checks, but must not be invoked
      // for avatar/file IDs, friend references or unportable value types.
      // A rejected pending RxDB write remains local and unacknowledged.
      if (domain === 'settings' || domain === 'buckets' || domain === 'bucket_task_links') {
        canonical(domain, next, identity);
        if (assumed) canonical(domain, assumed, identity);
      }
      // A link with unresolved targets must park its local draft, not write it
      // or advance the native RxDB checkpoint. Only a trusted owner callback
      // can supply the complete target inventory for a real link write.
      let linkReferences: CandidateVerifiedBucketLinkTargets | undefined;
      if (domain === 'bucket_task_links') {
        try {
          linkReferences = await verifiedLinkReferences(next, fence);
        } catch (error) {
          if (error instanceof CandidateAuthError) throw error;
          recordConflict(next, assumed ?? null, null, 'protected-field-change');
        }
      }
      // Refuse Diary visibility escalation before canonicalizing a local
      // draft; preserve that draft for explicit review, never acknowledge it.
      if (domain === 'diary' && (next as DiaryDocument).visibility !== 'private')
        recordConflict(next, assumed ?? null, null, 'protected-field-change');

      const master = await readMaster(next.id);
      await fence();
      if (!master) {
        // The remote master unexpectedly disappeared after an acknowledged
        // revision. Do not recreate a missing/tombstoned record silently.
        if (assumed) recordConflict(next, assumed, null, 'missing-master');
        await create(next, linkReferences);
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

      const patch = makeOwnerPatch(next, master.document);
      if (!patch) recordConflict(next, assumed, master, 'protected-field-change');
      const result = await cas.compareAndSet<Row>({
        domain,
        ownerId: identity.supabaseUserId,
        documentId: next.id,
        expectedRevision: master.revision,
        patch,
        ...(domain === 'bucket_task_links' ? {
          expectedLinkReferences: {
            bucketListId: (next as BucketTaskLinkDocument).bucketListId,
            taskId: (next as BucketTaskLinkDocument).taskId,
          },
        } : {}),
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
    // RxDB returns deeply readonly snapshots; the replication wrapper is
    // structurally compatible here and must remain immutable.
    const local = document.toJSON() as unknown as Replicated<D>;
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
    // RxDB returns deeply readonly snapshots; the replication wrapper is
    // structurally compatible here and must remain immutable.
    const local = document.toJSON() as unknown as Replicated<D>;
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
    const patch = makeOwnerPatch(local, master.document);
    if (!patch) recordConflict(local, review.base, master, 'protected-field-change');
    if (domain === 'bucket_task_links') {
      try {
        await verifiedLinkReferences(local, fence);
      } catch (error) {
        if (error instanceof CandidateAuthError) throw error;
        recordConflict(local, review.base, master, 'protected-field-change');
      }
    }
    const result = await cas.compareAndSet<Row>({
      domain, ownerId: identity.supabaseUserId, documentId,
      expectedRevision: master.revision, patch,
      ...(domain === 'bucket_task_links' ? {
        expectedLinkReferences: {
          bucketListId: (local as BucketTaskLinkDocument).bucketListId,
          taskId: (local as BucketTaskLinkDocument).taskId,
        },
      } : {}),
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

  /**
   * Explicit, read-only anti-entropy proof. Every server row (including soft
   * tombstones) is fetched from revision 0 under the current signed owner.
   * This does NOT edit RxDB, advance native replication checkpoints or
   * acknowledge pending offline writes. Unexpected drift fails closed until
   * a separately accepted conflict-aware repair path exists.
   */
  async function verifyLocalReplica(onScan?: (progress: CandidateReplicaScan) => void) {
    const collection = options.collection;
    if (!collection) throw new Error('Supabase audit requires the active owner collection');
    const before = await guardedSession();
    const assertSameSession = async () => {
      const latest = await guardedSession();
      if (latest.sessionEpoch !== before.sessionEpoch ||
          latest.accessToken !== before.accessToken)
        throw new CandidateAuthError('Supabase audit owner changed during verification');
    };
    // The shared local RxDB can retain other accounts' cached records. Read
    // locally, but compare ONLY documents owned by the currently signed user.
    // Never inspect/repair/delete unrelated owner rows as part of this audit.
    const docs = await collection.find().exec();
    await assertSameSession();
    if (docs.length > 100_000) throw new Error('Supabase audit local row cap exceeded');
    const locals = new Map<string, { value: string; doc: (typeof docs)[number] }>();
    for (const doc of docs) {
      const json = doc.toJSON() as D;
      if (json.userId !== identity.legacyUserId) continue;
      if (typeof json.id !== 'string' || locals.has(json.id))
        throw new Error('Supabase audit found an invalid or foreign local document');
      locals.set(json.id, { value: canonical(domain, json, identity), doc });
    }
    const localTotal = locals.size;
    const remoteIds = new Set<string>();
    let pages = 0;
    let checked = 0;
    let mismatch = false;
    let after = 0n;
    const batchSize = 100;
    for (;;) {
      if (pages >= 1_000) throw new Error('Supabase audit remote page cap exceeded');
      const rows = await changes.listChanges<Row>({
        domain, ownerId: identity.supabaseUserId,
        afterExclusive: after.toString(), batchSize,
      });
      await assertSameSession();
      if (!Array.isArray(rows) || rows.length > batchSize)
        throw new Error('Supabase audit response page invalid');
      pages++;
      for (const row of rows) {
        const current = checkedRow(row);
        const revision = BigInt(current.revision);
        const id = current.document.id;
        if (revision <= after || remoteIds.has(id))
          throw new Error('Supabase audit rejected duplicate or out-of-order owner data');
        after = revision;
        remoteIds.add(id);
        checked++;
        const local = locals.get(id);
        if (!local || local.value !== canonical(domain, current.document, identity))
          mismatch = true;
      }
      onScan?.({ phase: 'remote', pages, rows: checked, checked: 0, total: localTotal });
      if (rows.length < batchSize) break;
    }
    let localChecked = 0;
    for (const [id, local] of locals) {
      if (localChecked % batchSize === 0) await assertSameSession();
      // A local edit during verification invalidates its snapshot. Do not
      // classify that concurrent write as a safely repairable stale cache.
      const latest = local.doc.toJSON() as D;
      if (canonical(domain, latest, identity) !== local.value ||
          !remoteIds.has(id)) mismatch = true;
      localChecked++;
      if (localChecked % batchSize === 0 || localChecked === localTotal)
        onScan?.({ phase: 'local', pages, rows: checked,
          checked: localChecked, total: localTotal });
    }
    if (localTotal === 0)
      onScan?.({ phase: 'local', pages, rows: checked, checked: 0, total: 0 });
    await assertSameSession();
    if (mismatch) throw new Error(
      'Supabase ' + domain + ' local/cloud verification found a difference. ' +
      'Local edits were preserved; no automatic overwrite was attempted.'
    );
    return { pages, rows: checked, localChecked, localTotal };
  }

  function start(collection = options.collection) {
    if (!collection) throw new Error('Isolated RxDB candidate collection required');
    if (domain === 'bucket_task_links' && !options.verifyBucketLinkTargets)
      throw new Error('Bucket link replication requires reviewed owner target inventory');
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
    pull, push, start, verifyLocalReplica, listPendingConflicts, refreshPendingConflict, resolveKeepLocal,
    conflictEvents$: conflictEvents.asObservable(),
  };
}
