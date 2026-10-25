import { describe, expect, it, vi } from 'vitest';
import type { BucketListDocument, BucketTaskLinkDocument } from '../../src/db/schema';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { toCandidateBucketWrite, toCandidateBucketLinkWrite } from '../../supabase-poc/candidateBucketMapping';
import { createCandidateCreateTransport } from '../../supabase-poc/candidateCreateTransport';
import { createCandidateCasTransport } from '../../supabase-poc/candidateCasTransport';
import { CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';

const identity: CandidateIdentity = {
  legacyUserId: 'legacy_alice', supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const other = '22222222-2222-4222-8222-222222222222';
const signed = { userId: identity.supabaseUserId, accessToken: 'signed_owner_token', sessionEpoch: 4 };
const bucket: BucketListDocument = {
  id: 'bucket_123', userId: identity.legacyUserId, title: 'Learn 🌙',
  description: 'Private note', achieved: false, achievedAt: '',
  createdAt: '2026-10-25T10:00:00Z', updatedAt: '2026-10-25T11:00:00Z',
  isDeleted: false,
};
const link: BucketTaskLinkDocument = {
  id: 'link_123', userId: identity.legacyUserId, bucketListId: bucket.id,
  taskId: 'task_123', createdAt: bucket.createdAt, updatedAt: bucket.updatedAt,
  isDeleted: false,
};
const rev='9007199254740993', next='9007199254740994';
const bucketRow = { ...toCandidateBucketWrite(bucket,identity),change_seq:rev,
  server_updated_at:'2026-10-25T11:02:00Z' };
const linkRow = { ...toCandidateBucketLinkWrite(link,identity),change_seq:rev,
  server_updated_at:'2026-10-25T11:03:00Z' };
const references = {
  buckets:new Map([[bucket.id,{userId:identity.legacyUserId,isDeleted:false}]]),
  tasks:new Map([[link.taskId,{userId:identity.legacyUserId,isDeleted:false}]]),
};
const response = (data:unknown,status=200) => new Response(JSON.stringify(data),{status});
function setup(replies:Array<[unknown,number]> = []) {
  const fetcher=vi.fn(async () => {
    const [data,status]=replies.shift() ?? [null,503];
    return response(data,status);
  });
  const getVerifiedSession=vi.fn().mockResolvedValue(signed);
  const options={
    baseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_only_public',
    session:{getVerifiedSession},fetcher:fetcher as unknown as typeof fetch,
  };
  return {
    fetcher,getVerifiedSession,
    create:createCandidateCreateTransport(options),
    cas:createCandidateCasTransport(options),
  };
}
describe('source-only signed Bucket List and task-link owner create/CAS',()=>{
  it('creates exact private Bucket fields with no upsert or client revision',async()=>{
    const h=setup([[[bucketRow],201]]);
    await expect(h.create.createBucket(bucket,identity)).resolves.toEqual({
      state:'created',row:bucketRow,revision:rev,
    });
    const [url,request]=h.fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/mosaic_candidate_buckets');
    expect(request).toMatchObject({method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
      headers:{Authorization:'Bearer signed_owner_token',
        Prefer:'return=representation','Content-Type':'application/json'}});
    const sent=JSON.parse(String(request.body));
    expect(sent).toEqual(toCandidateBucketWrite(bucket,identity));
    expect(sent).not.toHaveProperty('change_seq');
    expect(request.headers).not.toHaveProperty('resolution');
  });

  it('requires owned live target inventory before inserting a ready link',async()=>{
    const h=setup([[[linkRow],201]]);
    await expect(h.create.createBucketLink(link,identity,references)).resolves.toEqual({
      state:'created',row:linkRow,revision:rev,
    });
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    const [url,request]=h.fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toContain('/rest/v1/mosaic_candidate_bucket_task_links');
    expect(JSON.parse(String(request.body))).toEqual(toCandidateBucketLinkWrite(link,identity));
  });

  it('quarantines absent, foreign, deleted and long historical links before network',async()=>{
    const h=setup();
    const absent={...references,tasks:new Map()};
    const foreign={...references,tasks:new Map([[link.taskId,{userId:'legacy_bob',isDeleted:false}]])};
    const deleted={...references,tasks:new Map([[link.taskId,{userId:identity.legacyUserId,isDeleted:true}]])};
    for(const refs of [absent,foreign,deleted]){
      await expect(h.create.createBucketLink(link,identity,refs))
        .rejects.toThrow(/quarantine/);
    }
    await expect(h.create.createBucketLink({...link,taskId:'x'.repeat(70)},identity,{
      ...references,tasks:new Map([['x'.repeat(70),{userId:identity.legacyUserId,isDeleted:false}]]),
    })).rejects.toThrow();
    await expect(h.create.createBucketLink({...link,userId:'legacy_bob'},identity,references))
      .rejects.toThrow(/foreign legacy/);
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it('keeps tombstones referencing known same-owner deleted targets but not missing ones',async()=>{
    const retired={
      buckets:new Map([[bucket.id,{userId:identity.legacyUserId,isDeleted:true}]]),
      tasks:new Map([[link.taskId,{userId:identity.legacyUserId,isDeleted:true}]]),
    };
    const h=setup([[[{...linkRow,is_deleted:true}],201]]);
    await expect(h.create.createBucketLink({...link,isDeleted:true},identity,retired))
      .resolves.toMatchObject({state:'created'});
    await expect(setup().create.createBucketLink({...link,isDeleted:true},identity,{
      ...retired,tasks:new Map(),
    })).rejects.toThrow(/quarantine/);
  });

  it('re-reads a duplicate owner master once and refuses wrong references on conflict',async()=>{
    const valid=setup([[{code:'23505'},409],[[bucketRow],200]]);
    expect(await valid.create.createBucket(bucket,identity)).toEqual({
      state:'conflict',row:bucketRow,revision:rev,
    });
    expect(valid.fetcher).toHaveBeenCalledTimes(2);
    const [url,init]=valid.fetcher.mock.calls[1] as unknown as [string,RequestInit];
    expect(init.method).toBe('GET');
    expect(new URL(url).searchParams.get('owner_id')).toBe('eq.'+identity.supabaseUserId);
    for(const bad of [
      {...bucketRow,owner_id:other},
      {...bucketRow,title:null},
      {...bucketRow,change_seq:0},
    ]){
      await expect(setup([[[bad],201]]).create.createBucket(bucket,identity)).rejects.toThrow();
    }
    await expect(setup([[[{...linkRow,task_id:'t'.repeat(70)}],200]]).create.readBucketLinkMaster(link.id,identity))
      .rejects.toThrow(/Invalid Mosaic candidate document ID/);
    const wrong={...linkRow,task_id:'task_wrong'};
    await expect(setup([[[wrong],201]]).create.createBucketLink(link,identity,references))
      .rejects.toThrow(/changed historical reference/);
  });

  it('applies exact revision-CAS to private Bucket without direct table UPDATE',async()=>{
    const updated={...bucketRow,title:'Finished 🏊',change_seq:next};
    const h=setup([[updated,200]]);
    await expect(h.cas.compareAndSet({
      domain:'buckets',ownerId:identity.supabaseUserId,documentId:bucket.id,
      expectedRevision:rev,patch:{title:'Finished 🏊',updated_at:bucket.updatedAt},
    })).resolves.toEqual({state:'applied',revision:next,row:updated});
    const [url,init]=h.fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/rpc/mosaic_candidate_cas_bucket');
    expect(JSON.parse(String(init.body))).toEqual({
      p_id:bucket.id,p_expected_seq:rev,
      p_patch:{title:'Finished 🏊',updated_at:bucket.updatedAt},
    });
  });

  it('soft-tombstones immutable task links with exact revision and changed owner refusal',async()=>{
    const updated={...linkRow,is_deleted:true,change_seq:next};
    const h=setup([[updated,200]]);
    await expect(h.cas.compareAndSet({
      domain:'bucket_task_links',ownerId:identity.supabaseUserId,documentId:link.id,
      expectedRevision:rev,expectedLinkReferences:{bucketListId:bucket.id,taskId:link.taskId},patch:{is_deleted:true,updated_at:link.updatedAt},
    })).resolves.toEqual({state:'applied',revision:next,row:updated});
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    const [url]=h.fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url.endsWith('mosaic_candidate_cas_bucket_link')).toBe(true);
    await expect(setup([[[{...linkRow,owner_id:other}],201]])
      .create.createBucketLink(link,identity,references)).rejects.toThrow();
  });

  it('rejects immutable refs, oversized content, bad timestamps and unsafe IDs before CAS network',async()=>{
    const h=setup();
    const args={domain:'buckets' as const,ownerId:identity.supabaseUserId,
      documentId:bucket.id,expectedRevision:rev};
    for(const patch of [
      {owner_id:other},{bucket_list_id:bucket.id},{task_id:link.taskId},
      {created_at:bucket.createdAt},{server_updated_at:bucket.updatedAt},
      {change_seq:5},{title:'a'.repeat(256)},{description:'x'.repeat(2001)},
      {achieved:'true'},{achieved_at:'invalid'},{updated_at:'not-a-time'},
      {is_deleted:null},{},
    ]){
      await expect(h.cas.compareAndSet({...args,patch:patch as Record<string,string|boolean|number|null>}))
        .rejects.toThrow();
    }
    for(const patch of [
      {task_id:'hijack'},{bucket_list_id:'hijack'},{id:'hijack'},{owner_id:other},
      {updated_at:'not-a-time'},{is_deleted:'true'},
    ]){
      await expect(h.cas.compareAndSet({
        domain:'bucket_task_links',ownerId:identity.supabaseUserId,documentId:link.id,
        expectedRevision:rev,expectedLinkReferences:{bucketListId:bucket.id,taskId:link.taskId},patch:patch as Record<string,string|boolean|number|null>,
      })).rejects.toThrow();
    }
    await expect(h.cas.compareAndSet({...args,documentId:'bad-id',patch:{title:'safe'}}))
      .rejects.toThrow();
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it('treats null/typed-null and stale CAS as conflicts without retry or success',async()=>{
    const args={domain:'bucket_task_links' as const,ownerId:identity.supabaseUserId,
      documentId:link.id,expectedRevision:rev,expectedLinkReferences:{bucketListId:bucket.id,taskId:link.taskId},patch:{is_deleted:true}};
    expect(await setup([[null,200]]).cas.compareAndSet(args)).toEqual({state:'conflict'});
    const typed={owner_id:null,id:null,is_deleted:null,change_seq:null,
      bucket_list_id:null,task_id:null};
    expect(await setup([[typed,200]]).cas.compareAndSet(args)).toEqual({state:'conflict'});
    await expect(setup([[{...linkRow,change_seq:rev},200]]).cas.compareAndSet(args))
      .rejects.toThrow();
    await expect(setup([[{...linkRow,change_seq:next,task_id:'bad-ref'},200]])
      .cas.compareAndSet(args)).rejects.toThrow(/references/);
    await expect(setup([[{...linkRow,change_seq:next,task_id:'task_456'},200]])
      .cas.compareAndSet(args)).rejects.toThrow(/immutable historical references/);
    await expect(setup().cas.compareAndSet({
      ...args,expectedLinkReferences:undefined,
    })).rejects.toThrow(/requires verified original/);
  });

  it('rejects signed account replacement and never retries a failed write',async()=>{
    const h=setup([[[bucketRow],201]]);
    h.getVerifiedSession.mockResolvedValueOnce(signed)
      .mockResolvedValueOnce({...signed,sessionEpoch:5});
    await expect(h.create.createBucket(bucket,identity)).rejects.toBeInstanceOf(CandidateAuthError);
    const failed=setup([[{message:'unavailable'},503]]);
    await expect(failed.create.createBucket(bucket,identity)).rejects.toThrow(/status 503/);
    expect(failed.fetcher).toHaveBeenCalledTimes(1);
  });
});
