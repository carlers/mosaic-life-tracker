import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { packOwnerBucketHistory } from '../../supabase-poc/candidateBucketHistoryAudit';
import {
  buildCandidateBucketLinkReplayPlan,
  type VerifiedHistoryReceipt,
} from '../../supabase-poc/candidateBucketLinkReplayPlan';

const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
const owner:CandidateIdentity={
  legacyUserId:'original_owner',
  supabaseUserId:'11111111-1111-4111-8111-111111111111',
};
const at='2026-10-26T00:00:00Z';
const bucket:BucketListDocument={
  id:'bucket_1',userId:owner.legacyUserId,
  title:'Private Bucket',description:'Original description',achieved:false,
  achievedAt:'',createdAt:at,updatedAt:at,isDeleted:false,
};
const task=(id:string,deleted=false)=>({
  id,userId:owner.legacyUserId,isDeleted:deleted,
});
const link=(id:string,taskId:string,deleted=false):BucketTaskLinkDocument=>({
  id,userId:owner.legacyUserId,bucketListId:bucket.id,taskId,
  createdAt:at,updatedAt:at,isDeleted:deleted,
});
const source=()=>({
  identity:{...owner},
  tasks:[task('task_1'),task('task_2',true),task('long'.repeat(50))],
  buckets:[{...bucket}],
  links:[
    link('link_1','task_1'),
    link('link_2','task_2',true),
    link('link_3','long'.repeat(50),true),
    link('link_4','missing'),
  ],
  expectedCounts:{tasks:3,buckets:1,links:4},
  sourceArchiveSha256:'a'.repeat(64),
});
function fixture(){
  const original=source(),manifest=packOwnerBucketHistory(original);
  const dispositionCounts={ready:0,tombstone:0,quarantined:0};
  for(const l of manifest.links)dispositionCounts[l.disposition]++;
  const receipt:VerifiedHistoryReceipt={
    ciphertextSha256:'b'.repeat(64),manifestSha256:sha(manifest),
    sourceArchiveSha256:original.sourceArchiveSha256,
    targetIdentitySha256:manifest.targetIdentitySha256,
    counts:{...original.expectedCounts},dispositionCounts,
  };
  return {source:original,evidence:{
    expectedCipherSha256:receipt.ciphertextSha256,
    expectedManifestSha256:receipt.manifestSha256,
    expectedSourceArchiveSha256:receipt.sourceArchiveSha256,
    verifiedHistoryReceipt:receipt,
  }};
}

describe('complete-owner Bucket replay/quarantine partition (#1027)',()=>{
  it('prepares target Bucket then only safe link/tombstone writes and retains unsafe source hashes',()=>{
    const x=fixture();
    const plan=buildCandidateBucketLinkReplayPlan(x);
    expect(plan.bucketWrites).toHaveLength(1);
    expect(plan.bucketWrites[0]).toMatchObject({
      owner_id:owner.supabaseUserId,id:bucket.id,title:bucket.title,
    });
    expect(plan.linkWrites.map(l=>l.id)).toEqual(['link_1','link_2']);
    expect(plan.linkWrites.map(l=>l.is_deleted)).toEqual([false,true]);
    expect(plan.quarantined.map(l=>l.id)).toEqual(['link_3','link_4']);
    expect(plan.quarantined[0].reasons).toContain('long-task-reference');
    expect(plan.quarantined[1].reasons).toEqual(['missing-task']);
    expect(plan.quarantined.every(l=>/^[a-f0-9]{64}$/.test(l.sourceFieldsSha256)))
      .toBe(true);
    expect(plan.originalCounts).toEqual({tasks:3,buckets:1,links:4});
    expect(plan.planSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.encryptedQuarantineArchivePreservationRequired).toBe(true);
    expect(plan.actualEncryptedArchiveRetentionConfirmed).toBe(false);
    expect(plan.signedTargetOwnerReadbackConfirmed).toBe(false);
    expect(plan.onlineMigrationExecuted).toBe(false);
    expect(plan.providerCutoverEligible).toBe(false);
  });
  it('seals source identity and byte-hash-linked plan independent of array iteration order',()=>{
    const x=fixture(),y=fixture();
    y.source.tasks.reverse();
    y.source.links.reverse();
    y.source.buckets.reverse();
    expect(buildCandidateBucketLinkReplayPlan(y)).toEqual(
      buildCandidateBucketLinkReplayPlan(x));
    const plan=buildCandidateBucketLinkReplayPlan(x);
    x.source.links[0].taskId='changed_after_seal';
    x.source.buckets[0].title='changed_after_seal';
    expect(plan.linkWrites[0].task_id).toBe('task_1');
    expect(plan.bucketWrites[0].title).toBe(bucket.title);
  });
  it('refuses source, full manifest, ciphertext and target identity pin divergences',()=>{
    const cases=[
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.expectedCipherSha256='0'.repeat(64);
      },
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.expectedManifestSha256='0'.repeat(64);
      },
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.expectedSourceArchiveSha256='0'.repeat(64);
      },
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.verifiedHistoryReceipt.targetIdentitySha256='0'.repeat(64);
      },
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.verifiedHistoryReceipt.ciphertextSha256='0'.repeat(64);
      },
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.verifiedHistoryReceipt.dispositionCounts.quarantined=1;
      },
      (x:ReturnType<typeof fixture>)=>{
        x.evidence.verifiedHistoryReceipt.counts.links=3;
      },
    ];
    for(const mutate of cases){
      const f=fixture();mutate(f);
      expect(()=>buildCandidateBucketLinkReplayPlan(f)).toThrow(/diverges/);
    }
  });
  it('refuses changed source original references, counts or foreign owner',()=>{
    const changed=fixture();
    changed.source.links[0].taskId='another';
    expect(()=>buildCandidateBucketLinkReplayPlan(changed)).toThrow(/diverges/);
    const short=fixture();
    short.source.links.pop();
    expect(()=>buildCandidateBucketLinkReplayPlan(short)).toThrow(/Incomplete/);
    const foreign=fixture();
    foreign.source.links[0].userId='foreign';
    expect(()=>buildCandidateBucketLinkReplayPlan(foreign)).toThrow(/foreign/);
    const changedOwner=fixture();
    changedOwner.source.identity.supabaseUserId=
      '22222222-2222-4222-8222-222222222222';
    expect(()=>buildCandidateBucketLinkReplayPlan(changedOwner)).toThrow(/diverges/);
  });
  it('rejects missing archive receipt, malformed hashes, missing owner and fabricated counts',()=>{
    const missing=fixture();
    expect(()=>buildCandidateBucketLinkReplayPlan({
      ...missing,evidence:{...missing.evidence,
        verifiedHistoryReceipt:null as unknown as VerifiedHistoryReceipt},
    })).toThrow(/receipt missing/);
    const bad=fixture();
    bad.evidence.expectedCipherSha256='insecure';
    expect(()=>buildCandidateBucketLinkReplayPlan(bad)).toThrow(/independently pinned/);
    const unread=fixture();
    unread.evidence.verifiedHistoryReceipt={
      ...unread.evidence.verifiedHistoryReceipt,
      counts:{...unread.evidence.verifiedHistoryReceipt.counts,links:0},
    };
    expect(()=>buildCandidateBucketLinkReplayPlan(unread)).toThrow(/diverges/);
  });
  it('does not silently drop tombstones with long or missing original references',()=>{
    const f=fixture();
    f.source.links[3].isDeleted=true;
    const m=packOwnerBucketHistory(f.source);
    f.evidence.expectedManifestSha256=sha(m);
    f.evidence.verifiedHistoryReceipt.manifestSha256=sha(m);
    f.evidence.verifiedHistoryReceipt.dispositionCounts={
      ready:1,tombstone:1,quarantined:2,
    };
    const result=buildCandidateBucketLinkReplayPlan(f);
    expect(result.quarantined.map(r=>r.id)).toEqual(['link_3','link_4']);
    expect(result.linkWrites.map(r=>r.id)).toEqual(['link_1','link_2']);
    expect(result.providerCutoverEligible).toBe(false);
  });
});
