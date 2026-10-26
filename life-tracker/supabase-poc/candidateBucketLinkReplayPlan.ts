/**
 * #1027 offline-only preparation of complete-owner Bucket/link target rows.
 *
 * Requires an independent age owner-history verifier receipt and external
 * cipher/plain/source hashes before deriving a deterministic candidate replay
 * plan. Never connects to Supabase, imports rows, deletes quarantined records,
 * or grants cutover. Source ciphertext retains ALL original quarantined rows.
 */
import { createHash } from 'node:crypto';
import {
  packOwnerBucketHistory, type LinkHistoryReason,
} from './candidateBucketHistoryAudit';
import {
  toCandidateBucketWrite, toCandidateBucketLinkWrite,
} from './candidateBucketMapping';

const SHA=/^[a-f0-9]{64}$/;
const hash=(value:unknown)=>createHash('sha256')
  .update(JSON.stringify(value),'utf8').digest('hex');
type Source = Parameters<typeof packOwnerBucketHistory>[0];
type Dispositions = { ready:number; tombstone:number; quarantined:number };
export type VerifiedHistoryReceipt = {
  ciphertextSha256:string;
  manifestSha256:string;
  sourceArchiveSha256:string;
  targetIdentitySha256:string;
  counts:{tasks:number;buckets:number;links:number};
  dispositionCounts:Dispositions;
};
type Evidence = {
  /** ALL hashes must come from trusted, out-of-band evidence, not this plan. */
  expectedCipherSha256:string;
  expectedManifestSha256:string;
  expectedSourceArchiveSha256:string;
  /** Metadata returned by the separate offline age verifier. */
  verifiedHistoryReceipt:VerifiedHistoryReceipt;
};

function fail(reason:string):never{
  throw new Error('Owner Bucket link replay plan: '+reason);
}
function sameKeys(value:unknown, names:readonly string[]):boolean{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).sort().join('|')===[...names].sort().join('|');
}
const counts=['tasks','buckets','links'] as const;
const kinds=['ready','tombstone','quarantined'] as const;

/**
 * Fail closed if source links, receipt, or independent pins differ. Build
 * target rows in insertion dependency order: all Buckets first, then only
 * READY and admissible TOMBSTONE links. Long/orphan/deleted-target original
 * links remain exclusively in the previously verified encrypted owner archive.
 */
export function buildCandidateBucketLinkReplayPlan(input:{
  source:Source;
  evidence:Evidence;
}){
  if(!input||!input.source||!input.evidence ||
     ![input.evidence.expectedCipherSha256,
       input.evidence.expectedManifestSha256,
       input.evidence.expectedSourceArchiveSha256].every(x=>
         typeof x==='string'&&SHA.test(x)))
    fail('independently pinned full owner ciphertext and source manifest required');
  // A single immutable-by-caller source copy prevents mixed-generation plans
  // if the caller edits arrays between the manifest and mapped write passes.
  const source:Source=structuredClone(input.source);
  const manifest=packOwnerBucketHistory(source);
  const e=input.evidence,receipt=e.verifiedHistoryReceipt;
  if(!receipt||!sameKeys(receipt,[
    'ciphertextSha256','manifestSha256','sourceArchiveSha256',
    'targetIdentitySha256','counts','dispositionCounts',
  ])||!sameKeys(receipt.counts,counts)||
    !sameKeys(receipt.dispositionCounts,kinds)||
    ![receipt.ciphertextSha256,receipt.manifestSha256,
      receipt.sourceArchiveSha256,receipt.targetIdentitySha256]
      .every(x=>typeof x==='string'&&SHA.test(x)))
    fail('separately verified private owner history receipt missing');
  const manifestSha256=hash(manifest);
  if(source.sourceArchiveSha256!==e.expectedSourceArchiveSha256||
     manifest.sourceArchiveSha256!==receipt.sourceArchiveSha256||
     manifestSha256!==e.expectedManifestSha256||
     manifestSha256!==receipt.manifestSha256||
     e.expectedCipherSha256!==receipt.ciphertextSha256||
     receipt.targetIdentitySha256!==manifest.targetIdentitySha256||
     counts.some(k=>manifest.sourceCounts[k]!==receipt.counts[k])||
     kinds.some(kind=>
       manifest.links.filter(row=>row.disposition===kind).length!==
         receipt.dispositionCounts[kind]))
    fail('encrypted source, target identities, quarantine or receipt diverges from independent pins');
  const byId=(a:{id:string},b:{id:string})=>
    a.id<b.id?-1:a.id>b.id?1:0;
  const bucketWrites=source.buckets.map(row=>
    toCandidateBucketWrite(row,source.identity)).sort(byId);
  const linkWrites=manifest.links.filter(row=>
    row.disposition==='ready'||row.disposition==='tombstone')
    .map(row=>toCandidateBucketLinkWrite(row.source,source.identity))
    .sort(byId);
  const quarantined=manifest.links.filter(row=>
    row.disposition==='quarantined').map(row=>({
      id:row.source.id,
      reasons:[...row.reasons] as LinkHistoryReason[],
      sourceFieldsSha256:hash(row.source),
    }));
  if(bucketWrites.length!==manifest.sourceCounts.buckets||
     linkWrites.length+quarantined.length!==manifest.sourceCounts.links)
    fail('missing original owner rows in replay/quarantine partition');
  const canonical={
    format:'mosaic-candidate-bucket-replay-plan' as const,
    version:1 as const,
    owner:{...manifest.owner},
    sourceArchiveSha256:manifest.sourceArchiveSha256,
    originalHistoryCipherSha256:receipt.ciphertextSha256,
    originalManifestSha256:manifestSha256,
    targetIdentitySha256:manifest.targetIdentitySha256,
    originalCounts:{...manifest.sourceCounts},
    bucketWrites,linkWrites,quarantined,
  };
  return {
    ...canonical,
    planSha256:hash(canonical),
    // Encrypted source history must be separately retained throughout replay.
    encryptedQuarantineArchivePreservationRequired:true as const,
    actualEncryptedArchiveRetentionConfirmed:false as const,
    signedTargetOwnerReadbackConfirmed:false as const,
    onlineMigrationExecuted:false as const,
    providerCutoverEligible:false as const,
  };
}
