/**
 * Dormant, Scratch-only local ciphertext -> prospective v2 Function REHEARSAL.
 *
 * This module contains no Appwrite SDK, fetch, Function ID, API endpoint or
 * runtime enable flag. A test must supply a synthetic port. It MUST NOT be
 * connected to real transport until backend root-generation serialization,
 * exact Function/ACL/Scratch attestation, old-writer fence, review and rollout.
 *
 * This is neither a remote transaction guarantee nor an ACK: the encrypted
 * IndexedDB pending intent is NEVER acknowledged, deleted or rewritten here.
 */
import {type Bytes,type Owner} from './coreCrypto';
import {
  openV2PrivateOwnerDocument,SCRATCH_OWNER_V2_PROJECT,
  V2_OWNER_DOMAIN,type V2OwnerRecord,type OwnerV2Collection,
} from './ownerPrivateV2Contract';
import {
  readV2OwnerMigrationIntent,
} from './ownerV2PendingIntentStore';

export type OwnerV2CandidatePut=Readonly<{
  operation:'put';record:V2OwnerRecord;opId:string;
  expectedRevision:null;expectedGeneration:number;
}>;
export type OwnerV2CandidateGet=Readonly<{
  operation:'get';rowId:string;collection:OwnerV2Collection;
  expectedKeyId:string;expectedGeneration:number;expectedOpId:string;
}>;
export type OwnerV2CandidatePort=Readonly<{
  put:(input:OwnerV2CandidatePut)=>Promise<unknown>;
  get:(input:OwnerV2CandidateGet)=>Promise<unknown>;
}>;
export type OwnerV2RehearsalGate=Readonly<{
  /** Must be supplied by an independent genuine owner+MFA+epoch verifier. */
  assertReady:(owner:Owner)=>Promise<void>;
}>;
export type OwnerV2Rehearsal=Readonly<{
  status:'readback-verified-not-acknowledged';
  rowId:string;opId:string;revision:string;collection:OwnerV2Collection;
  keyGeneration:number;putStatus:'created'|'duplicate';
}>;

const ROW=/^p_[a-f0-9]{32}$/,KEY=/^k_[a-f0-9]{32}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const MAX_GENERATION=2147483647;
function denied():never{
  throw new Error('Owner ciphertext remote rehearsal incomplete; pending intent retained.');
}
function exact(value:unknown,names:readonly string[]):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Object.keys(value).length===names.length&&
    names.every(name=>Object.hasOwn(value,name));
}
function response(value:unknown,names:readonly string[]):
  Readonly<{status:number;body:Record<string,unknown>}>{
  if(!exact(value,['status','body'])||value.status!==200||
     !exact(value.body,names))denied();
  return value as {status:number;body:Record<string,unknown>};
}
function snapshot<T>(value:T):T{
  try{return structuredClone(value);}
  catch{return denied();}
}

/**
 * Reads an ALREADY durable authenticated ciphertext intent and proposes it to
 * an explicitly injected synthetic Function-shaped test adapter. Requires
 * byte-for-byte JSON readback AND independent local AEAD opening before
 * reporting a successful rehearsal. A 200 PUT response alone proves NOTHING.
 *
 * A thrown network exception, forged response, modified op/epoch/record or
 * competing local plan is a hard failure. The original IndexedDB plan survives.
 */
export async function rehearsePersistedOwnerV2RoundTrip(
  root:Bytes,owner:Owner,rowId:string,keyId:string,generation:number,
  port:OwnerV2CandidatePort,gate:OwnerV2RehearsalGate,
):Promise<OwnerV2Rehearsal>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||
     !owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     typeof rowId!=='string'||!ROW.test(rowId)||
     typeof keyId!=='string'||!KEY.test(keyId)||
     !Number.isSafeInteger(generation)||generation<1||
     generation>MAX_GENERATION||
     typeof port?.put!=='function'||typeof port?.get!=='function'||
     typeof gate?.assertReady!=='function')denied();
  const key=root.slice(),scope:Owner=Object.freeze({
    projectId:owner.projectId,ownerId:owner.ownerId,
  });
  try {
  await gate.assertReady(scope);
  // This readback reauthenticates both outer HMAC and inner AEAD,
  // including original opId, root generation and deterministic opaque ID.
  const pending=await readV2OwnerMigrationIntent(key,scope,rowId);
  if(!pending||pending.projectId!==scope.projectId||
     pending.ownerId!==scope.ownerId||pending.rowId!==rowId||
     pending.expectedRevision!==null||
     pending.expectedGeneration!==generation||
     pending.record.envelope.kid!==keyId)denied();
  const saved=snapshot(pending);
  const proposal:OwnerV2CandidatePut={
    operation:'put',record:snapshot(saved.record),opId:saved.opId,
    expectedRevision:null,expectedGeneration:generation,
  };
  // Explicitly check a reentrant owner/session gate before and after each
  // future remote step. This cannot replace a server-side atomic epoch fence.
  await gate.assertReady(scope);
  const submitted=response(await port.put(snapshot(proposal)),
    ['ok','status','revision']);
  if(submitted.body.ok!==true||
     !['created','duplicate'].includes(String(submitted.body.status))||
     submitted.body.revision!==saved.record.envelope.revision)denied();
  await gate.assertReady(scope);
  const selector:OwnerV2CandidateGet={
    operation:'get',rowId:saved.rowId,collection:saved.collection,
    expectedKeyId:keyId,expectedGeneration:generation,expectedOpId:saved.opId,
  };
  const readback=response(await port.get(snapshot(selector)),
    ['ok','record','opId','keyGeneration']);
  if(readback.body.ok!==true||readback.body.opId!==saved.opId||
     readback.body.keyGeneration!==generation||
     !exact(readback.body.record,[
       'policy','schemaVersion','projectId','ownerId','rowId',
       'collection','domain','routing','published','envelope',
     ])||
     JSON.stringify(readback.body.record)!==JSON.stringify(saved.record))denied();
  await openV2PrivateOwnerDocument(
    key,scope,{
      ...scope,rowId:saved.rowId,keyId,
      revision:saved.record.envelope.revision,
      payloadDomain:V2_OWNER_DOMAIN[saved.collection],
    },saved.collection,readback.body.record as V2OwnerRecord);
  const stillPending=await readV2OwnerMigrationIntent(key,scope,rowId);
  if(!stillPending||JSON.stringify(stillPending)!==JSON.stringify(saved))
    denied();
  await gate.assertReady(scope);
  return {
    status:'readback-verified-not-acknowledged',
    rowId:saved.rowId,opId:saved.opId,
    revision:saved.record.envelope.revision,collection:saved.collection,
    keyGeneration:generation,
    putStatus:submitted.body.status as 'created'|'duplicate',
  };
  } finally { key.fill(0); }
}
