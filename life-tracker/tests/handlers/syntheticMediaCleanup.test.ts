import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const req = createRequire(import.meta.url);
const { requestSyntheticCleanup: prepare, confirmSyntheticCleanup: confirm,
  noReferences, GRACE_MS } = req('../../appwrite-functions/message-action/synthetic-media-cleanup.js');
const { createHash }=req('node:crypto');

const owner='m1478_synth_owner';
const stranger='m1478_synth_stranger';
const fileId='img_'+'a'.repeat(32);
const now=1_800_000_000_000;
const token='b'.repeat(64);
const createdAt=new Date(now).toISOString();
const row={ $id:fileId, file_id:fileId, owner_id:owner,
  purpose:'synthetic',status:'verified',
  verified_at:createdAt,file_created_at:createdAt,size_bytes:140 };
const file={ $id:fileId,$createdAt:createdAt,sizeOriginal:140,mimeType:'image/webp',
  $permissions:[`read("user:${owner}")`,`update("user:${owner}")`,
    `delete("user:${owner}")`] };
const originalProject=process.env.APPWRITE_FUNCTION_PROJECT_ID;
const originalOwner=process.env.MOSAIC_1478_TEST_DELETE_OWNER_ID;
beforeEach(()=>{
  process.env.APPWRITE_FUNCTION_PROJECT_ID='6a96e82d000d1310b3be';
  process.env.MOSAIC_1478_TEST_DELETE_OWNER_ID=owner;
});
afterEach(()=>{
  if(originalProject===undefined)delete process.env.APPWRITE_FUNCTION_PROJECT_ID;
  else process.env.APPWRITE_FUNCTION_PROJECT_ID=originalProject;
  if(originalOwner===undefined)delete process.env.MOSAIC_1478_TEST_DELETE_OWNER_ID;
  else process.env.MOSAIC_1478_TEST_DELETE_OWNER_ID=originalOwner;
});
function fixture() {
  const db=makeMockDb(),storage=makeMockStorage();
  db.getRow.mockResolvedValue(row);
  db.listRows.mockResolvedValue({rows:[]});
  db.updateRows.mockResolvedValue({total:1});
  storage.getFile=vi.fn().mockResolvedValue(file);
  return {db,storage,callerId:owner,fileId,now};
}
function pending() {
  return {...row,status:'pending_delete',delete_requested_at:createdAt,
    delete_token_hash:createHash('sha256').update(token).digest('hex')};
}
describe('Scratch synthetic-only two-step media removal',()=>{
  it('rejects unrelated users and non-Scratch deployments before accessing data',async()=>{
    const x=fixture();
    expect((await prepare({...x,callerId:stranger})).status).toBe(403);
    process.env.APPWRITE_FUNCTION_PROJECT_ID='production-target';
    expect((await prepare(x)).status).toBe(403);
    expect(x.db.getRow).not.toHaveBeenCalled();
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('rejects real media purposes, legacy IDs, foreign owner and unverified uploads',async()=>{
    const x=fixture();
    x.db.getRow.mockResolvedValue({...row,purpose:'tasks'});
    expect((await prepare(x)).status).toBe(403);
    x.db.getRow.mockResolvedValue({...row,owner_id:stranger});
    expect((await prepare(x)).status).toBe(403);
    x.db.getRow.mockResolvedValue({...row,status:'reserved'});
    expect((await prepare(x)).status).toBe(409);
    expect((await prepare({...x,fileId:'old_picture'})).status).toBe(400);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('creates one opaque challenge without deleting bytes',async()=>{
    const x=fixture();
    const r=await prepare(x);
    expect(r.status).toBe(200);
    expect(r.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(r.body.notBefore)).toBe(now+GRACE_MS);
    expect(x.db.updateRows.mock.calls[0][0].data).toMatchObject({
      status:'pending_delete',delete_requested_at:createdAt,
    });
    expect(x.db.listRows).toHaveBeenCalledTimes(10);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('protects any referenced media, including shared and tombstoned references',async()=>{
    const x=fixture();
    x.db.listRows.mockImplementation(async({tableId}:any)=>({
      rows:tableId==='messages'?[{$id:'message',attachment_file_id:fileId,deleted:true}]:[],
    }));
    expect((await prepare(x)).status).toBe(409);
    expect(x.db.updateRows).not.toHaveBeenCalled();
  });
  it('fails closed if a reference scan is incomplete or duplicates identities',async()=>{
    const x=fixture();let p=0;
    x.db.listRows.mockImplementation(async()=>{const base=p++*100;return {rows:
      Array.from({length:100},(_,i)=>({$id:'record_'+(base+i)}))};});
    await expect(noReferences(x.db,fileId)).rejects.toThrow('incomplete');
    x.db.listRows.mockResolvedValue({rows:[{$id:'repeat'},{$id:'repeat'}]});
    await expect(noReferences(x.db,fileId)).rejects.toThrow('identity');
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('rejects changed Storage ACL, size or creation fingerprint',async()=>{
    const x=fixture();
    x.storage.getFile.mockResolvedValue({...file,sizeOriginal:141});
    await expect(prepare(x)).rejects.toThrow('fingerprint');
    expect(x.db.updateRows).not.toHaveBeenCalled();
  });
  it('rejects missing confirmation, missing grace, and new reference at confirm time',async()=>{
    const x=fixture();
    x.db.getRow.mockResolvedValue(pending());
    expect((await confirm({...x,token,now:now+GRACE_MS-1})).status).toBe(409);
    expect((await confirm({...x,token:'bad',now:now+GRACE_MS+1})).status).toBe(409);
    x.db.listRows.mockResolvedValue({rows:[{$id:'task',image:fileId}]});
    expect((await confirm({...x,token,now:now+GRACE_MS+1})).status).toBe(409);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('physically removes exactly the verified synthetic file after grace and records receipt',async()=>{
    const x=fixture();
    x.db.getRow.mockResolvedValue(pending());
    const r=await confirm({...x,token,now:now+GRACE_MS+1});
    expect(r).toEqual({status:200,body:{fileId,status:'deleted',scope:'synthetic-only'}});
    expect(x.storage.deleteFile).toHaveBeenCalledExactlyOnceWith({
      bucketId:'task_images',fileId,
    });
    expect(x.db.updateRows.mock.calls.map((c:any)=>c[0].data.status))
      .toEqual(['deleting','deleted']);
    expect(x.db.updateRows.mock.calls[1][0].data.delete_receipt).toMatch(/^[0-9a-f]{64}$/);
  });
  it('recovers from a crash after file deletion and writes the missing receipt',async()=>{
    const x=fixture();
    x.db.getRow.mockResolvedValue({...pending(),status:'deleting'});
    x.storage.getFile.mockRejectedValue({code:404});
    expect((await confirm({...x,token,now:now+GRACE_MS+1})).status).toBe(200);
    expect(x.storage.deleteFile).not.toHaveBeenCalled();
    expect(x.db.updateRows.mock.calls[0][0].data.status).toBe('deleted');
  });
});
