/**
 * #1027 offline ONLY: Ed25519 verification of a source authority receipt,
 * bound to all seven personal history domains and the Appwrite installation.
 * A valid signature proves possession of an externally pinned key, NOT that
 * Appwrite ACLs were really revoked or that old installed PWAs stopped.
 *
 * No server key, signer, backend mutator, credential or network call here.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import type { AppwriteHistoryReadOptions } from './appwriteOwnerHistoryRead';
import { readFrozenAppwriteOwnerHistory } from './appwriteOwnerHistoryRead';
import { readFrozenAppwritePersonalSource } from './appwritePersonalSourceRead';
import type { PersonalSourceLease } from './appwritePersonalSourceRead';
import { joinFrozenAppwriteOwnerSources } from './appwriteFrozenPersonalJoin';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID } from '../src/lib/appwriteConfig';

const HEX=/^[a-f0-9]{64}$/;
const NONCE=/^[a-f0-9]{32}$/;
const B64=/^[a-zA-Z0-9_-]{86}$/;
const RFC3339=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX=250000;
const PERSONAL=['tasks','categories','diary','settings'] as const;
const HISTORICAL=['tasks','buckets','links'] as const;
type PersonalDomain=(typeof PERSONAL)[number];
type HistoricalDomain=(typeof HISTORICAL)[number];
type Counts=Record<PersonalDomain | 'buckets' | 'links',number>;
const MESSAGE_KEYS=[
  'format','version','keyId','nonce','ownerId','sourceDeploymentId',
  'leaseId','generation','issuedAt','expiresAt','ownerCounts','personalCounts',
  'aclSnapshotSha256','signedWriteDenialSha256','writeFenceReceiptSha256',
] as const;
const assertRecord=(data: unknown,keys:readonly string[])=>{
  return data!==null && typeof data==='object' && !Array.isArray(data) &&
    Object.keys(data).sort().join('|')===[...keys].sort().join('|');
};
const canonical=(data: unknown):string=>{
  if(Array.isArray(data))return '['+data.map(canonical).join(',')+']';
  if(data!==null && typeof data==='object'){
    const o=data as Record<string,unknown>;
    return '{'+Object.keys(o).sort().map(k=>
      JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
  }
  const value=JSON.stringify(data);
  if(value===undefined)invalid();
  return value;
};
const hash=(input: Buffer)=>
  createHash('sha256').update(input).digest('hex');
function invalid(): never { throw new Error('Untrusted Appwrite signed source authority lease'); }
export type FrozenSignedLeasePayload={
  format:'mosaic-frozen-appwrite-owner';
  version:1;
  keyId:string;
  nonce:string;
  ownerId:string;
  sourceDeploymentId:string;
  leaseId:string;
  generation:string;
  issuedAt:string;
  expiresAt:string;
  ownerCounts:Record<HistoricalDomain,number>;
  personalCounts:Record<PersonalDomain,number>;
  aclSnapshotSha256:string;
  signedWriteDenialSha256:string;
  writeFenceReceiptSha256:string;
};
export type SignedFrozenLease={
  payload:FrozenSignedLeasePayload;
  signature:string;
};
export type AuthorityPins={
  publicKeyPem:string;
  publicKeySha256:string;
  ownerId:string;
  sourceDeploymentId:string;
  nonce:string;
  leaseId:string;
  generation:string;
  aclSnapshotSha256:string;
  signedWriteDenialSha256:string;
  writeFenceReceiptSha256:string;
  counts:Counts;
};

function publicKey(options:AuthorityPins):KeyObject{
  if(typeof options?.publicKeyPem!=='string' || !HEX.test(options.publicKeySha256))
    invalid();
  let key:KeyObject;
  try {
    key=createPublicKey(options.publicKeyPem);
    if(key.asymmetricKeyType!=='ed25519' ||
       hash(key.export({format:'der',type:'spki'}) as Buffer)!==options.publicKeySha256)
      invalid();
  } catch {invalid();}
  return key;
}
function countsMatch(payload:FrozenSignedLeasePayload,pins:AuthorityPins):boolean{
  if(!assertRecord(payload.ownerCounts,HISTORICAL) ||
     !assertRecord(payload.personalCounts,PERSONAL))return false;
  for(const domain of HISTORICAL){
    const n=payload.ownerCounts[domain];
    if(!Number.isSafeInteger(n)||n<0||n>MAX||
       pins.counts[domain]!==n)return false;
  }
  for(const domain of PERSONAL){
    const n=payload.personalCounts[domain];
    if(!Number.isSafeInteger(n)||n<0||n>MAX||
       pins.counts[domain]!==n)return false;
  }
  return payload.ownerCounts.tasks===payload.personalCounts.tasks;
}
/**
 * Verify a detached, canonical JSON Ed25519 signature every time source
 * pages are read. Even this is insufficient for production cutover without
 * independent server enforcement + revocation/old-PWA negative probes.
 */
export function verifyPinnedAppwriteFrozenLease(
  signed:SignedFrozenLease, pins:AuthorityPins,
):PersonalSourceLease{
  if(!signed || !assertRecord(signed,['payload','signature'])||
     !assertRecord(signed.payload,MESSAGE_KEYS)||
     typeof signed.signature!=='string'||!B64.test(signed.signature))
    invalid();
  const p=signed.payload;
  const numbers=Date.parse(p.issuedAt),expires=Date.parse(p.expiresAt),now=Date.now();
  if(p.format!=='mosaic-frozen-appwrite-owner'||p.version!==1||
     typeof p.keyId!=='string'||!p.keyId||p.keyId.length>80||
     typeof p.ownerId!=='string'||p.ownerId!==pins.ownerId||
     typeof p.sourceDeploymentId!=='string'||
     p.sourceDeploymentId!==pins.sourceDeploymentId||
     !p.sourceDeploymentId.startsWith(APPWRITE_ENDPOINT+'|'+APPWRITE_PROJECT_ID+
       '|'+APPWRITE_DATABASE_ID+'|')||
     typeof p.nonce!=='string'||!NONCE.test(p.nonce)||p.nonce!==pins.nonce||
     typeof p.leaseId!=='string'||!p.leaseId||p.leaseId!==pins.leaseId||
     typeof p.generation!=='string'||!p.generation||
     p.generation!==pins.generation||
     !RFC3339.test(p.issuedAt)||!RFC3339.test(p.expiresAt)||
     !Number.isFinite(numbers)||!Number.isFinite(expires)||
     numbers>now+30000||now>=expires||expires<=numbers||
     expires-numbers>3600000||
     ![p.aclSnapshotSha256,p.signedWriteDenialSha256,
       p.writeFenceReceiptSha256].every(x=>typeof x==='string'&&HEX.test(x))||
     p.aclSnapshotSha256!==pins.aclSnapshotSha256||
     p.signedWriteDenialSha256!==pins.signedWriteDenialSha256||
     p.writeFenceReceiptSha256!==pins.writeFenceReceiptSha256||
     !countsMatch(p,pins))
    invalid();
  const sig=Buffer.from(signed.signature,'base64url');
  if(sig.length!==64 || sig.toString('base64url')!==signed.signature ||
     !verify(null,Buffer.from(canonical(p),'utf8'),publicKey(pins),sig))
    invalid();
  return {
    ownerId:p.ownerId,sourceDeploymentId:p.sourceDeploymentId,
    leaseId:p.leaseId,generation:p.generation,expiresAt:p.expiresAt,
    ownerCounts:{...p.ownerCounts},personalCounts:{...p.personalCounts},
    readOnly:true,
  };
}
export interface SignedFrozenSourceOptions extends
  Omit<AppwriteHistoryReadOptions,'getSourceLease'>{
  /** A trusted independently pinned authority public key and exact targets. */
  authorityPins:AuthorityPins;
  /** Must fetch current source lease from the trusted server, not a UI flag. */
  getSignedFrozenLease:()=>Promise<SignedFrozenLease>;
}
/**
 * A source-only read path which feeds only VERIFIED leases into both
 * existing two-pass signed-owner readers. It never returns a cutover permit.
 */
export async function readPinnedAppwriteSevenDomainSource(
  options:SignedFrozenSourceOptions,
){
  const {authorityPins,getSignedFrozenLease,...readOptions}=options;
  if(typeof getSignedFrozenLease!=='function'||!authorityPins||
    authorityPins.ownerId!==options.identity?.legacyUserId||
    authorityPins.sourceDeploymentId!==[
      APPWRITE_ENDPOINT,APPWRITE_PROJECT_ID,APPWRITE_DATABASE_ID,
      options.sourceDeploymentId].join('|'))
    invalid();
  // Validate key pin before fetching even the FIRST user history page.
  publicKey(authorityPins);
  const getSourceLease=async()=>{
    const signed=await getSignedFrozenLease();
    return verifyPinnedAppwriteFrozenLease(signed,authorityPins);
  };
  const historical=await readFrozenAppwriteOwnerHistory({
    ...readOptions,getSourceLease,
  });
  const personal=await readFrozenAppwritePersonalSource({
    ...readOptions,getSourceLease,
  });
  const joined=joinFrozenAppwriteOwnerSources({personal,history:historical});
  return {
    personal,historical,joined,
    detachedSignatureVerified:true as const,
    actualBackendWriterFreezeConfirmed:false as const,
    providerCutoverEligible:false as const,
  };
}
