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
  // Keep the contract explicit to TypeScript as well as the runtime guard:
  // untyped migration documents must never create a row ID from non-string data.
  const semanticId = doc.id;
  if (typeof semanticId !== 'string') unavailable();
  const domain=DOMAIN_FOR_COLLECTION[collection];
  const rowId=await deriveMigratedOwnerRowId(session.root,owner,domain,semanticId);
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

/**
 * Authenticated, incremental *server mutation* cursor for eventual encrypted
 * RxDB replication. Never resume by opaque row ID alone: an update to an
 * earlier row would otherwise be silently skipped. The server orders by
 * Appwrite's server-owned $updatedAt and then $id.
 *
 * This feed is staged, not connected to the existing plaintext replication.
 * Its safety does not establish old-client write denial or cutover readiness.
 */
export type EncryptedOwnerChangeCursor = Readonly<{
  updatedAt: string;
  rowId: string;
}>;
export type VerifiedOwnerChange = Readonly<{
  document: Record<string, unknown> & { __e2eeRevision: string };
  rowId: string;
  serverUpdatedAt: string;
}>;
export type VerifiedOwnerChangePage = Readonly<{
  documents: ReadonlyArray<VerifiedOwnerChange>;
  cursor: EncryptedOwnerChangeCursor | null;
  hasMore: boolean;
}>;
const SERVER_CHANGE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
function validChangeTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 50 &&
    SERVER_CHANGE_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}
function validChangeCursor(value: unknown): value is EncryptedOwnerChangeCursor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o=value as Record<string, unknown>;
  return Object.keys(o).length===2 && Object.hasOwn(o,'updatedAt') &&
    Object.hasOwn(o,'rowId') && validChangeTimestamp(o.updatedAt) &&
    typeof o.rowId==='string' && /^p_[a-f0-9]{32}$/.test(o.rowId);
}

/**
 * Check one <=20-record page and its *exact* server cursor after decrypting
 * every row. Invalid, replayed or out-of-order metadata fails closed.
 * A subsequent poll MUST reuse the last verified cursor, not the row-ID
 * snapshot scan. This API does not claim an atomic cross-page snapshot.
 */
export async function listAndDecryptOwnerChanges(
  owner: Owner, session: CryptoSession, collection: OwnerOnlyCollection,
  rpc: EncryptedOwnerRpc, gate: FullyAuthenticatedSessionGate,
  after: EncryptedOwnerChangeCursor | null = null,
): Promise<VerifiedOwnerChangePage> {
  check(owner,session);
  if (!collectionAllowed(collection) ||
      (after!==null && !validChangeCursor(after))) unavailable();
  await gate.assertReady(owner);
  const response=await rpc.send('changes',after ? {collection,after} : {collection});
  if (response.ok!==true || !Array.isArray(response.rows) ||
      response.rows.length>20 || typeof response.hasMore!=='boolean' ||
      response.hasMore!==(response.rows.length===20)) unavailable();
  let previous:EncryptedOwnerChangeCursor|null=after;
  const documents: VerifiedOwnerChange[]=[];
  for(const entry of response.rows) {
    if(!entry || typeof entry!=='object' || Array.isArray(entry)) unavailable();
    const item=entry as Record<string, unknown>;
    if(Object.keys(item).length!==2 || !Object.hasOwn(item,'record') ||
       !Object.hasOwn(item,'serverUpdatedAt') ||
       !validChangeTimestamp(item.serverUpdatedAt)) unavailable();
    const record=inspectRecord(owner,collection,item.record);
    const current={updatedAt:item.serverUpdatedAt,rowId:record.rowId};
    if(previous &&
       (Date.parse(current.updatedAt)<Date.parse(previous.updatedAt) ||
        (current.updatedAt===previous.updatedAt && current.rowId<=previous.rowId)))
      unavailable();
    const document=await decodeAuthenticatedOwnerRow(owner,session,collection,
      record.rowId,item.record);
    documents.push({document,rowId:record.rowId,serverUpdatedAt:current.updatedAt});
    previous=current;
  }
  if(response.after!==null && !validChangeCursor(response.after)) unavailable();
  const actual=response.after as EncryptedOwnerChangeCursor|null;
  if((previous===null)!==(actual===null) ||
     (previous!==null && actual!==null &&
      (actual.updatedAt!==previous.updatedAt || actual.rowId!==previous.rowId)))
    unavailable();
  return {documents,cursor:previous,hasMore:response.hasMore};
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
      if (!['create_root','read_root','replace_root','put','get','list','changes','media_put_chunk','media_get_chunk'].includes(operation))
        unavailable();
      // Server-side media storage + independent readback can outlast the
      // default action deadline. Stay inside Appwrite's 30s sync ceiling.
      return sendAppAction({
        action:'e2ee_owner_v1',operation,...input,
        ownerId:owner.ownerId,projectId:owner.projectId,
      }, operation.startsWith('media_') ? 28_000 : 15_000);
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
