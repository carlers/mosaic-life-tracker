import {beforeEach,describe,expect,it,vi} from 'vitest';
import {currentRxDbOwnerLocalReader} from '../../src/lib/e2ee/ownerOfflineRowSnapshot';

const mock=vi.hoisted(()=>({getDatabase:vi.fn()}));
vi.mock('../../src/db/database',()=>({getDatabase:mock.getDatabase}));
beforeEach(()=>{mock.getDatabase.mockReset();});

describe('current-origin RxDB owner reader revision evidence (dormant recovery)',()=>{
  it('queries the correct owner and includes local RxDB revision, deletion and write metadata',async()=>{
    const recorded={
      id:'private_task',userId:'owner_123',isDeleted:true,title:'private',
      _deleted:false,_rev:'3-synthetic_local_revision',
      _meta:{lwt:1795663000000},_attachments:{},
    };
    const toJSON=vi.fn((includeMeta=false)=>{
      if(includeMeta)return recorded;
      const {_rev,_meta,_deleted,_attachments,...doc}=recorded;
      return doc;
    });
    const exec=vi.fn(async()=>[{toJSON}]);
    const find=vi.fn(()=>({exec}));
    mock.getDatabase.mockReturnValue({tasks:{find}});
    const rows=await currentRxDbOwnerLocalReader.readAll('tasks','owner_123');
    expect(find).toHaveBeenCalledWith({selector:{userId:'owner_123'}});
    expect(toJSON).toHaveBeenCalledExactlyOnceWith(true);
    expect(rows).toEqual([recorded]);
    expect(rows[0]).toMatchObject({isDeleted:true,_deleted:false,
      _rev:'3-synthetic_local_revision',_meta:{lwt:1795663000000}});
  });
  it('refuses misleading complete backup if local revision metadata was stripped',async()=>{
    for(const raw of [
      {id:'a',userId:'owner_123',isDeleted:true},
      {id:'a',userId:'owner_123',isDeleted:true,_deleted:false,_rev:'r',_meta:{}},
      {id:'a',userId:'owner_123',isDeleted:true,_deleted:true,_rev:'r',_meta:{lwt:1}},
    ]){
      mock.getDatabase.mockReturnValue({diary:{find:()=>({exec:async()=>[
        {toJSON:()=>raw},
      ]})}});
      await expect(currentRxDbOwnerLocalReader.readAll('diary','owner_123'))
        .rejects.toThrow('incomplete');
    }
  });
});
