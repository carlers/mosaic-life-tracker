/**
 * Isolated Scratch-only stepping stone for encrypted owner RxDB replication.
 * Uses authenticated AEAD change pages and a scoped, durable local CAS cursor.
 * No legacy sync write, real-owner migration, or Production activation.
 */
import type { Owner } from './coreCrypto';
import type { CryptoSession, FullyAuthenticatedSessionGate } from './accountRootLifecycle';
import {
  OWNER_ONLY_COLLECTIONS, listAndDecryptOwnerChanges,
  type OwnerOnlyCollection, type EncryptedOwnerRpc,
  type EncryptedOwnerChangeCursor, type VerifiedOwnerChange,
} from './ownerCiphertextTransport';

export interface OwnerFeedCheckpoint {
  schema: 1;
  projectId: string;
  ownerId: string;
  collection: OwnerOnlyCollection;
  keyId: string;
  generation: number;
  after: EncryptedOwnerChangeCursor;
}
export interface OwnerFeedCheckpointStore {
  read(owner: Owner, collection: OwnerOnlyCollection): Promise<OwnerFeedCheckpoint | null>;
  compareAndSet(
    owner: Owner, collection: OwnerOnlyCollection,
    expected: OwnerFeedCheckpoint | null, next: OwnerFeedCheckpoint,
  ): Promise<boolean>;
}
/** Must apply the whole page durably/idempotently or reject without committing. */
export interface OwnerFeedPageApplier {
  apply(page: ReadonlyArray<VerifiedOwnerChange>, owner: Owner,
    collection: OwnerOnlyCollection): Promise<void>;
}
export type OwnerFeedProgress = Readonly<{
  pages: number;
  records: number;
  lastCursor: EncryptedOwnerChangeCursor | null;
  moreMayRemain: boolean;
  state: 'verified-changes-staged';
}>;
const MAX_PAGES_PER_PASS = 25;
const SCRATCH_PROJECT = '6b00671500279e901846';
function unavailable(): never {
  throw new Error('Authenticated owner feed checkpoint unavailable.');
}
function validCursor(input: unknown): input is EncryptedOwnerChangeCursor {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const item = input as Record<string,unknown>;
  return Object.keys(item).length === 2 && typeof item.updatedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(item.updatedAt) &&
    Number.isFinite(Date.parse(item.updatedAt)) &&
    typeof item.rowId === 'string' && /^p_[a-f0-9]{32}$/.test(item.rowId);
}
function verifyCheckpoint(owner: Owner, collection: OwnerOnlyCollection,
  session: CryptoSession, checkpoint: OwnerFeedCheckpoint | null): void {
  if (checkpoint === null) return;
  if (checkpoint.schema !== 1 || checkpoint.projectId !== owner.projectId ||
      checkpoint.ownerId !== owner.ownerId || checkpoint.collection !== collection ||
      checkpoint.keyId !== session.keyId || checkpoint.generation !== session.generation ||
      !validCursor(checkpoint.after)) unavailable();
}

/**
 * The caller MUST provide a local apply that guarantees idempotence after a
 * lost checkpoint acknowledgement. The checkpoint commits only after apply.
 * Never expose this method to existing plaintext push replication.
 */
export async function stageEncryptedOwnerChangeFeed(
  owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  rpc: EncryptedOwnerRpc, gate: FullyAuthenticatedSessionGate,
  store: OwnerFeedCheckpointStore, applier: OwnerFeedPageApplier,
  isOwnerCurrent: () => boolean,
): Promise<OwnerFeedProgress> {
  if (owner?.projectId !== SCRATCH_PROJECT || !owner.ownerId ||
      !OWNER_ONLY_COLLECTIONS.includes(collection) ||
      !(session.root instanceof Uint8Array) || session.root.length !== 32 ||
      !/^k_[a-f0-9]{32}$/.test(session.keyId) ||
      !Number.isSafeInteger(session.generation) || session.generation < 1 ||
      typeof isOwnerCurrent !== 'function' || !isOwnerCurrent())
    unavailable();
  await gate.assertReady(owner);
  if (!isOwnerCurrent()) unavailable();
  let previous = await store.read(owner, collection);
  verifyCheckpoint(owner,collection,session,previous);
  let cursor = previous?.after ?? null;
  let pages = 0, records = 0;
  for (; pages < MAX_PAGES_PER_PASS; pages++) {
    if (!isOwnerCurrent()) unavailable();
    await gate.assertReady(owner);
    const result = await listAndDecryptOwnerChanges(owner,session,collection,rpc,gate,cursor);
    if (!isOwnerCurrent()) unavailable();
    if (result.documents.length === 0) {
      if (result.hasMore) unavailable();
      return { pages, records, lastCursor: cursor, moreMayRemain:false,
        state:'verified-changes-staged' };
    }
    if (!result.cursor || !validCursor(result.cursor)) unavailable();
    await gate.assertReady(owner);
    if (!isOwnerCurrent()) unavailable();
    await applier.apply(result.documents,owner,collection);
    if (!isOwnerCurrent()) unavailable();
    const next: OwnerFeedCheckpoint = {
      schema:1,projectId:owner.projectId,ownerId:owner.ownerId,
      collection,keyId:session.keyId,generation:session.generation,
      after:result.cursor,
    };
    if (!(await store.compareAndSet(owner,collection,previous,next))) unavailable();
    previous = next;
    cursor = next.after;
    records += result.documents.length;
    if (!result.hasMore) return { pages:pages+1,records,lastCursor:cursor,
      moreMayRemain:false,state:'verified-changes-staged' };
  }
  // Preserve the last verified checkpoint but never present an over-limit pass
  // as a complete sync. A subsequent pass must continue from that cursor.
  return {pages,records,lastCursor:cursor,moreMayRemain:true,
    state:'verified-changes-staged'};
}
