import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID,
  APPWRITE_STORAGE_BUCKET_ID, APPWRITE_TABLES,
} from '../../src/lib/appwriteConfig';
import {
  verifyPinnedOldPwaWriteDenials,
  type OldPwaDenialBundle, type OldPwaDenialObservation,
} from '../../supabase-poc/appwriteOldPwaWriteDenialEvidence';
import type {
  AuthorityPins, FrozenSignedLeasePayload, SignedFrozenLease,
} from '../../supabase-poc/appwriteSignedFrozenAuthority';

const leaseKeys=generateKeyPairSync('ed25519');
const witnessKeys=generateKeyPairSync('ed25519');
const extraKeys=generateKeyPairSync('ed25519');
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const canonical=(value:unknown):string=>{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object'){
    const obj=value as Record<string,unknown>;
    return '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+
      ':'+canonical(obj[k])).join(',')+'}';
  }
  const out=JSON.stringify(value);
  if(out===undefined)throw new Error('Invalid test fixture');
  return out;
};
const publicPin=(key:typeof witnessKeys)=>
  sha(key.publicKey.export({type:'spki',format:'der'}));
const signed=(payload:unknown,key:typeof witnessKeys)=>
  sign(null,Buffer.from(canonical(payload)),key.privateKey).toString('base64url');
const deployment=[APPWRITE_ENDPOINT,APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID,'isolated-scratch'].join('|');
const owner='fixture_owner';
const domains=[
  APPWRITE_TABLES.tasks,APPWRITE_TABLES.categories,APPWRITE_TABLES.diary,
  APPWRITE_TABLES.settings,APPWRITE_TABLES.bucketList,
  APPWRITE_TABLES.bucketTaskLinks,APPWRITE_STORAGE_BUCKET_ID,
];
const ops=['create','update','delete'] as const;
const modes=['installed-online','queued-offline-replay'] as const;
const requestNonce=(index:number)=>(index+1).toString(16).padStart(32,'0');
const queuedId=(index:number)=>(index+1001).toString(16).padStart(32,'0');
const counts={tasks:1,categories:1,diary:1,settings:1,buckets:1,links:1};

function fixture(){
  const now=Date.now();
  const timestamp=(offset:number)=>new Date(now+offset).toISOString();
  const issuedAt=timestamp(-5000),expiresAt=timestamp(20*60000),
    observedAt=timestamp(-2000);
  let i=0,qi=0;
  const originalQueuedDraftIds:string[]=[];
  const observations:OldPwaDenialObservation[]=[];
  for(const domain of domains){
    for(const operation of ops){
      for(const mode of modes){
        const q=mode==='queued-offline-replay'?queuedId(qi++):null;
        if(q!==null)originalQueuedDraftIds.push(q);
        observations.push({
          domain,operation,mode,requestNonce:requestNonce(i++),
          queuedDraftId:q,accountAuthenticated:true,
          httpStatus:403,sourceDeploymentId:deployment,
          generation:'gen_15',observedAt,
          requestSha256:sha('fixture original request '+i),
          responseSha256:sha('fixture HTTP 403 response '+i),
        });
      }
    }
  }
  const payload:OldPwaDenialBundle={
    format:'mosaic-appwrite-old-pwa-write-denials',version:1,
    nonce:'b'.repeat(32),ownerId:owner,sourceDeploymentId:deployment,
    leaseId:'freeze_lease_15',generation:'gen_15',
    issuedAt,expiresAt,
    clientBuildSha256:'e'.repeat(64),
    sourceAclSha256:'a'.repeat(64),writeFenceReceiptSha256:'d'.repeat(64),
    observations,
  };
  const leasePayload:FrozenSignedLeasePayload={
    format:'mosaic-frozen-appwrite-owner',version:1,
    keyId:'scratch-authority-v1',nonce:payload.nonce,
    ownerId:owner,sourceDeploymentId:deployment,
    leaseId:payload.leaseId,generation:payload.generation,
    issuedAt:timestamp(-10000),expiresAt:timestamp(30*60000),
    ownerCounts:{tasks:1,buckets:1,links:1},
    personalCounts:{tasks:1,categories:1,diary:1,settings:1},
    aclSnapshotSha256:payload.sourceAclSha256,
    signedWriteDenialSha256:sha(canonical(payload)),
    writeFenceReceiptSha256:payload.writeFenceReceiptSha256,
  };
  const leasePins:AuthorityPins={
    ownerId:owner,sourceDeploymentId:deployment,
    publicKeyPem:leaseKeys.publicKey.export({type:'spki',format:'pem'}).toString(),
    publicKeySha256:publicPin(leaseKeys),
    nonce:payload.nonce,leaseId:payload.leaseId,generation:payload.generation,
    aclSnapshotSha256:payload.sourceAclSha256,
    signedWriteDenialSha256:leasePayload.signedWriteDenialSha256,
    writeFenceReceiptSha256:payload.writeFenceReceiptSha256,counts,
  };
  const signFixture=(body:OldPwaDenialBundle=payload,key=witnessKeys)=>{
    const lease={...leasePayload,
      signedWriteDenialSha256:sha(canonical(body))};
    const pins={...leasePins,
      signedWriteDenialSha256:lease.signedWriteDenialSha256};
    const signedLease:SignedFrozenLease={
      payload:lease,signature:signed(lease,leaseKeys),
    };
    return {
      signed:{payload:body,signature:signed(body,key)},
      pins:{observerPublicKeyPem:witnessKeys.publicKey
        .export({type:'spki',format:'pem'}).toString(),
        observerPublicKeySha256:publicPin(witnessKeys),
        oldPwaClientBuildSha256:body.clientBuildSha256,
        originalQueuedDraftIds,
        signedLease,leasePins:pins,
      },
    };
  };
  return {payload,observations,originalQueuedDraftIds,signFixture};
}

describe('frozen source old PWA online and offline-queue denial witness (#1027)',()=>{
  it('cryptographically binds 21 online plus 21 replayed denials to signed source lease',()=>{
    const x=fixture(), proof=x.signFixture();
    const checked=verifyPinnedOldPwaWriteDenials(proof.signed,proof.pins);
    expect(checked.checkedOnlineDenials).toBe(21);
    expect(checked.checkedQueuedReplayDenials).toBe(21);
    expect(checked.signedDenialPayloadSha256)
      .toBe(proof.pins.leasePins.signedWriteDenialSha256);
    expect(checked.cryptographicDenialWitnessLinked).toBe(true);
    expect(checked.actualBackendWriterFreezeConfirmed).toBe(false);
    expect(checked.actualHttp403IndependentlyAuthenticated).toBe(false);
    expect(checked.originalDraftBytesRecovered).toBe(false);
    expect(checked.providerCutoverEligible).toBe(false);
  });
  it('refuses a missing online or queued operation or duplicated 403 receipt',()=>{
    for(const mutate of [
      (x:OldPwaDenialBundle)=>{x.observations.pop();},
      (x:OldPwaDenialBundle)=>{x.observations[1]={...x.observations[0]};},
      (x:OldPwaDenialBundle)=>{x.observations[3].requestNonce=
        x.observations[2].requestNonce;},
    ]){
      const x=fixture(),body=structuredClone(x.payload);
      mutate(body);
      const proof=x.signFixture(body);
      expect(()=>verifyPinnedOldPwaWriteDenials(proof.signed,proof.pins))
        .toThrow(/Untrusted/);
    }
  });
  it('refuses an auth failure or HTTP 2xx, 401, 404, or a 429 instead of 403',()=>{
    for(const httpStatus of [200,201,401,404,429]){
      const x=fixture(),body=structuredClone(x.payload);
      body.observations[0].httpStatus=httpStatus as 403;
      const p=x.signFixture(body);
      expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,p.pins))
        .toThrow(/Untrusted/);
    }
    const x=fixture(),body=structuredClone(x.payload);
    body.observations[0].accountAuthenticated=false as true;
    const p=x.signFixture(body);
    expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,p.pins))
      .toThrow(/Untrusted/);
  });
  it('refuses replay claims with absent, duplicated, or unpinned outbox records',()=>{
    for(const mutate of [
      (x:OldPwaDenialBundle)=>{x.observations[1].queuedDraftId=null;},
      (x:OldPwaDenialBundle)=>{x.observations[1].queuedDraftId=
        x.observations[3].queuedDraftId;},
      (x:OldPwaDenialBundle)=>{x.observations[1].queuedDraftId='f'.repeat(32);},
      (x:OldPwaDenialBundle)=>{x.observations[0].queuedDraftId='f'.repeat(32);},
    ]){
      const x=fixture(),body=structuredClone(x.payload);
      mutate(body);const p=x.signFixture(body);
      expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,p.pins))
        .toThrow(/Untrusted/);
    }
  });
  it('refuses changed generation/source, client build or actual response digest',()=>{
    const changes=[
      (x:OldPwaDenialBundle)=>{x.observations[4].generation='gen_14';},
      (x:OldPwaDenialBundle)=>{x.observations[5].sourceDeploymentId='other';},
      (x:OldPwaDenialBundle)=>{x.observations[0].responseSha256='not sha';},
      (x:OldPwaDenialBundle)=>{x.observations[0].observedAt=
        new Date(Date.now()+5000000).toISOString();},
    ];
    for(const change of changes){
      const x=fixture(),body=structuredClone(x.payload);
      change(body);const p=x.signFixture(body);
      expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,p.pins))
        .toThrow(/Untrusted/);
    }
  });
  it('rejects tampered witness and source lease even if every claimed HTTP 403 remains',()=>{
    const x=fixture(),proof=x.signFixture();
    const changed=structuredClone(proof.signed);
    changed.payload.observations[0].requestSha256='0'.repeat(64);
    expect(()=>verifyPinnedOldPwaWriteDenials(changed,proof.pins))
      .toThrow(/Untrusted/);
    const wrongLease={...proof.pins,leasePins:{...proof.pins.leasePins,
      signedWriteDenialSha256:'0'.repeat(64)}};
    expect(()=>verifyPinnedOldPwaWriteDenials(proof.signed,wrongLease))
      .toThrow(/Untrusted/);
    expect(()=>verifyPinnedOldPwaWriteDenials(proof.signed,{
      ...proof.pins,oldPwaClientBuildSha256:'0'.repeat(64),
    })).toThrow(/Untrusted/);
    const forged=x.signFixture(x.payload,extraKeys);
    expect(()=>verifyPinnedOldPwaWriteDenials(forged.signed,forged.pins))
      .toThrow(/Untrusted/);
  });
  it('requires an independently pinned separate Ed25519 observation signer',()=>{
    const x=fixture(),p=x.signFixture();
    const sameLeaseKey={...p.pins,
      observerPublicKeyPem:p.pins.leasePins.publicKeyPem,
      observerPublicKeySha256:p.pins.leasePins.publicKeySha256};
    expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,sameLeaseKey))
      .toThrow(/Untrusted/);
    expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,{
      ...p.pins,observerPublicKeySha256:'0'.repeat(64),
    })).toThrow(/Untrusted/);
  });
  it('rejects extra unreviewed fields, future observations, stale bundle and copied owner',()=>{
    const mutations=[
      (x:OldPwaDenialBundle)=>{(x as unknown as Record<string,unknown>).admin=true;},
      (x:OldPwaDenialBundle)=>{x.ownerId='other_owner';},
      (x:OldPwaDenialBundle)=>{x.issuedAt='2020-01-01T00:00:00.000Z';},
      (x:OldPwaDenialBundle)=>{x.expiresAt='2030-01-01T00:00:00.000Z';},
    ];
    for(const mutate of mutations){
      const x=fixture(),body=structuredClone(x.payload);
      mutate(body);
      const p=x.signFixture(body);
      expect(()=>verifyPinnedOldPwaWriteDenials(p.signed,p.pins))
        .toThrow(/Untrusted/);
    }
  });
});
