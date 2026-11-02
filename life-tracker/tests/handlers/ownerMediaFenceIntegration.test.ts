import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { handleOwnerRowCreate } = require('../../appwrite-functions/message-action/owner-row-create.js');
const { handleOwnerWriteCas } = require('../../appwrite-functions/message-action/owner-write-cas.js');
const t='2026-11-02T00:00:00.000Z';
const file='img_'+'a'.repeat(32);
const task={user_id:'owner',title:'Test',category_id:'cat_1',is_completed:false,
  order:0,date:'2026-11-02',created_at:t,updated_at:t,deleted:false,
  visibility:'private',image:file,reactions:''};
function fixture() {
  const db={
    getRow:vi.fn(async ({tableId}:{tableId:string})=>tableId==='media_uploads'
      ? {file_id:file,owner_id:'owner',status:'verified',reference_epoch:0}
      : tableId==='categories'?{user_id:'owner',deleted:false,lifecycle_state:''}
      : {...task,$updatedAt:t}),
    createTransaction:vi.fn().mockResolvedValue({$id:'tx'}),
    updateTransaction:vi.fn().mockResolvedValue({}),
    updateRow:vi.fn().mockResolvedValue({}),
    createRow:vi.fn().mockResolvedValue({}),
    updateRows:vi.fn().mockResolvedValue({total:1}),
    listRows:vi.fn().mockResolvedValue({rows:[]}),
  };
  return db;
}
beforeEach(()=>{process.env.MOSAIC_1478_REFERENCE_FENCE_ENABLED='true';});
afterEach(()=>{delete process.env.MOSAIC_1478_REFERENCE_FENCE_ENABLED;});
describe('opt-in transactional fence: live owner handlers',()=>{
  it('stages a new task attachment in the same transaction as its row',async()=>{
    const db=fixture();
    const r=await handleOwnerRowCreate(db,'owner',{tableId:'tasks',rowId:'task_new',data:task});
    expect(r.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'media_uploads',transactionId:'tx',data:{reference_epoch:1}}));
    expect(db.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',transactionId:'tx'}));
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'tx',commit:true});
  });
  it('touches the prior ledger on attachment removal via CAS',async()=>{
    const db=fixture();
    const r=await handleOwnerWriteCas(db,'owner',{
      tableId:'tasks',rowId:'task_a',expectedUpdatedAt:t,
      data:{...task,image:''},
    });
    expect(r.body.status).toBe('updated');
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'media_uploads',transactionId:'tx'}));
    expect(db.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',transactionId:'tx'}));
  });
  it('rejects late attachment when tombstone state wins',async()=>{
    const db=fixture();
    db.getRow.mockImplementation(async ({tableId}:{tableId:string})=>tableId==='media_uploads'
      ? {file_id:file,owner_id:'owner',status:'pending_delete',reference_epoch:2}
      : {user_id:'owner',deleted:false,lifecycle_state:''});
    const r=await handleOwnerRowCreate(db,'owner',{tableId:'tasks',rowId:'task_new',data:task});
    expect(r.status).toBe(409);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.createTransaction).not.toHaveBeenCalled();
  });
  it('rolls back on ledger vs deletion transition conflict',async()=>{
    const db=fixture();
    db.updateTransaction.mockImplementation(async ({commit}:{commit:boolean})=>{
      if(commit)throw Object.assign(new Error('Concurrent deletion'),{code:409});
    });
    const r=await handleOwnerRowCreate(db,'owner',{tableId:'tasks',rowId:'task_new',data:task});
    // Create conflict after tentative transaction rolls back; existing row
    // is returned only after verifying that it is owned by caller.
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('existing');
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'tx',rollback:true});
  });
});
