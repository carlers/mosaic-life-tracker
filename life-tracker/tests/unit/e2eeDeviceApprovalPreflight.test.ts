import {describe,expect,it,vi} from 'vitest';
import {
  createNewDeviceApprovalRequest,deviceRequestFingerprint,
  requireMatchedDeviceApprovalRequest,verifiedDeviceApprovalTranscript,
} from '../../src/lib/e2ee/deviceApprovalPreflight';
import {SCRATCH_OWNER_V2_PROJECT} from '../../src/lib/e2ee/ownerPrivateV2Contract';

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_new_device_owner'};
const keyId='k_'+'a'.repeat(32);
const now=1795680000000;
const ready={assertReady:vi.fn(async()=>{})};

describe('dormant Phase D device enrollment request preflight only',()=>{
  it('requires full MFA gate, nonextractable P-256 private key, matching root epoch',async()=>{
    const prepared=await createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,7,now,ready);
    expect(prepared.privateKey.extractable).toBe(false);
    expect(prepared.privateKey.algorithm).toMatchObject({
      name:'ECDH',namedCurve:'P-256',
    });
    expect(prepared.request.ephemeralPublicKey).toHaveLength(87);
    const text=JSON.stringify(prepared.request);
    expect(text).not.toContain('privateKey');
    expect(text).not.toContain('recovery');
    const fingerprint=await deviceRequestFingerprint(prepared.request);
    expect(fingerprint).toMatch(/^(?:[a-f0-9]{4}-){5}[a-f0-9]{4}$/);
    await expect(requireMatchedDeviceApprovalRequest(
      prepared.request,owner,'synthetic_trusted_device',
      keyId,7,now+1000,fingerprint,ready,
    )).resolves.toMatchObject({
      status:'fingerprint-matched-not-approved',fingerprint,
    });
    await expect(requireMatchedDeviceApprovalRequest(
      prepared.request,owner,'synthetic_new_device',
      keyId,7,now,fingerprint,ready)).rejects.toThrow();
  });
  it('fails closed for missing MFA and wrong owner before generating a key',async()=>{
    const denied={assertReady:vi.fn(async()=>{throw new Error('MFA pending')})};
    await expect(createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,7,now,denied))
      .rejects.toThrow('MFA pending');
    expect(denied.assertReady).toHaveBeenCalledOnce();
    await expect(createNewDeviceApprovalRequest(
      {...owner,projectId:'not-scratch'},'synthetic_new_device',
      keyId,7,now,ready)).rejects.toThrow();
  });
  it('does not treat transcript fingerprint as server permission or replay proof',async()=>{
    const prepared=await createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,7,now,ready);
    const fingerprint=await deviceRequestFingerprint(prepared.request);
    const revoked={...prepared.request,rootGeneration:8};
    await expect(requireMatchedDeviceApprovalRequest(
      revoked,owner,'synthetic_trusted_device',
      keyId,7,now,fingerprint,ready)).rejects.toThrow();
    await expect(requireMatchedDeviceApprovalRequest(
      prepared.request,owner,'synthetic_trusted_device',
      keyId,7,now+300000,fingerprint,ready)).rejects.toThrow();
    await expect(requireMatchedDeviceApprovalRequest(
      {...prepared.request,extraRootPlaintext:'secret'} as never,
      owner,'synthetic_trusted_device',keyId,7,now,fingerprint,ready))
      .rejects.toThrow();
    await expect(deviceRequestFingerprint(
      {...prepared.request,extraRootPlaintext:'secret'} as never))
      .rejects.toThrow();
    await expect(deviceRequestFingerprint(
      {...prepared.request,newDeviceId:123} as never)).rejects.toThrow();
    await expect(deviceRequestFingerprint(
      {...prepared.request,ownerId:456} as never)).rejects.toThrow();
    await expect(createNewDeviceApprovalRequest(
      owner,123 as never,keyId,7,now,ready)).rejects.toThrow();
  });
});

describe('canonical public device-approval transcript for future reviewed HPKE binding',()=>{
  it('matches the fingerprint hash and is invariant to property ordering',async()=>{
    const requested=await createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,7,now,ready);
    const first=await verifiedDeviceApprovalTranscript(requested.request);
    const reversed=Object.fromEntries(
      Object.entries(requested.request).reverse()) as typeof requested.request;
    const again=await verifiedDeviceApprovalTranscript(reversed);
    expect(again).toEqual(first);
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',first));
    const fromBytes=Array.from(digest.subarray(0,12),
      b=>b.toString(16).padStart(2,'0')).join('').match(/.{4}/g)!.join('-');
    expect(await deviceRequestFingerprint(requested.request)).toBe(fromBytes);
    expect(JSON.stringify(first)).not.toContain('privateKey');
  });

  it('binds every request field and denies unknown fields or untrusted P-256 points',async()=>{
    const {request}=await createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,7,now,ready);
    const first=await verifiedDeviceApprovalTranscript(request);
    const edits={
      ownerId:'synthetic_other_owner',
      newDeviceId:'synthetic_other_device',
      requestId:'q_'+'f'.repeat(32),nonce:'n_'+'f'.repeat(32),
      keyId:'k_'+'f'.repeat(32),rootGeneration:8,
      createdAt:now+1,expiresAt:now+60000,
    };
    for(const [field,value] of Object.entries(edits)){
      const changed={...request,[field]:value};
      expect(await verifiedDeviceApprovalTranscript(changed))
        .not.toEqual(first);
      expect(await deviceRequestFingerprint(changed))
        .not.toEqual(await deviceRequestFingerprint(request));
    }
    await expect(verifiedDeviceApprovalTranscript(
      {...request,rootPlaintext:'must never appear'} as never))
      .rejects.toThrow();
    await expect(verifiedDeviceApprovalTranscript(
      {...request,ephemeralPublicKey:'A'.repeat(87)}))
      .rejects.toThrow();
  });

  it('cannot change transcript midflight when caller changes account and key',async()=>{
    const {request}=await createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,7,now,ready);
    const expected=await verifiedDeviceApprovalTranscript(request);
    const callerOwned={...request};
    const pending=verifiedDeviceApprovalTranscript(callerOwned);
    callerOwned.ownerId='synthetic_switched_owner';
    callerOwned.newDeviceId='synthetic_switched_device';
    callerOwned.rootGeneration=10;
    expect(await pending).toEqual(expected);
  });
});


describe('device request authenticated owner scope is callback immutable',()=>{
  it('cannot switch account in the injected MFA gate during request and manual match',async()=>{
    const gate={assertReady:vi.fn(async (scope:{ownerId:string})=>{
      expect(Object.isFrozen(scope)).toBe(true);
      expect(scope.ownerId).toBe(owner.ownerId);
      expect(Reflect.set(scope,'ownerId','synthetic_foreign_owner')).toBe(false);
    })};
    const mutableOwner={...owner};
    const pending=createNewDeviceApprovalRequest(
      mutableOwner,'synthetic_new_device',keyId,7,now,gate);
    mutableOwner.ownerId='synthetic_foreign_owner';
    const created=await pending;
    expect(created.request.ownerId).toBe(owner.ownerId);
    const fingerprint=await deviceRequestFingerprint(created.request);
    const matched=await requireMatchedDeviceApprovalRequest(
      created.request,{...owner},'synthetic_trusted_device',keyId,7,
      now+1000,fingerprint,gate);
    expect(matched.request.ownerId).toBe(owner.ownerId);
    expect(matched.status).toBe('fingerprint-matched-not-approved');
    expect(gate.assertReady).toHaveBeenCalledTimes(4);
  });
});
