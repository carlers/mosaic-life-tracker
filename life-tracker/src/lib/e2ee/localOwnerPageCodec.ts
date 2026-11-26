/**
 * Source-only, isolated-Scratch client cache codec. This produces ciphertext
 * for an eventual atomic IndexedDB page applier; never writes RxDB or network.
 * Do NOT treat its input as authenticated unless it came from the verified
 * owner change feed and passed the full session/owner gate.
 */
import {
  deriveMigratedOwnerRowId, encryptPrivateRecord, decryptPrivateRecord,
  generateRevision, type Owner, type RecordEnvelope,
} from './coreCrypto';
import type { CryptoSession } from './accountRootLifecycle';
import {
  OWNER_ONLY_COLLECTIONS, type OwnerOnlyCollection, type VerifiedOwnerChange,
} from './ownerCiphertextTransport';
import { DOMAIN_FOR_COLLECTION } from './ownerRecordCodec';
import { ownerPrivacyFields } from './fieldManifest';

const SCRATCH='6b00671500279e901846';
const revision=/^r_[a-f0-9]{32}$/;
const opaque=/^p_[a-f0-9]{32}$/;
const timestamp=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/;
function deny(): never { throw new Error('Local encrypted owner page rejected.'); }
export type StagedLocalOwnerRecord=Readonly<{
  version:1; projectId:string; ownerId:string;
  collection:OwnerOnlyCollection; rowId:string;
  keyId:string; generation:number; sourceRevision:string;
  serverUpdatedAt:string; localRevision:string;
  envelope:RecordEnvelope;
}>;
function scope(owner:Owner,session:CryptoSession,collection:OwnerOnlyCollection):void {
  if(owner?.projectId!==SCRATCH || !owner.ownerId ||
    !OWNER_ONLY_COLLECTIONS.includes(collection) ||
    !(session.root instanceof Uint8Array) || session.root.length!==32 ||
    !/^k_[a-f0-9]{32}$/.test(session.keyId) ||
    !Number.isSafeInteger(session.generation) || session.generation<1)deny();
}
function checkTime(value:unknown):value is string {
  return typeof value==='string' && value.length<=50 &&
    timestamp.test(value) && Number.isFinite(Date.parse(value));
}
function ctx(s:StagedLocalOwnerRecord) {
  return {projectId:s.projectId,ownerId:s.ownerId,
    payloadDomain:'local-cache' as const,
    rowId:s.rowId,keyId:s.keyId,revision:s.localRevision,
    publicRouting:{
      sourceDomain:DOMAIN_FOR_COLLECTION[s.collection],
      sourceRevision:s.sourceRevision,
      serverUpdatedAt:s.serverUpdatedAt,
    },
  };
}
function validateFields(collection:OwnerOnlyCollection,doc:Record<string,unknown>):void{
  const classes=ownerPrivacyFields[collection] as Record<string,string>;
  for(const key of Object.keys(doc))if(!Object.hasOwn(classes,key))deny();
}
function checkSealed(owner:Owner,session:CryptoSession,
  collection:OwnerOnlyCollection,input:unknown):StagedLocalOwnerRecord {
  if(!input || typeof input!=='object' || Array.isArray(input))deny();
  const s=input as Record<string,unknown>;
  if(Object.keys(s).length!==11 || s.version!==1 ||
    s.projectId!==owner.projectId || s.ownerId!==owner.ownerId ||
    s.collection!==collection || !opaque.test(String(s.rowId)) ||
    s.keyId!==session.keyId || s.generation!==session.generation ||
    !revision.test(String(s.sourceRevision)) ||
    !revision.test(String(s.localRevision)) ||
    !checkTime(s.serverUpdatedAt) ||
    !s.envelope || typeof s.envelope!=='object' || Array.isArray(s.envelope))deny();
  return s as unknown as StagedLocalOwnerRecord;
}

/** Encrypt the entire owner-local document, including all semantic IDs/dates. */
export async function sealVerifiedOwnerChange(
  owner:Owner, session:CryptoSession, collection:OwnerOnlyCollection,
  change:VerifiedOwnerChange,
):Promise<StagedLocalOwnerRecord> {
  scope(owner,session,collection);
  if(!change || !opaque.test(change.rowId) ||
     !checkTime(change.serverUpdatedAt) || !change.document ||
     change.document.userId!==owner.ownerId ||
     typeof change.document.id!=='string' ||
     !revision.test(change.document.__e2eeRevision))deny();
  const expected=await deriveMigratedOwnerRowId(session.root,owner,
    DOMAIN_FOR_COLLECTION[collection],change.document.id);
  if(expected!==change.rowId)deny();
  const payload:Record<string,unknown>={...change.document};
  delete payload.__e2eeRevision;
  validateFields(collection,payload);
  const header:StagedLocalOwnerRecord={
    version:1,projectId:owner.projectId,ownerId:owner.ownerId,
    collection,rowId:change.rowId,keyId:session.keyId,generation:session.generation,
    sourceRevision:change.document.__e2eeRevision,
    serverUpdatedAt:change.serverUpdatedAt,localRevision:generateRevision(),
    envelope:null as unknown as RecordEnvelope,
  };
  return {...header,envelope:await encryptPrivateRecord(session.root,ctx(header),payload)};
}
/** AEAD verifies metadata and source row ID before returning private payload. */
export async function openVerifiedLocalOwnerChange(
  owner:Owner,session:CryptoSession,collection:OwnerOnlyCollection,raw:unknown,
):Promise<VerifiedOwnerChange> {
  scope(owner,session,collection);
  const sealed=checkSealed(owner,session,collection,raw);
  const payload=await decryptPrivateRecord(session.root,ctx(sealed),sealed.envelope);
  if(payload.userId!==owner.ownerId || typeof payload.id!=='string')deny();
  validateFields(collection,payload);
  const mapped=await deriveMigratedOwnerRowId(session.root,owner,
    DOMAIN_FOR_COLLECTION[collection],payload.id);
  if(mapped!==sealed.rowId)deny();
  return {rowId:sealed.rowId,serverUpdatedAt:sealed.serverUpdatedAt,
    document:{...payload,__e2eeRevision:sealed.sourceRevision}};
}
/** Preflight all entries. A future IDB page applier must commit all or none. */
export async function sealVerifiedOwnerPage(
  owner:Owner,session:CryptoSession,collection:OwnerOnlyCollection,
  changes:readonly VerifiedOwnerChange[],
):Promise<readonly StagedLocalOwnerRecord[]> {
  scope(owner,session,collection);
  if(!Array.isArray(changes)||changes.length>20)deny();
  const output:StagedLocalOwnerRecord[]=[];
  const seen=new Set<string>();
  for(const change of changes){
    const s=await sealVerifiedOwnerChange(owner,session,collection,change);
    if(seen.has(s.rowId))deny();
    seen.add(s.rowId);
    output.push(s);
  }
  return output;
}
