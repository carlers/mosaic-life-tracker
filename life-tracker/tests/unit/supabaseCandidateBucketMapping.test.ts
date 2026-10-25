import { describe, expect, it } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import { fromCandidateBucketRow, fromCandidateBucketLinkRow, toCandidateBucketWrite,
  toCandidateBucketLinkWrite, classifyCandidateLinkReferences,
} from '../../supabase-poc/candidateBucketMapping';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';

const alice: CandidateIdentity={legacyUserId:'legacy_alice',
  supabaseUserId:'11111111-1111-4111-8111-111111111111'};
const bob: CandidateIdentity={legacyUserId:'legacy_bob',
  supabaseUserId:'22222222-2222-4222-8222-222222222222'};
const bucket: BucketListDocument={
  id:'bucket_123',userId:alice.legacyUserId,title:'Learn 🏊',
  description:'Classic wish',achieved:true,achievedAt:'2026-10-25T09:00:00Z',
  createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-10-25T10:00:00Z',isDeleted:false,
};
const taskId='t'.repeat(70); // existing Appwrite Task IDs can be longer than newer candidate IDs
const link: BucketTaskLinkDocument={
  id:'link_123',userId:alice.legacyUserId,bucketListId:bucket.id,taskId,
  createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-10-25T10:00:00Z',isDeleted:false,
};
const bucketRow=(doc=bucket)=>({...toCandidateBucketWrite(doc,alice),
  change_seq:'9007199254740993',server_updated_at:'2026-10-25T10:01:00Z'});
const linkRow=(doc=link)=>({...toCandidateBucketLinkWrite(doc,alice),
  change_seq:'9007199254740994',server_updated_at:'2026-10-25T10:01:00Z'});
const owned={
  buckets:new Map([[bucket.id,{userId:alice.legacyUserId,isDeleted:false}]]),
  tasks:new Map([[taskId,{userId:alice.legacyUserId,isDeleted:false}]]),
};

describe('source-only owner-bound Supabase Bucket List and task-link preservation',()=>{
  it('round-trips private bucket rows without rewriting emoji, achievedAt or server revision',()=>{
    const row=toCandidateBucketWrite(bucket,alice);
    expect(row).toEqual({owner_id:alice.supabaseUserId,id:bucket.id,title:bucket.title,
      description:bucket.description,achieved:true,achieved_at:bucket.achievedAt,
      created_at:bucket.createdAt,updated_at:bucket.updatedAt,is_deleted:false});
    expect(row).not.toHaveProperty('change_seq');
    expect(fromCandidateBucketRow(bucketRow(),alice)).toEqual(bucket);
  });
  it('round-trips exact legacy link and long task reference ID without rekeying',()=>{
    expect(toCandidateBucketLinkWrite(link,alice).task_id).toBe(taskId);
    expect(fromCandidateBucketLinkRow(linkRow(),alice)).toEqual(link);
  });
  it('preserves bucket and link deletion tombstones without hard delete',()=>{
    const deletedBucket={...bucket,isDeleted:true};
    const deletedLink={...link,isDeleted:true};
    expect(fromCandidateBucketRow(bucketRow(deletedBucket),alice)).toEqual(deletedBucket);
    expect(fromCandidateBucketLinkRow(linkRow(deletedLink),alice)).toEqual(deletedLink);
    expect(classifyCandidateLinkReferences(deletedLink,alice,owned)).toBe('tombstone');
  });
  it('refuses foreign owners in either local write or remote read',()=>{
    expect(()=>toCandidateBucketWrite({...bucket,userId:bob.legacyUserId},alice))
      .toThrow(/foreign legacy/);
    expect(()=>toCandidateBucketLinkWrite({...link,userId:bob.legacyUserId},alice))
      .toThrow(/foreign legacy/);
    expect(()=>fromCandidateBucketRow({...bucketRow(),owner_id:bob.supabaseUserId},alice))
      .toThrow(/foreign Supabase/);
    expect(()=>fromCandidateBucketLinkRow({...linkRow(),owner_id:bob.supabaseUserId},alice))
      .toThrow(/foreign Supabase/);
  });
  it('does not lose dangling historical links while task backfill is incomplete',()=>{
    expect(classifyCandidateLinkReferences(link,alice,{
      buckets:owned.buckets,tasks:new Map(),
    })).toBe('quarantined');
    expect(classifyCandidateLinkReferences(link,alice,{
      buckets:new Map(),tasks:owned.tasks,
    })).toBe('quarantined');
  });
  it('refuses to treat foreign-owner targets as owned even when IDs match',()=>{
    const foreign={
      buckets:owned.buckets,
      tasks:new Map([[taskId,{userId:bob.legacyUserId,isDeleted:false}]]),
    };
    expect(classifyCandidateLinkReferences(link,alice,foreign)).toBe('quarantined');
    expect(classifyCandidateLinkReferences(link,alice,{
      buckets:new Map([[bucket.id,{userId:bob.legacyUserId,isDeleted:false}]]),
      tasks:owned.tasks,
    })).toBe('quarantined');
  });
  it('keeps historical soft-deleted targets quarantined until reviewed',()=>{
    expect(classifyCandidateLinkReferences(link,alice,{
      buckets:owned.buckets,
      tasks:new Map([[taskId,{userId:alice.legacyUserId,isDeleted:true}]]),
    })).toBe('quarantined');
    expect(classifyCandidateLinkReferences(link,alice,owned)).toBe('ready');
  });
  it('rejects invalid or oversized historical fields before any cloud mapping',()=>{
    for(const id of ['', '_bad','bad-hyphen','A'.repeat(37)]){
      expect(()=>toCandidateBucketWrite({...bucket,id},alice)).toThrow(/ID/);
      expect(()=>toCandidateBucketLinkWrite({...link,id},alice)).toThrow(/ID/);
    }
    expect(()=>toCandidateBucketLinkWrite({...link,taskId:'x'.repeat(256)},alice))
      .toThrow(/ID/);
    expect(()=>toCandidateBucketWrite({...bucket,title:'x'.repeat(256)},alice))
      .toThrow(/fields/);
    expect(()=>fromCandidateBucketRow({...bucketRow(),achieved:'true' as never},alice))
      .toThrow(/fields/);
    expect(()=>toCandidateBucketLinkWrite({...link,isDeleted:'no' as never},alice))
      .toThrow(/tombstone/);
    expect(()=>toCandidateBucketWrite({...bucket,createdAt:'not-a-date'},alice))
      .toThrow(/timestamp/);
  });
  it('preserves empty achievedAt when unachieved and refuses spoofed owner IDs',()=>{
    const newBucket={...bucket,achieved:false,achievedAt:''};
    expect(fromCandidateBucketRow(bucketRow(newBucket),alice)).toEqual(newBucket);
    expect(()=>toCandidateBucketWrite(bucket,{...alice,supabaseUserId:'bad-uuid'}))
      .toThrow(/Supabase Auth UUID/);
  });
});
