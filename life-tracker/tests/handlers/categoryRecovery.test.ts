import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {invoke,makeMockDb,type MockDb} from '../helpers/invoke-handler';

const owner='owner_a',catId='cat_a';
const cat={$id:catId,$updatedAt:'2026-10-30T00:00:00Z',user_id:owner,
  name:'School',deleted:true,lifecycle_state:'delete',lifecycle_target:'recoverable'};
const tagged={$id:'task_a',$updatedAt:'2026-10-30T00:01:00Z',user_id:owner,
  category_id:catId,deleted:true,category_delete_marker:catId};
describe('server-owned category deletion recovery',()=>{
  let db:MockDb;
  const call=(action:string,body:Record<string,unknown>={},userId=owner)=>
    invoke({userId,mockDb:db,body:{action,categoryId:catId,confirmName:'School',...body}});
  beforeEach(()=>{
    process.env.CATEGORY_DESTRUCTIVE_ENABLED='true';
    db=makeMockDb();
    db.getRow.mockResolvedValue(cat);
    db.updateRows.mockResolvedValue({total:1});
    db.listRows.mockResolvedValue({rows:[],total:0});
  });
  afterEach(()=>{delete process.env.CATEGORY_DESTRUCTIVE_ENABLED;});
  it('fails closed when the destructive gate is disabled',async()=>{
    delete process.env.CATEGORY_DESTRUCTIVE_ENABLED;
    expect((await call('list_recoverable_categories')).status).toBe(503);
    expect((await call('recover_deleted_category')).status).toBe(503);
    expect(db.getRow).not.toHaveBeenCalled();
  });
  it('lists only recoverable owner rows without exposing task IDs',async()=>{
    db.listRows.mockResolvedValue({rows:[cat,{...cat,$id:'other',user_id:'stranger'}],total:2});
    const r=await call('list_recoverable_categories');
    expect(r.body).toMatchObject({ok:true,categories:[{id:catId,name:'School',status:'delete'}]});
    expect(r.body.categories[0].tasks).toBeUndefined();
    expect(db.listRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'categories',queries:expect.arrayContaining([
        {op:'equal',key:'user_id',value:owner},
        {op:'equal',key:'deleted',value:true},
        {op:'equal',key:'lifecycle_target',value:'recoverable'},
      ]),
    }));
  });
  it('rejects foreign, unmarked, already restored and unconfirmed categories',async()=>{
    db.getRow.mockResolvedValueOnce({...cat,user_id:'other'});
    expect((await call('recover_deleted_category')).status).toBe(404);
    db.getRow.mockResolvedValueOnce({...cat,lifecycle_target:''});
    expect((await call('recover_deleted_category')).status).toBe(404);
    db.getRow.mockResolvedValueOnce({...cat,deleted:false});
    expect((await call('recover_deleted_category')).status).toBe(404);
    expect((await call('recover_deleted_category',{confirmName:'Wrong'})).status).toBe(400);
    expect(db.updateRows).not.toHaveBeenCalled();
  });
  it('recovers only tasks tagged by category delete and publishes category last',async()=>{
    db.listRows.mockResolvedValueOnce({rows:[tagged]})
      .mockResolvedValueOnce({rows:[],total:0});
    const r=await call('recover_deleted_category');
    expect(r.body).toMatchObject({status:'done',affected:1,remaining:0});
    expect(db.updateRows).toHaveBeenNthCalledWith(2,expect.objectContaining({
      tableId:'tasks',data:expect.objectContaining({deleted:false,category_delete_marker:''}),
      queries:expect.arrayContaining([
        {op:'equal',key:'category_delete_marker',value:catId},
        {op:'equal',key:'deleted',value:true},
      ]),
    }));
    expect(db.updateRows).toHaveBeenLastCalledWith(expect.objectContaining({
      tableId:'categories',data:expect.objectContaining({
        deleted:false,lifecycle_state:'',lifecycle_target:'',
      }),
    }));
  });
  it('resumes a partial restore with a marked task and does not reveal category prematurely',async()=>{
    db.getRow.mockResolvedValue({...cat,lifecycle_state:'restore'});
    db.listRows.mockResolvedValueOnce({rows:[tagged]}).mockResolvedValueOnce({rows:[],total:7});
    const r=await call('recover_deleted_category');
    expect(r.body).toMatchObject({status:'processing',remaining:7});
    expect(db.updateRows).toHaveBeenCalledTimes(1);
    expect(db.updateRows).not.toHaveBeenCalledWith(expect.objectContaining({
      tableId:'categories',data:expect.objectContaining({deleted:false}),
    }));
  });
  it('leaves category deleted on a task CAS conflict',async()=>{
    db.listRows.mockResolvedValueOnce({rows:[tagged]});
    db.updateRows.mockResolvedValueOnce({total:1}).mockResolvedValueOnce({total:0});
    expect((await call('recover_deleted_category')).status).toBe(409);
    expect(db.updateRows).toHaveBeenCalledTimes(2);
  });
  it('recovers an empty category with no originally deleted tasks',async()=>{
    const r=await call('recover_deleted_category');
    expect(r.body).toMatchObject({status:'done',affected:0,remaining:0});
    expect(db.updateRows).toHaveBeenCalledTimes(2);
  });
});
