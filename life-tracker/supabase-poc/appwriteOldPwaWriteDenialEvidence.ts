/**
 * #1027 source-only cryptographic binding between one seven-domain frozen
 * Appwrite lease and a complete old-PWA/queued-outbox denial observation set.
 * No HTTP requests, source mutator, server signer, credential or cutover here.
 * A signed assertion is not itself proof the real backend returned HTTP 403.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import {
  APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID,
  APPWRITE_STORAGE_BUCKET_ID, APPWRITE_TABLES,
} from '../src/lib/appwriteConfig';
import {
  verifyPinnedAppwriteFrozenLease,
  type SignedFrozenLease, type AuthorityPins,
} from './appwriteSignedFrozenAuthority';

const SHA=/^[a-f0-9]{64}$/;
const NONCE=/^[a-f0-9]{32}$/;
const SIG=/^[A-Za-z0-9_-]{86}$/;
const RFC3339=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MODES=['installed-online','queued-offline-replay'] as const;
const OPERATIONS=['create','update','delete'] as const;
const TABLES=[
  APPWRITE_TABLES.tasks,APPWRITE_TABLES.categories,
  APPWRITE_TABLES.diary,APPWRITE_TABLES.settings,
  APPWRITE_TABLES.bucketList,APPWRITE_TABLES.bucketTaskLinks,
] as const;
const DOMAINS=[...TABLES,APPWRITE_STORAGE_BUCKET_ID] as const;
type Domain=(typeof DOMAINS)[number];
type Mode=(typeof MODES)[number];
type Mutation=(typeof OPERATIONS)[number];
export type OldPwaDenialObservation={
  domain:Domain;
  operation:Mutation;
  mode:Mode;
  /** Distinct request nonce, never a credential. */
  requestNonce:string;
  /** Only replay probes name a distinct queued draft; contents stay private. */
  queuedDraftId:string|null;
  accountAuthenticated:true;
  httpStatus:403;
  sourceDeploymentId:string;
  generation:string;
  observedAt:string;
  requestSha256:string;
  responseSha256:string;
};
export type OldPwaDenialBundle={
  format:'mosaic-appwrite-old-pwa-write-denials';
  version:1;
  nonce:string;
  ownerId:string;
  sourceDeploymentId:string;
  leaseId:string;
  generation:string;
  issuedAt:string;
  expiresAt:string;
  clientBuildSha256:string;
  sourceAclSha256:string;
  writeFenceReceiptSha256:string;
  observations:OldPwaDenialObservation[];
};
export type SignedOldPwaDenialBundle={
  payload:OldPwaDenialBundle;
  signature:string;
};
export type OldPwaDenialPins={
  /** Separate observer key, independently pinned from the lease signer. */
  observerPublicKeyPem:string;
  observerPublicKeySha256:string;
  oldPwaClientBuildSha256:string;
  /** Must be externally sourced from the real client build, not the bundle. */
  originalQueuedDraftIds:readonly string[];
  /** Independently pinned same-generation frozen source lease. */
  signedLease:SignedFrozenLease;
  leasePins:AuthorityPins;
};
const bundleKeys=['format','version','nonce','ownerId','sourceDeploymentId',
  'leaseId','generation','issuedAt','expiresAt','clientBuildSha256',
  'sourceAclSha256','writeFenceReceiptSha256','observations'];
const observationKeys=['domain','operation','mode','requestNonce','queuedDraftId',
  'accountAuthenticated','httpStatus','sourceDeploymentId','generation',
  'observedAt','requestSha256','responseSha256'];
const identical=(v:unknown,keys:readonly string[]):boolean=>
  v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join('|')===[...keys].sort().join('|');
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object'){
    const r=value as Record<string,unknown>;
    return '{'+Object.keys(r).sort().map(k=>
      JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
  }
  const text=JSON.stringify(value);
  if(text===undefined)invalid();
  return text;
}
const digest=(bytes:Buffer)=>
  createHash('sha256').update(bytes).digest('hex');
function invalid():never {
  throw new Error('Untrusted Appwrite old-PWA and queued-write denial evidence');
}
const expectedCount=DOMAINS.length*OPERATIONS.length*MODES.length;

/**
 * Require 42 complete, non-duplicated request observations: online installed
 * PWA AND replayed offline queue for each of 21 mutation surfaces.
 * In addition to the detached observer signature, require the bundle digest
 * to match the independently signed exact-generation frozen source lease.
 * Still not a server-enforced freeze or cutover authorization.
 */
export function verifyPinnedOldPwaWriteDenials(
  signed:SignedOldPwaDenialBundle,pins:OldPwaDenialPins,
){
  if(!signed||!identical(signed,['payload','signature'])||
     !identical(signed.payload,bundleKeys)||
     typeof signed.signature!=='string'||!SIG.test(signed.signature)||
     !pins||typeof pins.observerPublicKeyPem!=='string'||
     !SHA.test(pins.observerPublicKeySha256)||
     !SHA.test(pins.oldPwaClientBuildSha256)||
     !Array.isArray(pins.originalQueuedDraftIds))
    invalid();
  const payload=signed.payload;
  const now=Date.now(),issued=Date.parse(payload.issuedAt),
    expires=Date.parse(payload.expiresAt);
  const lease=verifyPinnedAppwriteFrozenLease(pins.signedLease,pins.leasePins);
  if(payload.format!=='mosaic-appwrite-old-pwa-write-denials'||
     payload.version!==1||typeof payload.nonce!=='string'||
     !NONCE.test(payload.nonce)||payload.nonce!==pins.leasePins.nonce||
     payload.ownerId!==lease.ownerId||
     payload.sourceDeploymentId!==lease.sourceDeploymentId||
     payload.sourceDeploymentId!==[
       APPWRITE_ENDPOINT,APPWRITE_PROJECT_ID,APPWRITE_DATABASE_ID,
       payload.sourceDeploymentId.split('|').at(-1),
     ].join('|')||
     payload.leaseId!==lease.leaseId||payload.generation!==lease.generation||
     !RFC3339.test(payload.issuedAt)||!RFC3339.test(payload.expiresAt)||
     !Number.isFinite(issued)||!Number.isFinite(expires)||
     issued>now+30000||issued<now-3600000||now>=expires||
     expires<=issued||expires-issued>3600000||
     expires>Date.parse(lease.expiresAt)||
     payload.clientBuildSha256!==pins.oldPwaClientBuildSha256||
     payload.sourceAclSha256!==pins.leasePins.aclSnapshotSha256||
     payload.writeFenceReceiptSha256!==pins.leasePins.writeFenceReceiptSha256||
     !Array.isArray(payload.observations)||
     payload.observations.length!==expectedCount||
     !Array.isArray(pins.originalQueuedDraftIds)||
     pins.originalQueuedDraftIds.length!==DOMAINS.length*OPERATIONS.length)
    invalid();
  const queued=new Set(pins.originalQueuedDraftIds);
  if(queued.size!==pins.originalQueuedDraftIds.length||
     [...queued].some(x=>typeof x!=='string'||!NONCE.test(x)))
    invalid();
  const expected=new Set<string>();
  for(const domain of DOMAINS)
    for(const operation of OPERATIONS)
      for(const mode of MODES)expected.add([domain,operation,mode].join('|'));
  const seen=new Set<string>(),requests=new Set<string>(),usedQueued=new Set<string>();
  for(const item of payload.observations){
    if(!identical(item,observationKeys))invalid();
    const name=[item.domain,item.operation,item.mode].join('|');
    const observed=Date.parse(item.observedAt);
    if(!expected.has(name)||seen.has(name)||
       item.accountAuthenticated!==true||item.httpStatus!==403||
       item.sourceDeploymentId!==payload.sourceDeploymentId||
       item.generation!==payload.generation||
       typeof item.requestNonce!=='string'||!NONCE.test(item.requestNonce)||
       requests.has(item.requestNonce)||
       !SHA.test(item.requestSha256)||!SHA.test(item.responseSha256)||
       !RFC3339.test(item.observedAt)||!Number.isFinite(observed)||
       observed<issued||observed>expires)
      invalid();
    seen.add(name);requests.add(item.requestNonce);
    if(item.mode==='queued-offline-replay'){
      if(typeof item.queuedDraftId!=='string'||
         !queued.has(item.queuedDraftId)||usedQueued.has(item.queuedDraftId))
        invalid();
      usedQueued.add(item.queuedDraftId);
    }else if(item.queuedDraftId!==null)invalid();
  }
  if(seen.size!==expected.size||usedQueued.size!==queued.size)invalid();
  const clear=Buffer.from(canonical(payload),'utf8');
  const payloadSha256=digest(clear);
  if(payloadSha256!==pins.leasePins.signedWriteDenialSha256)invalid();
  let key;
  try{
    key=createPublicKey(pins.observerPublicKeyPem);
    if(key.asymmetricKeyType!=='ed25519'||
       digest(key.export({type:'spki',format:'der'}) as Buffer)!==
         pins.observerPublicKeySha256||
       pins.observerPublicKeySha256===pins.leasePins.publicKeySha256)
      invalid();
  }catch{invalid();}
  const sig=Buffer.from(signed.signature,'base64url');
  if(sig.length!==64||sig.toString('base64url')!==signed.signature||
     !verify(null,clear,key,sig))
    invalid();
  return {
    ownerId:lease.ownerId,sourceDeploymentId:lease.sourceDeploymentId,
    leaseId:lease.leaseId,generation:lease.generation,
    cryptographicDenialWitnessLinked:true as const,
    checkedOnlineDenials:DOMAINS.length*OPERATIONS.length,
    checkedQueuedReplayDenials:usedQueued.size,
    signedDenialPayloadSha256:payloadSha256,
    // Signed operator statements and user-supplied pins are not evidence
    // that an actual privileged Appwrite backend performed the denials.
    actualBackendWriterFreezeConfirmed:false as const,
    originalDraftBytesRecovered:false as const,
    actualHttp403IndependentlyAuthenticated:false as const,
    providerCutoverEligible:false as const,
  };
}
