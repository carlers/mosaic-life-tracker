import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  APPWRITE_DATABASE_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_TABLES,
} from '../../src/lib/appwriteConfig';
import {
  readPinnedAppwriteSevenDomainSource,
  verifyPinnedAppwriteFrozenLease,
  type FrozenSignedLeasePayload, type SignedFrozenLease, type AuthorityPins,
} from '../../supabase-poc/appwriteSignedFrozenAuthority';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const otherKey=generateKeyPairSync('ed25519').privateKey;
const owner='signed_owner';
const deployment=[APPWRITE_ENDPOINT,APPWRITE_PROJECT_ID,APPWRITE_DATABASE_ID,
  'isolated-scratch'].join('|');
const ownerCounts={tasks:1,buckets:1,links:1};
const personalCounts={tasks:1,categories:1,diary:1,settings:1};
const counts={...personalCounts,...ownerCounts};
const hash=(x:Buffer|string)=>
  createHash('sha256').update(x).digest('hex');
const canonical=(value: unknown): string=>{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object'){
    const record=value as Record<string,unknown>;
    return '{'+Object.keys(record).sort()
      .map(k=>JSON.stringify(k)+':'+canonical(record[k])).join(',')+'}';
  }
  const result=JSON.stringify(value);
  if(result===undefined)throw new Error('Unserializable signed fixture');
  return result;
};
const publicPem=publicKey.export({format:'pem',type:'spki'}).toString();
const publicKeySha256=hash(publicKey.export({format:'der',type:'spki'}));
function fixture(){
  const payload:FrozenSignedLeasePayload={
    format:'mosaic-frozen-appwrite-owner',version:1,
    keyId:'scratch-server-lease-v1',nonce:'b'.repeat(32),
    ownerId:owner,sourceDeploymentId:deployment,
    leaseId:'freeze_lease_scratch_15',generation:'generation_15',
    issuedAt:new Date(Date.now()-2000).toISOString(),
    expiresAt:new Date(Date.now()+600000).toISOString(),
    ownerCounts:{...ownerCounts},personalCounts:{...personalCounts},
    aclSnapshotSha256:'a'.repeat(64),
    signedWriteDenialSha256:'c'.repeat(64),
    writeFenceReceiptSha256:'d'.repeat(64),
  };
  const pins:AuthorityPins={
    ownerId:owner,sourceDeploymentId:deployment,publicKeyPem,
    publicKeySha256,nonce:payload.nonce,leaseId:payload.leaseId,
    generation:payload.generation,
    aclSnapshotSha256:payload.aclSnapshotSha256,
    signedWriteDenialSha256:payload.signedWriteDenialSha256,
    writeFenceReceiptSha256:payload.writeFenceReceiptSha256,counts:{...counts},
  };
  const makeSigned=(body:FrozenSignedLeasePayload=payload,
      key=privateKey):SignedFrozenLease=>({
    payload:body,signature:sign(null,Buffer.from(canonical(body),'utf8'),key)
      .toString('base64url'),
  });
  return {payload,pins,makeSigned};
}
const at='2026-10-26T00:00:00Z';
const row=(id:string,fields:Record<string,unknown>)=>({
  $id:id,user_id:owner,deleted:false,
  $createdAt:at,$updatedAt:at,$permissions:['read("user:signed_owner")'],
  ...fields,
});
const originals:Record<string,Record<string,unknown>>={
  [APPWRITE_TABLES.tasks]:row('task_1',{
    title:'Private task',memo:'Keep original',is_completed:false,
    category_id:'cat_1',date:'2026-10-26',image:'file_1',
    created_at:at,updated_at:at,
  }),
  [APPWRITE_TABLES.categories]:row('cat_1',{
    name:'Private category',color:'#ffeeee',updated_at:at,
  }),
  [APPWRITE_TABLES.diary]:row('diary_1',{
    date:'2026-10-26',content:'Private Diary',photos:'["photo_1"]',
    created_at:at,updated_at:at,
  }),
  [APPWRITE_TABLES.settings]:row('setting_1',{
    key:'theme',value:'dark',updated_at:at,
  }),
  [APPWRITE_TABLES.bucketList]:row('goal_1',{
    title:'Personal dream',description:'',achieved:false,
    achieved_at:'',created_at:at,updated_at:at,
  }),
  [APPWRITE_TABLES.bucketTaskLinks]:row('link_1',{
    bucket_list_id:'goal_1',task_id:'task_1',created_at:at,updated_at:at,
  }),
};

describe('Ed25519-pinned Appwrite source writer authority (#1027)',()=>{
  it('accepts only an exact bound, fresh and valid detached Ed25519 signature',()=>{
    const f=fixture();
    const verified=verifyPinnedAppwriteFrozenLease(f.makeSigned(),f.pins);
    expect(verified).toMatchObject({
      ownerId:owner,sourceDeploymentId:deployment,readOnly:true,
      leaseId:f.payload.leaseId,generation:f.payload.generation,
      ownerCounts,personalCounts,
    });
  });
  it('rejects a different private signing key, forged signature, or altered payload',()=>{
    const f=fixture();
    expect(()=>verifyPinnedAppwriteFrozenLease(
      f.makeSigned(f.payload,otherKey),f.pins)).toThrow(/Untrusted/);
    const valid=f.makeSigned();
    expect(()=>verifyPinnedAppwriteFrozenLease({
      ...valid,signature:valid.signature.slice(0,-1)+'A',
    },f.pins)).toThrow(/Untrusted/);
    expect(()=>verifyPinnedAppwriteFrozenLease({
      ...valid,payload:{...f.payload,ownerCounts:{...ownerCounts,links:2}},
    },{...f.pins,counts:{...counts,links:2}})).toThrow(/Untrusted/);
  });
  it('requires independently pinned public key and exact owner/source installation',()=>{
    const f=fixture();
    for(const overrides of [
      {publicKeySha256:'0'.repeat(64)},{ownerId:'another_owner'},
      {sourceDeploymentId:deployment+'-different'},
      {nonce:'f'.repeat(32)},{leaseId:'other_lease'},
      {generation:'other_generation'},
    ])expect(()=>verifyPinnedAppwriteFrozenLease(
      f.makeSigned(),{...f.pins,...overrides})).toThrow(/Untrusted/);
  });
  it('rejects a token whose old-PWA denial, ACL or source-writer fence proof changed',()=>{
    const f=fixture();
    for(const key of ['aclSnapshotSha256','signedWriteDenialSha256',
      'writeFenceReceiptSha256'] as const){
      expect(()=>verifyPinnedAppwriteFrozenLease(
        f.makeSigned(),{...f.pins,[key]:'0'.repeat(64)}))
        .toThrow(/Untrusted/);
    }
  });
  it('rejects stale, future, excessive-duration, missing-count and mismatched-count leases',()=>{
    const f=fixture();
    const past=new Date(Date.now()-120000).toISOString();
    const now=new Date(Date.now()).toISOString();
    const future=new Date(Date.now()+120000).toISOString();
    for(const changed of [
      {issuedAt:past,expiresAt:now},
      {issuedAt:future},
      {expiresAt:new Date(Date.now()+7200000).toISOString()},
      {personalCounts:{...personalCounts,tasks:2}},
      {ownerCounts:{...ownerCounts,links:-1}},
    ]){
      const modified={...f.payload,...changed} as FrozenSignedLeasePayload;
      expect(()=>verifyPinnedAppwriteFrozenLease(
        f.makeSigned(modified),f.pins)).toThrow(/Untrusted/);
    }
  });
  it('rejects unreviewed or malformed payload fields regardless of valid signature',()=>{
    const f=fixture();
    const malformed={...f.payload,unreviewed:true};
    const signed={
      payload:malformed,
      signature:sign(null,Buffer.from(canonical(malformed)),privateKey)
        .toString('base64url'),
    };
    expect(()=>verifyPinnedAppwriteFrozenLease(signed as SignedFrozenLease,
      f.pins)).toThrow(/Untrusted/);
    expect(()=>verifyPinnedAppwriteFrozenLease({
      ...f.makeSigned(),signature:'0'.repeat(86),
    },f.pins)).toThrow(/Untrusted/);
  });
  it('runs both historical and full-content readers under the same VERIFIED lease',async()=>{
    const f=fixture();
    const listRows=vi.fn(async (q:{
      databaseId:string;tableId:string;queries:string[];total:true;
    })=>{
      expect(q.databaseId).toBe(APPWRITE_DATABASE_ID);
      expect(q.total).toBe(true);
      expect(q.queries).toContain(JSON.stringify({
        method:'equal',attribute:'user_id',values:[owner],
      }));
      if(!originals[q.tableId])throw new Error('Unreviewed Appwrite table');
      return {total:1,rows:[structuredClone(originals[q.tableId])]};
    });
    const getSignedFrozenLease=vi.fn(async()=>f.makeSigned());
    const result=await readPinnedAppwriteSevenDomainSource({
      identity:{legacyUserId:owner,
        supabaseUserId:'11111111-1111-4111-8111-111111111111'},
      sourceDeploymentId:'isolated-scratch',
      getAccount:async()=>({$id:owner}),
      getSessionEpoch:async()=>9,
      listRows,pageSize:2,authorityPins:f.pins,getSignedFrozenLease,
    });
    expect(result.joined.counts).toEqual({
      tasks:1,categories:1,diary:1,settings:1,buckets:1,links:1,
    });
    expect(result.personal.rows.tasks[0].columns.memo).toBe('Keep original');
    expect(result.historical.links[0].taskId).toBe('task_1');
    expect(result.detachedSignatureVerified).toBe(true);
    expect(result.actualBackendWriterFreezeConfirmed).toBe(false);
    expect(result.providerCutoverEligible).toBe(false);
    expect(getSignedFrozenLease.mock.calls.length).toBeGreaterThan(25);
    expect(listRows.mock.calls.length).toBeGreaterThan(12);
  });
  it('aborts mid-source-read if the signer changes generation/lease evidence',async()=>{
    const f=fixture();
    let callbacks=0;
    const getSignedFrozenLease=vi.fn(async()=>{
      callbacks++;
      if(callbacks===5){
        const changed={...f.payload,generation:'generation_16'};
        return f.makeSigned(changed);
      }
      return f.makeSigned();
    });
    const listRows=vi.fn(async (q:{tableId:string})=>({
      total:1,rows:[originals[q.tableId]],
    }));
    await expect(readPinnedAppwriteSevenDomainSource({
      identity:{legacyUserId:owner,
        supabaseUserId:'11111111-1111-4111-8111-111111111111'},
      sourceDeploymentId:'isolated-scratch',
      getAccount:async()=>({$id:owner}),getSessionEpoch:async()=>9,
      listRows,authorityPins:f.pins,getSignedFrozenLease,
    })).rejects.toThrow(/Untrusted/);
    expect(listRows.mock.calls.length).toBeLessThan(8);
  });
});
