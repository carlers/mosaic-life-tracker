import {describe,expect,it,vi} from 'vitest';
import {
  createNewDeviceApprovalRequest,deviceRequestFingerprint,
  requireMatchedDeviceApprovalRequest,
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
