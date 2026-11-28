import {describe,expect,it,vi} from 'vitest';
import {
  createNewDeviceApprovalRequest,deviceRequestFingerprint,
  requireMatchedDeviceApprovalRequest,
} from '../../src/lib/e2ee/deviceApprovalPreflight';
import {SCRATCH_OWNER_V2_PROJECT} from '../../src/lib/e2ee/ownerPrivateV2Contract';

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_final_mfa_owner'};
const keyId='k_'+'a'.repeat(32);
const at=1795680000000;
const allowed={assertReady:vi.fn(async()=>{})};

describe('dormant device approval requires a final genuine MFA preflight',()=>{
  it('rejects request creation if the session expires during key generation',async()=>{
    const gate={assertReady:vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('MFA expired'))};
    await expect(createNewDeviceApprovalRequest(
      owner,'new_device',keyId,2,at,gate)).rejects.toThrow('MFA expired');
    expect(gate.assertReady).toHaveBeenCalledTimes(2);
    for(const [scope] of gate.assertReady.mock.calls){
      expect(scope).toEqual(owner);
      expect(Object.isFrozen(scope)).toBe(true);
    }
  });
  it('rejects manual fingerprint match if MFA expires during validation',async()=>{
    const created=await createNewDeviceApprovalRequest(
      owner,'new_device',keyId,2,at,allowed);
    const fingerprint=await deviceRequestFingerprint(created.request);
    const gate={assertReady:vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('MFA expired'))};
    await expect(requireMatchedDeviceApprovalRequest(
      created.request,owner,'trusted_device',keyId,2,
      at+1000,fingerprint,gate)).rejects.toThrow('MFA expired');
    expect(gate.assertReady).toHaveBeenCalledTimes(2);
  });
  it('returns immutable public request fields after each success',async()=>{
    const created=await createNewDeviceApprovalRequest(
      owner,'new_device',keyId,2,at,allowed);
    expect(Object.isFrozen(created.request)).toBe(true);
    expect(Reflect.set(created.request,'ownerId','attacker_owner')).toBe(false);
    const fingerprint=await deviceRequestFingerprint(created.request);
    const approvedPreflight=await requireMatchedDeviceApprovalRequest(
      created.request,owner,'trusted_device',keyId,2,
      at+1000,fingerprint,allowed);
    expect(approvedPreflight.status).toBe('fingerprint-matched-not-approved');
    expect(Object.isFrozen(approvedPreflight.request)).toBe(true);
    expect(Reflect.set(approvedPreflight.request,'rootGeneration',999)).toBe(false);
    expect(approvedPreflight.request.ownerId).toBe(owner.ownerId);
    expect(approvedPreflight.request.rootGeneration).toBe(2);
  });
});
