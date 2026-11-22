/**
 * Synthetic owner-private shadow migration for M2 (#1662/#2084).
 *
 * This only duplicates verified client-encrypted records into a new Scratch
 * ciphertext table. It NEVER deletes or modifies the legacy plaintext source,
 * marks an account E2EE-ready, disables old clients, or cuts over sync.
 *
 * Preflight rejects every unsupported record BEFORE the first remote write.
 * A resumed run must read back+decrypt each record, not trust a local marker.
 */
import { type Owner, type Bytes, deriveMigratedOwnerRowId } from './coreCrypto';
import type { CryptoSession, FullyAuthenticatedSessionGate } from './accountRootLifecycle';
import {
  OWNER_ONLY_COLLECTIONS, type OwnerOnlyCollection, type EncryptedOwnerRpc,
  prepareEncryptedOwnerMutation,
  fetchAndDecryptOwnerRecord,
} from './ownerCiphertextTransport';
import { DOMAIN_FOR_COLLECTION } from './ownerRecordCodec';
import { assertStagedPrivateOwnerDocument } from './ownerPrivateWritePolicy';
import {
  queueEncryptedOwnerIntent, replayEncryptedOwnerIntents,
  listEncryptedOwnerIntents,
} from './encryptedOwnerOutbox';

export type OwnerMigrationSource = Readonly<{
  owner: Owner;
  /** A full, fresh and stable owner-only snapshot supplied by a reviewed
      replication source; not a stale offline calendar viewport. */
  completeAndFresh: boolean;
  collections: Readonly<Record<OwnerOnlyCollection, readonly Record<string, unknown>[]>>;
}>;
export type ShadowMigrationProgress = Readonly<{
  staged: number;
  verifiedExisting: number;
  verifiedNew: number;
  sourceFingerprint: string;
  /** Never implies cutover/old-writer closure. */
  state: 'shadow-ciphertext-only';
}>;

function unsafe(reason: string): never { throw new Error('E2EE shadow migration blocked: ' + reason); }
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
}
function sameDoc(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys=Array.from(new Set([...Object.keys(a),...Object.keys(b)])).sort();
  for(const key of keys) {
    if (!Object.hasOwn(a,key) || !Object.hasOwn(b,key)) return false;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
  }
  return true;
}
function stableContent(doc: Record<string, unknown>): string {
  const entries=Object.keys(doc).sort().map(k=>[k,doc[k]]);
  return JSON.stringify(entries);
}
function validateSource(source: OwnerMigrationSource): {count:number; fingerprintSource: string} {
  if (!source.completeAndFresh) unsafe('source snapshot is offline or incomplete');
  if (!source.owner?.projectId || !source.owner?.ownerId || !source.collections)
    unsafe('source owner missing');
  const names=Object.keys(source.collections).sort();
  if (names.length !== OWNER_ONLY_COLLECTIONS.length ||
      names.some(n=>!OWNER_ONLY_COLLECTIONS.includes(n as OwnerOnlyCollection)))
    unsafe('owner collection inventory incomplete');
  const fingerprints:string[]=[];
  const seen=new Set<string>();
  let count=0;
  for(const collection of OWNER_ONLY_COLLECTIONS) {
    const docs=source.collections[collection];
    if(!Array.isArray(docs)) unsafe('owner collection not present');
    if(docs.length>500) unsafe('single-collection limit exceeded');
    for(const doc of docs) {
      assertStagedPrivateOwnerDocument(collection,doc,source.owner);
      const id=collection+'/'+doc.id;
      if(seen.has(id)) unsafe('duplicate local identity');
      seen.add(id);
      count++;
      fingerprints.push(collection+'/'+String(doc.id)+':'+stableContent(doc));
    }
  }
  if(count>500) unsafe('migration batch exceeds safe outbox capacity');
  return {count, fingerprintSource:fingerprints.sort().join('\u0000')};
}
/**
 * Privacy-preserving *local* migration receipt. A public SHA-256 of task
 * content could be matched against a dictionary of short diary/title text.
 * Derive a distinct, nonextractable HMAC key from the owner's root instead,
 * with a separate HKDF domain and project/owner binding. This digest is not
 * proof that the server has disabled legacy plaintext writes.
 */
export async function derivePrivateMigrationReceipt(
  source: OwnerMigrationSource, root: Bytes,
): Promise<string> {
  const {fingerprintSource}=validateSource(source);
  if (!(root instanceof Uint8Array) || root.length!==32) unsafe('root unavailable');
  const encoder=new TextEncoder();
  const initial=await crypto.subtle.importKey('raw',root,'HKDF',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',
    salt:encoder.encode('mosaic-e2ee/migration-receipt/v1'),
    info:encoder.encode(JSON.stringify([
      'mosaic-e2ee/migration-receipt-key/v1',
      source.owner.projectId,source.owner.ownerId,
    ])),
  },initial,{name:'HMAC',hash:'SHA-256',length:256},false,['sign']);
  const mac=await crypto.subtle.sign('HMAC',key,
    encoder.encode(fingerprintSource));
  return hex(new Uint8Array(mac));
}

/**
 * Only owner-private rows with NO unencrypted file references can be shadowed.
 * The caller must keep the UI locked against concurrent edits for this batch.
 */
export async function shadowMigrateOwnerSnapshot(
  source: OwnerMigrationSource,
  session: CryptoSession,
  gate: FullyAuthenticatedSessionGate,
  rpc: EncryptedOwnerRpc,
  /** Called after every successful authenticated readback, never with plaintext. */
  progress?: (counts: Readonly<{verifiedExisting:number; verifiedNew:number}>) => void,
): Promise<ShadowMigrationProgress> {
  const {count}=validateSource(source); // strict full-batch preflight
  if (!(session.root instanceof Uint8Array) || session.root.byteLength!==32)
    unsafe('root unavailable');
  const owner=source.owner;
  const fingerprint=await derivePrivateMigrationReceipt(source,session.root);
  await gate.assertReady(owner);
  // Never overwrite a queued intent from a lost previous response with newly
  // encrypted bytes. Verify/replay original intents first, or stop on conflict.
  await replayEncryptedOwnerIntents(owner,session,rpc,gate);
  if((await listEncryptedOwnerIntents(owner)).length) unsafe('unresolved ciphertext outbox');
  let existing=0,created=0;
  for(const collection of OWNER_ONLY_COLLECTIONS) {
    const items=source.collections[collection];
    for(const doc of items) {
      await gate.assertReady(owner);
      const domain=DOMAIN_FOR_COLLECTION[collection];
      const rowId=await deriveMigratedOwnerRowId(session.root,owner,domain,doc.id as string);
      let already:Record<string, unknown>|null=null;
      try {
        already=await fetchAndDecryptOwnerRecord(owner,session,collection,rowId,rpc,gate);
      }catch(error){
        // Only an explicit 404 is absence. Tampered/invalid ciphertext, MFA,
        // locked keys and offline failures MUST abort without plaintext fallback.
        const code=error && typeof error==='object' && 'code' in error ?
          (error as {code?:number}).code : undefined;
        if(code!==404)throw error;
      }
      if(already) {
        const existingDoc = { ...already };
        delete (existingDoc as Record<string, unknown>).__e2eeRevision;
        if(!sameDoc(existingDoc,doc)) unsafe('encrypted remote record differs from legacy snapshot');
        existing++;
      } else {
        const intent=await prepareEncryptedOwnerMutation(owner,session,collection,doc,null);
        // Staging precedes the server write, ensuring lost acknowledgments are
        // retried with the same opId, nonce and ciphertext.
        await queueEncryptedOwnerIntent(owner,intent);
        await replayEncryptedOwnerIntents(owner,session,rpc,gate);
        created++;
      }
      if(progress) progress({verifiedExisting:existing,verifiedNew:created});
    }
  }
  if(existing+created!==count) unsafe('mismatched verification count');
  // This is only a best-effort check of the immutable snapshot argument, not
  // a proof that every other device has stopped writing legacy plaintext.
  if(await derivePrivateMigrationReceipt(source,session.root)!==fingerprint) unsafe('source mutated during migration');
  return {staged:count,verifiedExisting:existing,verifiedNew:created,
    sourceFingerprint:fingerprint,state:'shadow-ciphertext-only'};
}
