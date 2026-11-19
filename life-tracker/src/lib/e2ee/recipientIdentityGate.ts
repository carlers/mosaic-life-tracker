/**
 * M3 recipient identity preflight (#1662/#2085), source-only.
 *
 * This is NOT an E2EE messaging protocol, key directory or ratchet.
 * The server's public-key response is untrusted. User identity binding
 * requires an actual independent contact-channel comparison; the caller must
 * never auto-confirm using the same server response.
 *
 * Signed identity rotation, forward rekey and secure recipient payload
 * transport MUST be separately implemented and reviewed before activation.
 */
import type { Owner } from './coreCrypto';

const enc = new TextEncoder();
const idRe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const devRe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export type RecipientIdentity = Readonly<{
  projectId: string;
  recipientId: string;
  deviceId: string;
  algorithm: 'X25519' | 'P-256';
  publicKey: string; // canonical base64url-encoded public identity-key bytes
  identityEpoch: number;
}>;
export type VerifiedRecipientPin = Readonly<{
  projectId: string;
  localOwnerId: string;
  recipientId: string;
  deviceId: string;
  identityEpoch: number;
  fingerprint: string;
  verification: 'manual-out-of-band';
}>;
export type RecipientKeyDecision = Readonly<{
  status: 'trusted';
  fingerprint: string;
  identityEpoch: number;
}>;
export type ShareAuthorization = Readonly<{
  owner: Owner;
  recipient: RecipientIdentity;
  pin: VerifiedRecipientPin | null;
  visibility: 'private' | 'followers' | 'public';
  relationship: 'accepted' | 'pending' | 'blocked' | 'removed';
  sharingEpoch: number;
  revocationEpoch: number;
}>;

function denied(): never {
  throw new Error('Recipient encryption identity is not independently verified.');
}
function validOwner(owner: Owner): void {
  if (!owner || !idRe.test(owner.projectId) || !idRe.test(owner.ownerId)) denied();
}
function validIdentity(candidate: RecipientIdentity, owner: Owner): void {
  validOwner(owner);
  if (!candidate || !idRe.test(candidate.projectId) ||
      candidate.projectId !== owner.projectId || !idRe.test(candidate.recipientId) ||
      !devRe.test(candidate.deviceId) || candidate.recipientId === owner.ownerId ||
      !['X25519','P-256'].includes(candidate.algorithm) ||
      !Number.isSafeInteger(candidate.identityEpoch) ||
      candidate.identityEpoch < 1 || candidate.identityEpoch > 2**31-1) denied();
}
function canonicalBase64url(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43,180}$/.test(value) ||
      value.length % 4 === 1) denied();
  try {
    const decoded = atob(value.replace(/-/g,'+').replace(/_/g,'/') +
      '='.repeat((4-value.length%4)%4));
    const raw=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)raw[i]=decoded.charCodeAt(i);
    if(raw.length<32 || raw.length>135)denied();
    const canonical=btoa(String.fromCharCode(...raw)).replace(/\+/g,'-')
      .replace(/\//g,'_').replace(/=+$/,'');
    if(canonical!==value)denied();
    return raw;
  }catch{return denied();}
}
function fields(...values: string[]): Uint8Array<ArrayBuffer> {
  const parts=values.map(x=>enc.encode(x));
  const n=parts.reduce((total,p)=>total+p.length+4,0);
  if(n>2048)denied();
  const buffer=new Uint8Array(n),view=new DataView(buffer.buffer);
  let offset=0;
  for(const part of parts){
    view.setUint32(offset,part.length,false);offset+=4;
    buffer.set(part,offset);offset+=part.length;
  }
  return buffer;
}
function bytesToHex(value: Uint8Array): string {
  return [...value].map(x=>x.toString(16).padStart(2,'0')).join('');
}

/** A displayable SHA-256 digest, NOT an authenticated identity on its own. */
export async function candidateIdentityFingerprint(
  owner: Owner, candidate: RecipientIdentity,
): Promise<string> {
  validIdentity(candidate,owner);
  const key=canonicalBase64url(candidate.publicKey);
  if (candidate.algorithm === 'X25519') {
    // Reject obviously invalid 32-byte public keys. Full low-order-key
    // validation belongs to the independently reviewed HPKE/ratchet layer.
    if (key.length !== 32 || key.every(byte => byte === 0)) denied();
  } else {
    // P-256 expects an uncompressed 65-byte point and on-curve validation.
    // Do not trust a server-provided base64 string solely because it hashes.
    if (key.length !== 65 || key[0] !== 4) denied();
    try {
      await crypto.subtle.importKey('raw',key,
        {name:'ECDH',namedCurve:'P-256'},false,[]);
    } catch { return denied(); }
  }
  const digest=await crypto.subtle.digest('SHA-256',fields(
    'mosaic-e2ee/recipient-identity-fingerprint/v1',
    owner.projectId, candidate.recipientId, candidate.deviceId,
    candidate.algorithm,String(candidate.identityEpoch),bytesToHex(key),
  ));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Only after the owner has independently compared the same fingerprint via
 * a trusted out-of-band channel (not a server-offered notification).
 * The UI must request a manually entered confirmation; this function cannot
 * itself prove that comparison was actually independent.
 */
export async function pinManuallyVerifiedRecipient(
  owner: Owner, candidate: RecipientIdentity,
  manuallyEnteredIndependentFingerprint: string,
): Promise<VerifiedRecipientPin> {
  const fingerprint=await candidateIdentityFingerprint(owner,candidate);
  if (typeof manuallyEnteredIndependentFingerprint !== 'string' ||
      manuallyEnteredIndependentFingerprint.trim().toLowerCase() !== fingerprint) denied();
  return {
    projectId:owner.projectId,localOwnerId:owner.ownerId,
    recipientId:candidate.recipientId,deviceId:candidate.deviceId,
    identityEpoch:candidate.identityEpoch,fingerprint,
    verification:'manual-out-of-band',
  };
}

/**
 * Never silently TOFU a server-supplied key or accept an epoch increase.
 * A changed key needs a NEW independent comparison and a reviewed continuity
 * protocol. Persist pins in trusted client state, not an untrusted directory.
 */
export async function requirePinnedRecipientIdentity(
  owner: Owner, candidate: RecipientIdentity,
  pin: VerifiedRecipientPin | null,
): Promise<RecipientKeyDecision> {
  const digest=await candidateIdentityFingerprint(owner,candidate);
  if (!pin || pin.verification !== 'manual-out-of-band' ||
      pin.projectId !== owner.projectId || pin.localOwnerId !== owner.ownerId ||
      pin.recipientId !== candidate.recipientId ||
      pin.deviceId !== candidate.deviceId ||
      pin.identityEpoch !== candidate.identityEpoch ||
      pin.fingerprint !== digest) denied();
  return {status:'trusted',fingerprint:digest,identityEpoch:pin.identityEpoch};
}

/**
 * This is only an authorization preflight; it does not perform encryption.
 * Recipient proof, per-share keys, cipher dispatch and epoch ratcheting are
 * separately required before any shared-content action is permitted.
 */
export async function requirePrivateRecipientShare(
  input: ShareAuthorization,
): Promise<RecipientKeyDecision> {
  if (!input || input.relationship !== 'accepted' ||
      input.visibility !== 'followers' ||
      !Number.isSafeInteger(input.sharingEpoch) ||
      !Number.isSafeInteger(input.revocationEpoch) ||
      input.sharingEpoch < 1 || input.revocationEpoch < 0 ||
      input.sharingEpoch <= input.revocationEpoch) denied();
  return requirePinnedRecipientIdentity(input.owner,input.recipient,input.pin);
}
