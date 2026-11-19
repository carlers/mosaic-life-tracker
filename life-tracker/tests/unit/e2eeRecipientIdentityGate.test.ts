import { describe, expect, it } from 'vitest';
import {
  candidateIdentityFingerprint, pinManuallyVerifiedRecipient,
  requirePinnedRecipientIdentity, requirePrivateRecipientShare,
} from '../../src/lib/e2ee/recipientIdentityGate';
const root={projectId:'scratch',ownerId:'synthetic_owner'};
const key='AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
const key2='AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';
const recipient={
  projectId:'scratch',recipientId:'synthetic_friend',
  deviceId:'dev_1',algorithm:'X25519' as const,publicKey:key,identityEpoch:1,
};

describe('M3 independent recipient identity gate (not chat E2EE)',()=>{
  it('rejects default server key and accepts only manually compared independent fingerprint',async()=>{
    const fingerprint=await candidateIdentityFingerprint(root,recipient);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    await expect(requirePinnedRecipientIdentity(root,recipient,null)).rejects.toThrow();
    await expect(pinManuallyVerifiedRecipient(root,recipient,'not verified')).rejects.toThrow();
    const pin=await pinManuallyVerifiedRecipient(root,recipient,fingerprint);
    await expect(requirePinnedRecipientIdentity(root,recipient,pin))
      .resolves.toMatchObject({status:'trusted',fingerprint});
  });
  it('fails on recipient, device, project, key or epoch substitution',async()=>{
    const pin=await pinManuallyVerifiedRecipient(root,recipient,
      await candidateIdentityFingerprint(root,recipient));
    for(const modified of [
      {...recipient,recipientId:'synthetic_other'},
      {...recipient,deviceId:'dev_2'},
      {...recipient,publicKey:key2},
      {...recipient,identityEpoch:2},
      {...recipient,projectId:'production'},
    ]) {
      await expect(requirePinnedRecipientIdentity(root,modified,pin)).rejects.toThrow();
    }
    await expect(requirePinnedRecipientIdentity({...root,ownerId:'another_owner'},
      recipient,pin)).rejects.toThrow();
    await expect(requirePinnedRecipientIdentity(root,recipient,
      {...pin,fingerprint:'0'.repeat(64)})).rejects.toThrow();
  });
  it('blocks private/public visibility, revoked epochs and blocked relationships',async()=>{
    const pin=await pinManuallyVerifiedRecipient(root,recipient,
      await candidateIdentityFingerprint(root,recipient));
    const input={owner:root,recipient,pin,
      visibility:'followers' as const,relationship:'accepted' as const,
      sharingEpoch:3,revocationEpoch:2};
    await expect(requirePrivateRecipientShare(input)).resolves.toHaveProperty('status','trusted');
    for(const variant of [
      {...input,visibility:'private' as const},
      {...input,visibility:'public' as const},
      {...input,relationship:'blocked' as const},
      {...input,relationship:'removed' as const},
      {...input,relationship:'pending' as const},
      {...input,sharingEpoch:2},
      {...input,revocationEpoch:4},
    ]) {
      await expect(requirePrivateRecipientShare(variant)).rejects.toThrow();
    }
  });
  it('disallows self-recipient and noncanonical server key data',async()=>{
    for(const bad of [
      {...recipient,recipientId:root.ownerId},
      {...recipient,publicKey:key+'='},
      {...recipient,publicKey:'short'},
      {...recipient,publicKey:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'},
      {...recipient,identityEpoch:-1},
      {...recipient,deviceId:'wrong/device'},
    ]) {
      await expect(candidateIdentityFingerprint(root,bad)).rejects.toThrow();
    }
  });
});
