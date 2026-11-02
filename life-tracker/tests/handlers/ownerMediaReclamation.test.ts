import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const req=createRequire(import.meta.url);
const { createHash }=req('node:crypto');
const { listOwnerReclaimableMedia: list, requestOwnerMediaCleanup: request,
  confirmOwnerMediaCleanup: confirm, GRACE_MS }=
  req('../../appwrite-functions/message-action/owner-media-reclamation.js');
const owner='accountA', stranger='accountB';
const fileId='img_'+'a'.repeat(32);
const now=1_800_000_000_000;
const stamp=new Date(now).toISOString();
const token='b'.repeat(64);
const row={
  $id:fileId,file_id:fileId,owner_id:owner,purpose:'tasks',status:'verified',
  file_created_at:stamp,verified_at:stamp,size_bytes:150,
};
const file={
  $id:fileId,$createdAt:stamp,sizeOriginal:150,mimeType:'image/webp',
  $permissions:['read("users")',`update("user:${owner}")`,`delete("user:${owner}")`],
};
const saved={
  project:process.env.APPWRITE_FUNCTION_PROJECT_ID,
  flag:process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED,
};
beforeEach(()=>{
  process.env.APPWRITE_FUNCTION_PROJECT_ID='6a96e82d000d1310b3be';
  process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED='true';
});
afterEach(()=>{
  if(saved.project===undefined)delete process.env.APPWRITE_FUNCTION_PROJECT_ID;
  else process.env.APPWRITE_FUNCTION_PROJECT_ID=saved.project;
  if(saved.flag===undefined)delete process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED;
  else process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED=saved.flag;
});
function fixtures(){
  const db=makeMockDb(),storage=makeMockStorage();
  db.getRow.mockResolvedValue(row);
  db.listRows.mockResolvedValue({rows:[]});
  db.updateRows.mockResolvedValue({total:1});
  storage.getFile=vi.fn().mockResolvedValue(file);
  return {db,storage,callerId:owner,fileId,now};
}
const pending={
  ...row,status:'pending_delete',
  delete_requested_at:stamp,
  delete_token_hash:createHash('sha256').update(token).digest('hex'),
};

describe('real-user media reclamation is owner-confirmed and fail closed',()=>{
  it('requires explicit Scratch enablement; never deletes in production',async()=>{
    const x=fixtures();
    delete process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED;
    expect((await list(x)).status).toBe(403);
    expect((await request({...x,confirmIntent:true})).status).toBe(403);
    process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED='true';
    process.env.APPWRITE_FUNCTION_PROJECT_ID='production';
    expect((await confirm({...x,confirmationToken:token})).status).toBe(403);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('never exposes another owner or deletes synthetic, legacy, chat or unverified uploads',async()=>{
    const x=fixtures();
    x.db.getRow.mockResolvedValue({...row,owner_id:stranger});
    expect((await request({...x,confirmIntent:true})).status).toBe(403);
    x.db.getRow.mockResolvedValue({...row,purpose:'synthetic'});
    expect((await request({...x,confirmIntent:true})).status).toBe(403);
    x.db.getRow.mockResolvedValue({...row,purpose:'chat'});
    expect((await request({...x,confirmIntent:true})).status).toBe(403);
    x.db.getRow.mockResolvedValue({...row,status:'reserved'});
    expect((await request({...x,confirmIntent:true})).status).toBe(409);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('lists only owner-verified, unreferenced candidates',async()=>{
    const x=fixtures();
    x.db.listRows.mockImplementation(async ({tableId}:any)=>({rows:
      tableId==='media_uploads'?[row]:[]}));
    const r=await list(x);
    expect(r.status).toBe(200);
    expect(r.body.candidates).toEqual([{fileId,purpose:'tasks',bytes:150,uploadedAt:stamp,state:'verified'}]);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('never lists a photo referenced by a tombstoned or shared row',async()=>{
    const x=fixtures();
    x.db.listRows.mockImplementation(async({tableId}:any)=>({rows:tableId==='media_uploads'?
      [row]:tableId==='messages'?[{$id:'msg',deleted:true,attachment_file_id:fileId}]:[]}));
    expect((await list(x)).body.candidates).toEqual([]);
  });
  it('requires explicit intent and current server reference clearance',async()=>{
    const x=fixtures();
    expect((await request({...x,confirmIntent:false})).status).toBe(400);
    x.db.listRows.mockResolvedValue({rows:[{$id:'tombstone',image:fileId}]});
    expect((await request({...x,confirmIntent:true})).status).toBe(409);
    expect(x.db.updateRows).not.toHaveBeenCalled();
  });
  it('issues a 60s challenge and does not delete while preparing',async()=>{
    const x=fixtures();
    const r=await request({...x,confirmIntent:true});
    expect(r.status).toBe(200);
    expect(r.body.confirmationToken).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(r.body.notBefore)).toBe(now+GRACE_MS);
    expect(x.db.updateRows.mock.calls[0][0].data.status).toBe('pending_delete');
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('rejects the wrong token, a premature deletion and a newly referenced row',async()=>{
    const x=fixtures();
    x.db.getRow.mockResolvedValue(pending);
    expect((await confirm({...x,confirmationToken:'bad',now:now+GRACE_MS+1})).status).toBe(409);
    expect((await confirm({...x,confirmationToken:token,now:now+GRACE_MS-1})).status).toBe(409);
    x.db.listRows.mockResolvedValue({rows:[{$id:'attached',image:fileId}]});
    expect((await confirm({...x,confirmationToken:token,now:now+GRACE_MS+1})).status).toBe(409);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('rechecks fingerprint, conditionally marks deletion and records receipt',async()=>{
    const x=fixtures();
    x.db.getRow.mockResolvedValue(pending);
    const r=await confirm({...x,confirmationToken:token,now:now+GRACE_MS+1});
    expect(r).toEqual({status:200,body:{fileId,status:'deleted'}});
    expect(x.db.updateRows.mock.calls[0][0].queries).toContainEqual(
      expect.objectContaining({key:'delete_token_hash'}));
    expect(x.db.updateRows.mock.calls.map((v:any)=>v[0].data.status)).toEqual(['deleting','deleted']);
    expect(x.storage.deleteFile).toHaveBeenCalledExactlyOnceWith({bucketId:'task_images',fileId});
    expect(x.db.updateRows.mock.calls[1][0].data.delete_receipt).toMatch(/^[a-f0-9]{64}$/);
  });
  it('recovers a crash after removal, with no second Storage delete',async()=>{
    const x=fixtures();
    x.db.getRow.mockResolvedValue({...pending,status:'deleting'});
    x.storage.getFile.mockRejectedValue({code:404});
    expect((await confirm({...x,confirmationToken:token,now:now+GRACE_MS+1})).status).toBe(200);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('can reissue a lost challenge only for the same owner',async()=>{
    const x=fixtures();
    x.db.getRow.mockResolvedValue(pending);
    const r=await request({...x,confirmIntent:true});
    expect(r.status).toBe(200);
    expect(x.db.updateRows.mock.calls[0][0].queries).toContainEqual(
      expect.objectContaining({key:'delete_token_hash'}));
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
});
