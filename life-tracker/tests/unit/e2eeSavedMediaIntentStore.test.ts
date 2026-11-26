import {describe,expect,it} from 'vitest';
import {
  stageSelectedSavedOwnerEncryptedMedia,readStagedOwnerEncryptedMedia,
} from '../../src/lib/e2ee/ownerSavedMediaIntentStore';
import {
  readVerifiedSealedMediaFromRescueFile,
} from '../../src/lib/e2ee/ownerLocalRescueBundle';
const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_media_unit_owner'};
const root=new Uint8Array(32).fill(61),keyId='k_'+'a'.repeat(32);
const gate={assertReady:async()=>{}};
describe('saved encrypted-media replay is source-only and fail-closed',()=>{
  it('rejects wrong environment, root, missing saved File and MFA gate',async()=>{
    await expect(stageSelectedSavedOwnerEncryptedMedia(
      root,{...owner,projectId:'6ae9599c002ab812f9c3'},
      null as never,keyId,gate)).rejects.toThrow();
    await expect(stageSelectedSavedOwnerEncryptedMedia(
      new Uint8Array(24),owner,null as never,keyId,gate)).rejects.toThrow();
    await expect(stageSelectedSavedOwnerEncryptedMedia(
      root,owner,null as never,keyId,gate)).rejects.toThrow();
    await expect(stageSelectedSavedOwnerEncryptedMedia(
      root,owner,new Blob(['invalid']) as never,keyId,gate)).rejects.toThrow();
    await expect(stageSelectedSavedOwnerEncryptedMedia(
      root,owner,new Blob(['invalid']) as never,
      keyId,null as never)).rejects.toThrow();
  });
  it('never accepts an unsaved or malformed saved-file photo envelope',async()=>{
    await expect(readVerifiedSealedMediaFromRescueFile(
      owner,root,{size:0,text:async()=>''})).rejects.toThrow();
    await expect(readVerifiedSealedMediaFromRescueFile(
      owner,root,{size:2,text:async()=>'{}'})).rejects.toThrow();
    await expect(readVerifiedSealedMediaFromRescueFile(
      {...owner,ownerId:'other'},root,{size:2,text:async()=>'{}'}))
      .rejects.toThrow();
  });
  it('rejects missing browser IndexedDB for read without side effects',async()=>{
    await expect(readStagedOwnerEncryptedMedia(root,owner)).rejects.toThrow();
  });
});
