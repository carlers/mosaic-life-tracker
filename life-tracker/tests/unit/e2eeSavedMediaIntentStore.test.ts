import {describe,expect,it,vi} from 'vitest';
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


describe('encrypted media IndexedDB handle lifecycle',()=>{
  it('closes an already opened database if HKDF key import fails before a transaction',async()=>{
    const db={objectStoreNames:{contains:()=>true},close:vi.fn(),
      onversionchange:null as (()=>void)|null};
    const request={result:db,
      onsuccess:null as (()=>void)|null,
      onerror:null as (()=>void)|null,
      onblocked:null as (()=>void)|null,
      onupgradeneeded:null as (()=>void)|null};
    vi.stubGlobal('indexedDB',{open:vi.fn(()=>{
      queueMicrotask(()=>request.onsuccess?.());
      return request;
    })});
    const keyImport=vi.spyOn(crypto.subtle,'importKey')
      .mockRejectedValueOnce(new Error('synthetic key import unavailable'));
    try{
      await expect(readStagedOwnerEncryptedMedia(root,owner))
        .rejects.toThrow('synthetic key import unavailable');
      expect(db.close).toHaveBeenCalledTimes(1);
    }finally{
      keyImport.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
