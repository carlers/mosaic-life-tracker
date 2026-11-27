import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import {
  sealOwnerPendingImages, decryptOwnerPendingImage,
  type PendingImageSource,
} from '../../src/lib/e2ee/ownerPendingImageRescue';

const owner = {projectId:'isolated_synthetic_project',ownerId:'synthetic_owner'};
const id = 'localimg_'+'a'.repeat(26);
const id2 = 'localimg_'+'b'.repeat(26);
const jpg = (content:string) => new Blob([content],{type:'image/jpeg'});
const row = (id:string,content:string,ownerUserId=owner.ownerId) => ({
  id, ownerUserId, blob:jpg(content), createdAt:'2026-11-26T01:23:45.000Z',
});
function source(rows: unknown[]): PendingImageSource {
  return {readAll: vi.fn(async () => rows)};
}
const gate = {assertReady:vi.fn(async (_owner:typeof owner)=>{})};

describe('E2EE owner pending-image rescue (source-only, offline, no cloud)',()=>{
  it('covers referenced and orphaned images while hiding original owner IDs and MIME',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    const store=source([row(id,'private orphan'),row(id2,'private attached'),
      row('localimg_'+'c'.repeat(26),'other account image','other_user')]);
    gate.assertReady.mockClear();
    const result=await sealOwnerPendingImages(owner,root,keyId,gate,store);
    expect(result).toHaveLength(2);
    expect(store.readAll).toHaveBeenCalledTimes(2);
    expect(gate.assertReady).toHaveBeenCalled();
    const serialized=JSON.stringify(result);
    for(const secret of [id,id2,'private orphan','private attached',owner.ownerId,'image/jpeg']){
      expect(serialized).not.toContain(secret);
    }
    expect((await decryptOwnerPendingImage(owner,root,result[0])).blob.type).toBe('image/jpeg');
    expect(await (await decryptOwnerPendingImage(owner,root,result[0])).blob.text()).toBe('private orphan');
    expect((await decryptOwnerPendingImage(owner,root,result[1])).localId).toBe(id2);
  });
  it('rejects changed staged media, missing data and duplicate local IDs before reporting success',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    let n=0;
    const changed={readAll:async()=>++n===1?[row(id,'old media')]:[row(id,'new media')]};
    await expect(sealOwnerPendingImages(owner,root,keyId,gate,changed)).rejects.toThrow('incomplete');
    await expect(sealOwnerPendingImages(owner,root,keyId,gate,source([
      row(id,'same'),row(id,'duplicate'),
    ]))).rejects.toThrow('incomplete');
    await expect(sealOwnerPendingImages(owner,root,keyId,gate,source([
      {id,ownerUserId:owner.ownerId,blob:null,createdAt:'2026-11-26'},
    ]))).rejects.toThrow('incomplete');
    await expect(sealOwnerPendingImages(owner,root,keyId,gate,source([
      {id,blob:jpg('ambiguous'),createdAt:'2026-11-26'},
    ]))).rejects.toThrow('incomplete');
  });
  it('wrong owner, root, ciphertext/metadata tamper cannot open a saved photo',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    const [item]=await sealOwnerPendingImages(owner,root,keyId,gate,source([row(id,'private')]));
    await expect(decryptOwnerPendingImage({...owner,ownerId:'other'},root,item)).rejects.toThrow();
    await expect(decryptOwnerPendingImage({...owner,projectId:'different'},root,item)).rejects.toThrow();
    await expect(decryptOwnerPendingImage(owner,generateAccountRoot(),item)).rejects.toThrow();
    await expect(decryptOwnerPendingImage(owner,root,{...item,rowId:'p_'+'1'.repeat(32)})).rejects.toThrow();
    await expect(decryptOwnerPendingImage(owner,root,{
      ...item,sealedMedia:{
        ...item.sealedMedia,
        ciphertext: new Blob(['garbage'],{type:'application/octet-stream'}),
      },
    })).rejects.toThrow();
  });
  it('rejects unsupported media MIME/size and unavailable authenticated owner gate',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    await expect(sealOwnerPendingImages(owner,root,keyId,gate,source([{
      ...row(id,'x'),blob:new Blob(['not an image'],{type:'text/plain'}),
    }]))).rejects.toThrow();
    const denied={assertReady:vi.fn(async()=>{throw new Error('MFA pending')})};
    const store=source([row(id,'private')]);
    await expect(sealOwnerPendingImages(owner,root,keyId,denied,store)).rejects.toThrow('MFA pending');
    expect(store.readAll).not.toHaveBeenCalled();
  });
});


describe('offline photo capture direct callback account binding',()=>{
  it('keeps original owner and key across MFA and Blob reads',async()=>{
    const root=generateAccountRoot(),originalRoot=root.slice(),scope={...owner};
    const guarded={assertReady:vi.fn(async (seen:{ownerId:string})=>{
      expect(Object.isFrozen(seen)).toBe(true);
      expect(seen.ownerId).toBe(owner.ownerId);
      expect(Reflect.set(seen,'ownerId','synthetic_wrong_owner')).toBe(false);
    })};
    const pending=sealOwnerPendingImages(scope,root,generateKeyId(),
      guarded,source([row(id,'original photo')]));
    scope.ownerId='synthetic_wrong_owner';
    root.fill(0);
    const sealed=await pending;
    expect(sealed).toHaveLength(1);
    const result=await decryptOwnerPendingImage(owner,originalRoot,sealed[0]);
    expect(result.localId).toBe(id);
    expect(await result.blob.text()).toBe('original photo');
    expect(guarded.assertReady).toHaveBeenCalledTimes(3);
  });
});
