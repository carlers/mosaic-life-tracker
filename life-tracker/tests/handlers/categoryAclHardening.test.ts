import {beforeEach, describe, expect, it} from 'vitest';
import {invoke, makeMockDb, type MockDb} from '../helpers/invoke-handler';

const owner = 'user_a';
const row = (id: string, perms = [
  'read("user:user_a")', 'update("user:user_a")', 'delete("user:user_a")',
]) => ({$id:id,user_id:owner,$permissions:perms});
describe('internal-only ACL cutover for category/task owner rows', () => {
  let db: MockDb;
  const call = (body: Record<string, unknown>, userId?: string) => invoke({
    mockDb:db,userId,body:{action:'harden_category_owner_acls',tableId:'tasks',...body},
  });
  beforeEach(() => {db=makeMockDb();db.listRows.mockResolvedValue({rows:[row('task_a')]});});

  it('refuses signed user calls, including owner calls', async () => {
    const r=await call({},owner);
    expect(r.status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('refuses unsupported table names', async () => {
    expect((await call({tableId:'messages'})).status).toBe(400);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('removes only mutation grants, preserving owner and collaborator read grants', async () => {
    const rowData=row('task_a',[
      'read("user:user_a")','read("user:friend_b")',
      'update("user:user_a")','delete("user:user_a")',
    ]);
    db.listRows.mockResolvedValue({rows:[rowData]});
    const r=await call({});
    expect(r.body).toMatchObject({ok:true,scanned:1,modified:1,nextCursor:null});
    expect(db.updateRow).toHaveBeenCalledWith({
      databaseId:'life_tracker',tableId:'tasks',rowId:'task_a',
      data:{},permissions:['read("user:user_a")','read("user:friend_b")'],
    });
  });

  it('does not mutate already read-only rows', async () => {
    db.listRows.mockResolvedValue({rows:[row('task_a',['read("user:user_a")'])]});
    expect((await call({})).body.modified).toBe(0);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('fails closed if a row is missing its owner read grant', async () => {
    db.listRows.mockResolvedValue({rows:[row('task_a',['read("user:friend_b")'])]});
    const r=await call({});
    expect(r.status).toBe(503);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('uses a bounded page with monotonic cursor to migrate large tables', async () => {
    const rows=Array.from({length:40},(_,i)=>row('task_'+i));
    db.listRows.mockResolvedValue({rows});
    const r=await call({cursor:'task_prev'});
    expect(r.body.nextCursor).toBe('task_39');
    expect(db.listRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'tasks',queries:expect.arrayContaining([
        {op:'orderAsc',field:'$id'},{op:'limit',n:40},{op:'cursorAfter',id:'task_prev'},
      ]),
    }));
  });
});
