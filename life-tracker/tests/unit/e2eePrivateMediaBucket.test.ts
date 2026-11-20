import { describe, expect, it, vi } from 'vitest';
import {
  OWNER_PRIVATE_MEDIA_BUCKET, assertEncryptedMediaBucket,
  migratePrivateOwnerMediaBucket,
} from '../../scripts/migrate-e2ee-private-media.mjs';

const projectId='6ae94a2100014d01f5ed';
function snapshot() {
  const c=OWNER_PRIVATE_MEDIA_BUCKET;
  return {$id:c.id,...c,allowedFileExtensions:[...c.allowedFileExtensions]};
}
describe('M2 owner-private encrypted media bucket opt-in contract',()=>{
  it('only accepts exact Oracle Scratch before any HTTP',async()=>{
    const request=vi.fn();
    for (const wrong of ['6ae9599c002ab812f9c3','6ae1bf2e00034572451b','',undefined]) {
      await expect(migratePrivateOwnerMediaBucket({request,projectId:wrong}))
        .rejects.toThrow('not exact Oracle Scratch');
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('requires no browser-wide ACLs and prevents ciphertext image transforms',()=>{
    expect(snapshot()).toMatchObject({
      permissions:[],fileSecurity:true,enabled:true,
      allowedFileExtensions:['bin'],compression:'none',
      encryption:true,antivirus:false,transformations:false,
    });
    expect(snapshot().maximumFileSize).toBe(12*1024*1024+3072);
  });
  it('creates a separate E2EE bucket and independently reads exact permissions',async()=>{
    const calls=[];
    const request=vi.fn(async (method,path,payload)=>{
      calls.push({method,path,payload});
      if(method==='GET' && calls.length===1)throw {status:404};
      if(method==='GET')return snapshot();
      return {};
    });
    const out=await migratePrivateOwnerMediaBucket({request,projectId});
    expect(out).toEqual({bucketId:'private_owner_media_v1',created:true});
    expect(calls.map(x=>x.method)).toEqual(['GET','POST','GET']);
    expect(calls[1].path).toBe('/storage/buckets');
    expect(calls[1].payload.permissions).toEqual([]);
    expect(calls[1].payload.maximumFileSize).toBe(12585984);
    expect(JSON.stringify(calls)).not.toContain('task_images');
  });
  it('rejects broad read or create grants and any missing file constraints',async()=>{
    const drift=[
      {permissions:['read("users")']},
      {permissions:['create("users")']},
      {fileSecurity:false}, {transformations:true},
      {maximumFileSize:99999999}, {allowedFileExtensions:['png']},
      {encryption:false}, {antivirus:true}, {compression:'gzip'},
    ];
    for(const change of drift) {
      const row={...snapshot(),...change};
      expect(()=>assertEncryptedMediaBucket(row)).toThrow('blocked');
      const request=vi.fn(async()=>row);
      await expect(migratePrivateOwnerMediaBucket({request,projectId}))
        .rejects.toThrow('blocked');
      expect(request).toHaveBeenCalledOnce();
    }
  });
  it('fails closed if create accepted but post-create ACL readback cannot be verified',async()=>{
    const request=vi.fn().mockRejectedValueOnce({status:404})
      .mockResolvedValueOnce({}).mockResolvedValueOnce({...snapshot(),permissions:['read("users")']});
    await expect(migratePrivateOwnerMediaBucket({request,projectId}))
      .rejects.toThrow('browser access grants');
    const second=vi.fn().mockRejectedValueOnce({status:404})
      .mockResolvedValueOnce({}).mockRejectedValueOnce({status:404});
    await expect(migratePrivateOwnerMediaBucket({request:second,projectId}))
      .rejects.toThrow('post-create readback unavailable');
  });
});
