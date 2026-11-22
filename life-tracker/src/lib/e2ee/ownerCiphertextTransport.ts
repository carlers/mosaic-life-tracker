/**
 * Staged M2 encrypted owner-record adapter, not connected to legacy sync.
 *
 * All client mutations are encrypted BEFORE they can become a network payload.
 * The owner root never crosses the boundary. Every successful mutation is
 * read back and locally AEAD-verified before a queued intent may be cleared.
 */
import {
  type Owner, type PrivateRecordContext, type RootEnvelope,
  deriveMigratedOwnerRowId, generateRevision, generateOperationId,
} from './coreCrypto';
import {
  type EncryptedOwnerRecord, DOMAIN_FOR_COLLECTION,
  encryptOwnerDocument, decryptOwnerDocument,
} from './ownerRecordCodec';
import type {
  AtomicRootTransport, FullyAuthenticatedSessionGate, RootGeneration,
  CryptoSession,
} from './accountRootLifecycle';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import { assertStagedPrivateOwnerDocument } from './ownerPrivateWritePolicy';
import { sendAppAction } from '../appAction';

export const OWNER_ONLY_COLLECTIONS = [
  'tasks','categories','diary','bucketList','bucketTaskLinks','settings',
] as const;
export type OwnerOnlyCollection = (typeof OWNER_ONLY_COLLECTIONS)[number];

export type EncryptedOwnerMutation = Readonly<{
  record: EncryptedOwnerRecord;
  expectedRevision: string | null;
  opId: string;
}>;
export interface EncryptedOwnerRpc {
  send(operation: string, input?: Record<string, unknown>): Promise<Record<string, unknown>>;
}
function unavailable(): never {
  throw new Error('Encrypted owner operation unavailable; no plaintext fallback permitted.');
}
function check(owner: Owner, session: CryptoSession): void {
  if (!owner?.projectId || !owner?.ownerId ||
      !/^k_[a-f0-9]{32}$/.test(session.keyId) ||
      !Number.isSafeInteger(session.generation) || session.generation < 1 ||
      !(session.root instanceof Uint8Array) || session.root.length !== 32) unavailable();
}
function collectionAllowed(value: string): value is OwnerOnlyCollection {
  return (OWNER_ONLY_COLLECTIONS as readonly string[]).includes(value);
}
function scope(owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  rowId: string, revision: string): PrivateRecordContext {
  return { ...owner, rowId, keyId: session.keyId,
    revision, payloadDomain: DOMAIN_FOR_COLLECTION[collection] };
}
function inspectRecord(owner: Owner, collection: OwnerOnlyCollection,
  remote: unknown): EncryptedOwnerRecord {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) unavailable();
  const data = remote as Record<string, unknown>;
  const allowed = [
    'projectId','ownerId','rowId','collection','domain','routing','published',
    'envelope','deleted','updatedAt',
  ];
  if (Object.keys(data).some(key => !allowed.includes(key)) ||
      data.projectId !== owner.projectId || data.ownerId !== owner.ownerId ||
      data.collection !== collection || data.domain !== DOMAIN_FOR_COLLECTION[collection] ||
      typeof data.rowId !== 'string' || !/^p_[a-f0-9]{32}$/.test(data.rowId) ||
      !data.routing || typeof data.routing !== 'object' ||
      !data.published || typeof data.published !== 'object' ||
      !data.envelope || typeof data.envelope !== 'object' ||
      data.deleted !== (data.routing as Record<string, unknown>).isDeleted) unavailable();
  return data as unknown as EncryptedOwnerRecord;
}
function envelopeContext(owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  remote: EncryptedOwnerRecord): PrivateRecordContext {
  return scope(owner, session, collection, remote.rowId,
    remote.envelope.revision);
}

/** Unique, stable mapping prevents duplicate creates after multi-device restore. */
export async function prepareEncryptedOwnerMutation(
  owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  doc: Record<string, unknown>, expectedRevision: string | null,
): Promise<EncryptedOwnerMutation> {
  check(owner,session);
  if (!collectionAllowed(collection) ||
      (expectedRevision !== null && !/^r_[a-f0-9]{32}$/.test(expectedRevision))) unavailable();
  // Never queue an unsafe owner-private record even if a caller bypasses the
  // full-snapshot shadow migration's separate freshness/completeness gate.
  assertStagedPrivateOwnerDocument(collection, doc, owner);
  const domain=DOMAIN_FOR_COLLECTION[collection];
  const rowId=await deriveMigratedOwnerRowId(session.root,owner,domain,doc.id);
  const revision=generateRevision();
  const record=await encryptOwnerDocument(session.root,collection,
    scope(owner,session,collection,rowId,revision),doc);
  return { record, opId:generateOperationId(), expectedRevision };
}

/**
 * Only ciphertext is sent. A lost acknowledgement/failed readback never
 * removes the pending intent; retry with EXACTLY the same envelope + opId.
 */
export async function commitEncryptedOwnerMutation(
  owner: Owner, session: CryptoSession, mutation: EncryptedOwnerMutation,
  rpc: EncryptedOwnerRpc, gate: FullyAuthenticatedSessionGate,
): Promise<Record<string, unknown>> {
  check(owner,session);
  if (!collectionAllowed(mutation.record.collection) ||
      mutation.record.ownerId !== owner.ownerId ||
      mutation.record.projectId !== owner.projectId ||
      mutation.record.envelope.kid !== session.keyId ||
      !/^o_[a-f0-9]{32}$/.test(mutation.opId)) unavailable();
  if (['tasks','categories','diary'].includes(mutation.record.collection) &&
      mutation.record.routing.visibility !== 'private') unavailable();
  await gate.assertReady(owner);
  const ack=await rpc.send('put', {
    record: mutation.record, opId:mutation.opId,
    expectedRevision:mutation.expectedRevision,
  });
  if (ack.ok !== true || !['created','updated','duplicate'].includes(String(ack.status)) ||
      ack.revision !== mutation.record.envelope.revision) unavailable();
  const verified=await fetchAndDecryptOwnerRecord(owner,session,
    mutation.record.collection as OwnerOnlyCollection,mutation.record.rowId,rpc,gate);
  if (verified.__e2eeRevision !== mutation.record.envelope.revision) unavailable();
  const doc = { ...verified };
  delete (doc as Record<string, unknown>).__e2eeRevision;
  return doc;
}

export async function fetchAndDecryptOwnerRecord(
  owner: Owner, session: CryptoSession,
  collection: OwnerOnlyCollection, rowId: string,
  rpc: EncryptedOwnerRpc, gate: FullyAuthenticatedSessionGate,
): Promise<Record<string, unknown> & { __e2eeRevision: string }> {
  check(owner,session);
  if (!collectionAllowed(collection) || !/^p_[a-f0-9]{32}$/.test(rowId)) unavailable();
  await gate.assertReady(owner);
  const result=await rpc.send('get',{collection,rowId});
  if (result.ok !== true) unavailable();
  return decodeAuthenticatedOwnerRow(owner,session,collection,rowId,result.row);
}

async function decodeAuthenticatedOwnerRow(
  owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  requestedRowId: string, input: unknown,
): Promise<Record<string, unknown> & { __e2eeRevision: string }> {
  const remote=inspectRecord(owner,collection,input);
  if (remote.rowId !== requestedRowId || remote.envelope.kid !== session.keyId) unavailable();
  const decrypted=await decryptOwnerDocument(session.root,collection,
    envelopeContext(owner,session,collection,remote),remote);
  if (typeof decrypted.id !== 'string' || decrypted.userId !== owner.ownerId) unavailable();
  const mapped=await deriveMigratedOwnerRowId(session.root,owner,
    DOMAIN_FOR_COLLECTION[collection],decrypted.id);
  if (mapped !== remote.rowId) unavailable();
  return {...decrypted, __e2eeRevision: remote.envelope.revision};
}

export type VerifiedOwnerPage = Readonly<{
  documents: ReadonlyArray<Record<string, unknown> & { __e2eeRevision: string }>;
  /** The opaque ID from the last verified row in the page. */
  next: string | null;
}>;

/**
 * Bound snapshot/page scan for cross-device encrypted record recovery.
 *
 * NOT a live RxDB replication stream: server lists in row-ID order, so a
 * checkpoint based only on row ID would MISS updates to earlier row IDs.
 * Until a reviewed monotonic mutation-feed exists, every scan begins at the
 * first row. Never pass its cursor to the legacy replication engine.
 */
export async function listAndDecryptOwnerPage(
  owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  rpc: EncryptedOwnerRpc, gate: FullyAuthenticatedSessionGate,
  after: string | null = null,
): Promise<VerifiedOwnerPage> {
  check(owner,session);
  if (!collectionAllowed(collection) ||
      (after !== null && !/^p_[a-f0-9]{32}$/.test(after))) unavailable();
  await gate.assertReady(owner);
  const result=await rpc.send('list', after ? {collection,after} : {collection});
  if (result.ok !== true || !Array.isArray(result.rows) ||
      result.rows.length > 20 ||
      (result.after !== null && typeof result.after !== 'string')) unavailable();
  const records=result.rows;
  if ((result.after !== null && records.length !== 20) ||
      (result.after === null && records.length > 20)) unavailable();
  const documents: Array<Record<string,unknown> & {__e2eeRevision:string}>=[];
  let previous=after;
  for(const input of records) {
    const record=inspectRecord(owner,collection,input);
    if (previous !== null && record.rowId <= previous) unavailable();
    documents.push(await decodeAuthenticatedOwnerRow(
      owner,session,collection,record.rowId,input));
    previous=record.rowId;
  }
  if (result.after !== null &&
      (previous === null || result.after !== previous)) unavailable();
  return {documents,next:result.after};
}

export async function scanAndDecryptOwnerCollection(
  owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  rpc: EncryptedOwnerRpc, gate: FullyAuthenticatedSessionGate,
): Promise<ReadonlyArray<Record<string,unknown> & {__e2eeRevision:string}>> {
  const all: Array<Record<string,unknown> & {__e2eeRevision:string}>=[];
  let cursor:string|null=null;
  const seen=new Set<string>();
  // Synthetic-only 500 record inventory. An over-limit scan must fail rather
  // than return a partial set falsely labeled as complete.
  for(let page=0;page<25;page++) {
    const nextPage=await listAndDecryptOwnerPage(owner,session,collection,rpc,gate,cursor);
    for(const record of nextPage.documents) {
      const id=record.id;
      if (typeof id!=='string' || seen.has(id)) unavailable();
      seen.add(id);
      all.push(record);
    }
    if(nextPage.next===null)return all;
    if (page===24) unavailable();
    cursor=nextPage.next;
  }
  return unavailable();
}

/**
 * Explicitly Scratch-only transport. This sends no root/private content: only
 * opaque root envelopes and encrypted owner records. The Function ALSO enforces
 * exact project, MFA, caller identity and an empty-by-default owner allowlist.
 */
export function createScratchOwnerRpc(owner: Owner): EncryptedOwnerRpc {
  if (APPWRITE_PROJECT_ID !== '6b00671500279e901846' ||
      APPWRITE_ENDPOINT !== 'https://129-221-244-67.sslip.io/v1' ||
      owner.projectId !== APPWRITE_PROJECT_ID) unavailable();
  return {
    async send(operation, input = {}) {
      if (!['create_root','read_root','replace_root','put','get','list'].includes(operation))
        unavailable();
      return sendAppAction({
        action:'e2ee_owner_v1',operation,...input,
        ownerId:owner.ownerId,projectId:owner.projectId,
      });
    },
  };
}
function errorCode(error: unknown): number | undefined {
  return (error && typeof error === 'object' && 'code' in error &&
    typeof error.code === 'number') ? error.code : undefined;
}
export function rootTransportFromRpc(rpc: EncryptedOwnerRpc): AtomicRootTransport {
  return {
    async create(owner, envelope: RootEnvelope) {
      if (!owner?.ownerId || !owner?.projectId) unavailable();
      try {
        const r=await rpc.send('create_root',{envelope});
        if (r.ok !== true || !['created','duplicate'].includes(String(r.status))) unavailable();
        return r.status as 'created' | 'duplicate';
      } catch(e) {
        if (errorCode(e)===409)return 'conflict';
        throw e;
      }
    },
    async read(owner): Promise<RootGeneration | null> {
      if (!owner?.projectId || !owner?.ownerId) unavailable();
      let result:Record<string,unknown>;
      try { result=await rpc.send('read_root'); }
      catch(e) {
        if(errorCode(e)===404)return null;
        throw e;
      }
      if(result.ok!==true || !Number.isSafeInteger(result.generation) ||
         (result.generation as number)<1 ||
         !result.envelope || typeof result.envelope!=='object') unavailable();
      return {generation:result.generation as number,envelope:result.envelope as RootEnvelope};
    },
    async replace(owner, expected, envelope) {
      if (!owner?.projectId || !owner?.ownerId) unavailable();
      try {
        const r=await rpc.send('replace_root',{
          expectedGeneration:expected.generation,
          expectedEnvelope:expected.envelope,envelope,
        });
        if (r.ok !== true || !['updated','duplicate'].includes(String(r.status))) unavailable();
        return 'updated';
      }catch(e) {
        if(errorCode(e)===409)return 'conflict';
        throw e;
      }
    },
  };
}
