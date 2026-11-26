/**
 * Phase D source-only new-device enrollment request and human comparison gate.
 * NOT an HPKE implementation, an approval receipt, replay defense, relay,
 * device enrollment, root-key transfer or authenticated identity directory.
 * Never send a root/recovery key or a private CryptoKey to the server.
 */
import type {Owner} from './coreCrypto';
import type {FullyAuthenticatedSessionGate} from './accountRootLifecycle';
import {SCRATCH_OWNER_V2_PROJECT} from './ownerPrivateV2Contract';

const PURPOSE='mosaic-e2ee/device-approval-request/v1';
const MAX_AGE_MS=5*60*1000;
const SKEW_MS=30*1000;
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const DEVICE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const KID=/^k_[a-f0-9]{32}$/;
const NONCE=/^n_[a-f0-9]{32}$/;
const REQUEST=/^q_[a-f0-9]{32}$/;
const B64=/^[A-Za-z0-9_-]{87}$/;
const enc=new TextEncoder();

export type DeviceApprovalRequest=Readonly<{
  schema:1;projectId:string;ownerId:string;
  requestId:string;nonce:string;newDeviceId:string;
  kem:'P-256';ephemeralPublicKey:string;
  keyId:string;rootGeneration:number;
  createdAt:number;expiresAt:number;
}>;
export type NewDeviceRequest=Readonly<{
  request:DeviceApprovalRequest;
  privateKey:CryptoKey; // memory-only, nonextractable; never serialize
}>;
export type DeviceApprovalPreflight=Readonly<{
  status:'fingerprint-matched-not-approved';
  fingerprint:string;
  request:DeviceApprovalRequest;
}>;

function denied():never{
  throw new Error('Trusted-device approval request is not authenticated or safe.');
}
function validOwner(owner:Owner):void{
  if(!owner||typeof owner.projectId!=='string'||
     typeof owner.ownerId!=='string'||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     !ID.test(owner.ownerId))denied();
}
function random(prefix:'q'|'n'):string{
  const buf=new Uint8Array(16);crypto.getRandomValues(buf);
  return prefix+'_'+Array.from(buf,n=>n.toString(16).padStart(2,'0')).join('');
}
function b64(bytes:Uint8Array):string{
  let out='';
  for(const byte of bytes)out+=String.fromCharCode(byte);
  return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function strictPublicKey(encoded:unknown):Promise<void>{
  if(typeof encoded!=='string'||!B64.test(encoded))denied();
  let raw:Uint8Array<ArrayBuffer>;
  try{
    const bin=atob(encoded.replace(/-/g,'+').replace(/_/g,'/')+'=');
    raw=Uint8Array.from(bin,c=>c.charCodeAt(0));
  }catch{return denied();}
  if(raw.length!==65||raw[0]!==4||b64(raw)!==encoded)denied();
  try{
    await crypto.subtle.importKey('raw',raw,
      {name:'ECDH',namedCurve:'P-256'},false,[]);
  }catch{return denied();}
}
async function strictRequestShape(request:DeviceApprovalRequest):Promise<void>{
  const names=['schema','projectId','ownerId','requestId','nonce','newDeviceId',
    'kem','ephemeralPublicKey','keyId','rootGeneration','createdAt','expiresAt'];
  if(!request||typeof request!=='object'||Array.isArray(request)||
     Object.keys(request).length!==names.length||
     names.some(k=>!Object.hasOwn(request,k))||
     request.schema!==1||typeof request.projectId!=='string'||
     request.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof request.ownerId!=='string'||!ID.test(request.ownerId)||
     typeof request.newDeviceId!=='string'||!DEVICE.test(request.newDeviceId)||
     typeof request.requestId!=='string'||!REQUEST.test(request.requestId)||
     typeof request.nonce!=='string'||!NONCE.test(request.nonce)||
     request.kem!=='P-256'||typeof request.keyId!=='string'||
     !KID.test(request.keyId)||
     !Number.isSafeInteger(request.rootGeneration)||
     request.rootGeneration<1||request.rootGeneration>2147483647||
     !Number.isSafeInteger(request.createdAt)||
     !Number.isSafeInteger(request.expiresAt)||
     request.createdAt<1||request.expiresAt<=request.createdAt||
     request.expiresAt-request.createdAt>MAX_AGE_MS)denied();
  await strictPublicKey(request.ephemeralPublicKey);
}
function checkTime(request:DeviceApprovalRequest,now:number):void{
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(request.createdAt)||
     !Number.isSafeInteger(request.expiresAt)||
     request.createdAt<1||request.expiresAt<=request.createdAt||
     request.expiresAt-request.createdAt>MAX_AGE_MS||
     request.createdAt>now+SKEW_MS||now>=request.expiresAt)denied();
}
async function validate(
  request:DeviceApprovalRequest,owner:Owner,
  trustedDeviceId:string,now:number,expectedKeyId:string,expectedGeneration:number,
):Promise<void>{
  validOwner(owner);
  await strictRequestShape(request);
  if(request.projectId!==owner.projectId||request.ownerId!==owner.ownerId||
     typeof trustedDeviceId!=='string'||!DEVICE.test(trustedDeviceId)||
     request.newDeviceId===trustedDeviceId||
     typeof expectedKeyId!=='string'||!KID.test(expectedKeyId)||
     request.keyId!==expectedKeyId||
     request.rootGeneration!==expectedGeneration)denied();
  checkTime(request,now);
}
function fields(...values:string[]):Uint8Array<ArrayBuffer>{
  const parts=values.map(v=>enc.encode(v));
  const result=new Uint8Array(parts.reduce((n,p)=>n+4+p.byteLength,0));
  if(result.length>4096)denied();
  const view=new DataView(result.buffer);
  let pos=0;
  for(const part of parts){
    view.setUint32(pos,part.length,false);pos+=4;
    result.set(part,pos);pos+=part.length;
  }
  return result;
}
/**
 * The one canonical length-framed, domain-separated public approval request
 * transcript. May be used as one component of an independently reviewed
 * HPKE info/AAD binding, but does NOT itself approve a device or authenticate
 * a relay. Every required request field is validated and included in order.
 */
export async function verifiedDeviceApprovalTranscript(
  request:DeviceApprovalRequest,
):Promise<Uint8Array<ArrayBuffer>>{
  // WebCrypto P-256 validation awaits. Never hash a caller-owned object after
  // checking an older version of its fields.
  let pinned:DeviceApprovalRequest;
  try{pinned=structuredClone(request);}catch{return denied();}
  await strictRequestShape(pinned);
  return fields(
    PURPOSE,String(pinned.schema),pinned.projectId,pinned.ownerId,
    pinned.requestId,pinned.nonce,pinned.newDeviceId,
    pinned.kem,pinned.ephemeralPublicKey,pinned.keyId,
    String(pinned.rootGeneration),String(pinned.createdAt),
    String(pinned.expiresAt),
  );
}

/** Public 96-bit truncated SHA-256 transcript comparison, never a recovery PIN. */
export async function deviceRequestFingerprint(
  request:DeviceApprovalRequest,
):Promise<string>{
  const transcript=await verifiedDeviceApprovalTranscript(request);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',transcript));
  const hex=Array.from(digest.subarray(0,12),
    byte=>byte.toString(16).padStart(2,'0')).join('');
  return hex.match(/.{4}/g)!.join('-');
}
/**
 * The new device must already hold a genuine completed-MFA session. The
 * caller's ready-gate is a trusted, independently verified implementation,
 * not a Boolean copied from an untrusted request/relay.
 */
export async function createNewDeviceApprovalRequest(
  owner:Owner,newDeviceId:string,keyId:string,rootGeneration:number,
  now:number,gate:FullyAuthenticatedSessionGate,
):Promise<NewDeviceRequest>{
  validOwner(owner);
  if(typeof newDeviceId!=='string'||!DEVICE.test(newDeviceId)||
     typeof keyId!=='string'||!KID.test(keyId)||
     !Number.isSafeInteger(rootGeneration)||rootGeneration<1||
     rootGeneration>2147483647||!Number.isSafeInteger(now)||now<1||
     now>Number.MAX_SAFE_INTEGER-MAX_AGE_MS)denied();
  const scope:Owner={...owner};
  await gate.assertReady(scope);
  const pair=await crypto.subtle.generateKey(
    {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  const exported=new Uint8Array(await crypto.subtle.exportKey(
    'raw',pair.publicKey));
  const request:DeviceApprovalRequest={
    schema:1,projectId:scope.projectId,ownerId:scope.ownerId,
    requestId:random('q'),nonce:random('n'),newDeviceId,kem:'P-256',
    ephemeralPublicKey:b64(exported),keyId,rootGeneration,
    createdAt:now,expiresAt:now+MAX_AGE_MS,
  };
  await strictRequestShape(request);
  checkTime(request,now);
  return {request,privateKey:pair.privateKey};
}
/**
 * Request parsing and independent human fingerprint comparison only.
 * The trusted approver must also prove a current root/MFA session, and a
 * separately reviewed root-owned single-use journal must prevent replays
 * BEFORE any HPKE root encapsulation. Returning this cannot send a root.
 */
export async function requireMatchedDeviceApprovalRequest(
  request:DeviceApprovalRequest,owner:Owner,trustedDeviceId:string,
  keyId:string,generation:number,now:number,
  manuallyEnteredFingerprint:string,gate:FullyAuthenticatedSessionGate,
):Promise<DeviceApprovalPreflight>{
  const scope:Owner={...owner};
  const copy:DeviceApprovalRequest=structuredClone(request);
  await validate(copy,scope,trustedDeviceId,now,keyId,generation);
  await gate.assertReady(scope);
  const fingerprint=await deviceRequestFingerprint(copy);
  if(typeof manuallyEnteredFingerprint!=='string'||
     manuallyEnteredFingerprint.trim().toLowerCase()!==fingerprint)denied();
  return {status:'fingerprint-matched-not-approved',fingerprint,request:copy};
}
