import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
const req=createRequire(import.meta.url);
const {handleOwnerProfileWrite:write}=req('../../appwrite-functions/message-action/owner-profile-write.js');
describe('profile owner function',()=>{
 it('rejects a different profile ID',async()=>{
  const db={updateRow:vi.fn()};
  expect((await write(db,'owner',{rowId:'other',data:{user_id:'owner'}})).status).toBe(400);
  expect(db.updateRow).not.toHaveBeenCalled();
 });
});
describe('server profile ACL',()=>{
 it('creates with read-only grants',async()=>{
  const profile={user_id:'owner',username:'owner',avatar_file_id:'',updated_at:'2026-11-02T00:00:00Z'};
  const db={getRow:vi.fn().mockRejectedValueOnce({code:404}).mockResolvedValueOnce({...profile,$id:'profile_owner'}),createRow:vi.fn()};
  const res=await write(db,'owner',{rowId:'profile_owner',data:profile});
  expect(res.status).toBe(200);
  expect(db.createRow).toHaveBeenCalledWith(expect.objectContaining({permissions:['read("users")']}));
 });
});
