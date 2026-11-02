import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { stageReferenceTransaction } =
  require('../../appwrite-functions/message-action/media-reference-transaction.js');
const id = 'img_' + 'a'.repeat(32);
function fixture(status = 'verified', epoch = 8) {
  return {
    getRow: vi.fn().mockResolvedValue({file_id:id, owner_id:'owner', status, reference_epoch:epoch}),
    createTransaction: vi.fn().mockResolvedValue({$id:'txn_1'}),
    updateRow: vi.fn().mockResolvedValue({}),
    updateTransaction: vi.fn().mockResolvedValue({}),
  };
}
const run = (db: ReturnType<typeof fixture>, stageTarget: (id:string)=>Promise<unknown>) =>
  stageReferenceTransaction(db, {callerId:'owner',tableId:'tasks',data:{image:id},stageTarget});

describe('isolated reference transaction primitive', () => {
  it('stages ledger write before target write and commits once', async () => {
    const db=fixture(),events:string[]=[];
    db.updateRow.mockImplementation(async()=>{events.push('ledger');});
    db.updateTransaction.mockImplementation(async()=>{events.push('commit');});
    const r=await run(db,async transactionId=>{expect(transactionId).toBe('txn_1');events.push('target');return {total:1};});
    expect(r).toEqual({guarded:true,result:{total:1}});
    expect(events).toEqual(['ledger','target','commit']);
    expect(db.updateRow).toHaveBeenCalledWith({
      databaseId:'life_tracker',tableId:'media_uploads',rowId:id,
      data:{reference_epoch:9},transactionId:'txn_1',
    });
  });
  it.each(['pending_delete','deleting','deleted','reserved'])(
    'rejects %s before transaction', async status => {
      const db=fixture(status),stage=vi.fn();
      expect((await run(db,stage)).denied).toMatchObject({status:409});
      expect(db.createTransaction).not.toHaveBeenCalled();
      expect(stage).not.toHaveBeenCalled();
    });
  it('touches a removed prior reference even when new data has no photo', async () => {
    const db=fixture();
    await stageReferenceTransaction(db, {
      callerId:'owner',tableId:'tasks',data:{image:''},
      previousData:{image:id},
      stageTarget:async()=>({total:1}),
    });
    expect(db.updateRow).toHaveBeenCalledTimes(1);
  });
  it('rolls back zero-match CAS without reporting a committed write',async()=>{
    const db=fixture();
    await expect(run(db,async()=>({total:0}))).rejects.toMatchObject({code:409});
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'txn_1',rollback:true});
    expect(db.updateTransaction).not.toHaveBeenCalledWith(
      expect.objectContaining({commit:true}));
  });

  it('rejects foreign owner', async () => {
    const db=fixture();
    db.getRow.mockResolvedValueOnce({file_id:id,owner_id:'other',status:'verified'});
    expect((await run(db,vi.fn())).denied).toMatchObject({status:403});
  });
  it('requires migrated safe integer epoch', async () => {
    const db=fixture('verified',Number.NaN);
    await expect(run(db,vi.fn())).rejects.toThrow('epoch migration incomplete');
    expect(db.createTransaction).not.toHaveBeenCalled();
  });
  it('rolls back on staging failure without retrying outside transaction', async () => {
    const db=fixture(),err=new Error('target failed');
    await expect(run(db,async()=>{throw err;})).rejects.toBe(err);
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'txn_1',rollback:true});
    expect(db.updateTransaction).not.toHaveBeenCalledWith(expect.objectContaining({commit:true}));
  });
  it('treats commit conflicts as failed writes', async () => {
    const db=fixture();
    db.updateTransaction.mockImplementation(async args=>{
      if(args.commit)throw Object.assign(new Error('transaction conflict'),{code:409});
    });
    await expect(run(db,async()=>({total:1}))).rejects.toMatchObject({code:409});
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'txn_1',rollback:true});
  });
  it('does not start a transaction for legacy IDs', async () => {
    const db=fixture(),target=vi.fn();
    db.getRow.mockRejectedValueOnce({code:404});
    expect(await run(db,target)).toEqual({guarded:false});
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(target).not.toHaveBeenCalled();
  });
});
