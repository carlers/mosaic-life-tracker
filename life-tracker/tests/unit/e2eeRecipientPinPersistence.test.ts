import {describe,expect,it} from 'vitest';
import {
  readPinnedRecipientIdentity,stageManuallyVerifiedRecipientPin,
} from '../../src/lib/e2ee/recipientPinPersistence';
import {SCRATCH_OWNER_V2_PROJECT} from '../../src/lib/e2ee/ownerPrivateV2Contract';

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_unit_owner'};
const recipient={projectId:owner.projectId,recipientId:'synthetic_friend',
  deviceId:'synthetic_device',algorithm:'X25519' as const,
  publicKey:'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',identityEpoch:1};
const root=new Uint8Array(32).fill(86);
const kid='k_'+'b'.repeat(32);

describe('dormant independent recipient pin persistence guards',()=>{
  it('rejects wrong project and root scope before storage access',async()=>{
    await expect(readPinnedRecipientIdentity(
      root,{...owner,projectId:'unapproved'},recipient,kid)).rejects.toThrow();
    await expect(stageManuallyVerifiedRecipientPin(
      root,{...owner,projectId:'unapproved'},recipient,'x',kid)).rejects.toThrow();
    await expect(stageManuallyVerifiedRecipientPin(
      new Uint8Array(31),owner,recipient,'x',kid)).rejects.toThrow();
  });
  it('never writes a pin based only on a server-provided key',async()=>{
    await expect(stageManuallyVerifiedRecipientPin(
      root,owner,recipient,'not independently verified',kid)).rejects.toThrow();
    await expect(stageManuallyVerifiedRecipientPin(
      root,owner,{...recipient,recipientId:owner.ownerId},
      'not independently verified',kid)).rejects.toThrow();
    await expect(readPinnedRecipientIdentity(
      root,owner,{...recipient,identityEpoch:0},kid)).rejects.toThrow();
  });
});
