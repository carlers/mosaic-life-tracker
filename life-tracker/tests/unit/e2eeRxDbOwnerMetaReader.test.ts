import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fillWithDefaultSettings} from 'rxdb';
import {tasksSchema} from '../../src/db/schema';
import {currentRxDbOwnerLocalReader} from '../../src/lib/e2ee/ownerOfflineRowSnapshot';
import {readOwnerRawStorageRows} from '../../src/lib/e2ee/ownerRawStorageRead';

const mock=vi.hoisted(()=>({getDatabase:vi.fn()}));
vi.mock('../../src/db/database',()=>({getDatabase:mock.getDatabase}));
beforeEach(()=>{mock.getDatabase.mockReset();});

const schema=fillWithDefaultSettings(tasksSchema);
const owner='synthetic_raw_owner';
const alive={id:'task_alive',userId:owner,isDeleted:false,
  title:'SECRET-LIVE',_deleted:false,_rev:'1-a',_meta:{lwt:1795663000000},
  _attachments:{}};
const tomb={id:'task_removed',userId:owner,isDeleted:false,
  title:'SECRET-REMOVED',_deleted:true,_rev:'2-b',_meta:{lwt:1795663000001},
  _attachments:{}};
function storage(rows:readonly Record<string,unknown>[]=[alive,tomb]){
  const query=vi.fn(async(p:{query:{selector:{userId:string;_deleted:boolean};
    skip:number;limit:number}})=>{
    const q=p.query;
    return {documents:rows.filter(x=>x.userId===q.selector.userId&&
      x._deleted===q.selector._deleted).sort((x,y)=>
        String(x.id).localeCompare(String(y.id))).slice(q.skip,q.skip+q.limit)};
  });
  return {schema,query};
}
describe('raw RxDB owner rescue includes physical tombstones',()=>{
  it('reads real and internally deleted records from storage without normal find()',async()=>{
    const layer=storage([... [tomb,alive],{...alive,id:'foreign',userId:'other'}]);
    mock.getDatabase.mockReturnValue({tasks:{storageInstance:layer}});
    const rows=await currentRxDbOwnerLocalReader.readAll('tasks',owner);
    expect(rows).toEqual([alive,tomb]);
    expect(rows[1]._deleted).toBe(true);
    expect(rows[1]._rev).toBe('2-b');
    expect(layer.query).toHaveBeenCalledTimes(2);
    expect(layer.query.mock.calls.map(c=>c[0].query.selector))
      .toEqual([{userId:owner,_deleted:false},{userId:owner,_deleted:true}]);
  });
  it('never reports success if source omits private revision, owner or tombstone flags',async()=>{
    for(const variant of [
      {...tomb,_rev:undefined}, {...tomb,_meta:{}},
      {...tomb,_deleted:false}, {...tomb,isDeleted:'unknown'},
      {...tomb,userId:'other'},
    ]){
      // A faulty storage response that violates the queried selector must
      // not be silently omitted; enforce own returned-row validation.
      const layer={schema,query:vi.fn(async()=>({documents:[variant]}))};
      await expect(readOwnerRawStorageRows(layer,owner)).rejects.toThrow('incomplete');
    }
  });
  it('refuses duplicate pages, suspicious pagination and unsupported raw adapter',async()=>{
    const layer=storage([alive,tomb,{...alive,id:'task_alive'}]);
    await expect(readOwnerRawStorageRows(layer,owner)).rejects.toThrow('incomplete');
    await expect(readOwnerRawStorageRows({schema,query:async()=>({
      documents:Array.from({length:76},()=>alive),
    })},owner)).rejects.toThrow('incomplete');
    await expect(readOwnerRawStorageRows({schema,query:async()=>({documents:[]})},''))
      .rejects.toThrow('incomplete');
  });
});
