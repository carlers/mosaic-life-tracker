import {describe,expect,it,vi} from 'vitest';
import {generateAccountRoot,generateKeyId} from '../../src/lib/e2ee/coreCrypto';
import {
  LOCAL_OWNER_COLLECTIONS,sealCurrentOwnerOfflineRows,decryptOwnerOfflineRow,
  type LocalOwnerCollection,type OwnerLocalReader,
} from '../../src/lib/e2ee/ownerOfflineRowSnapshot';

const owner={projectId:'scratch_synthetic',ownerId:'synthetic_A'};
const root=()=>generateAccountRoot();
const task={id:'private_task',userId:owner.ownerId,isDeleted:false,title:'PRIVATE TODAY',date:'2044-08-21'};
const tomb={id:'deleted_task',userId:owner.ownerId,isDeleted:true,title:'DELETED PRIVATE'};
const orphan={id:'orphan_link',userId:owner.ownerId,isDeleted:true,taskId:'missing_task',activityId:'missing_workout'};
function reader(rows:Partial<Record<LocalOwnerCollection,readonly Record<string,unknown>[]>>={}):OwnerLocalReader {
  return {readAll:vi.fn(async(collection:LocalOwnerCollection)=>(rows[collection]??[]).map(x=>({...x})))};
}
const gate={assertReady:vi.fn(async()=>{})};

describe('current dev offline encrypted owner row snapshot — dormant only',()=>{
  it('captures local tombstones and orphaned links without plaintext in serialized records',async()=>{
    const input=reader({tasks:[task,tomb],activityTaskLinks:[orphan]});
    const key=root(),keyId=generateKeyId();
    const rows=await sealCurrentOwnerOfflineRows(owner,key,keyId,gate,input);
    expect(rows).toHaveLength(3);
    const serial=JSON.stringify(rows);
    for(const secret of ['PRIVATE TODAY','DELETED PRIVATE','private_task','orphan_link',
      'missing_workout','2044-08-21',owner.ownerId])expect(serial).not.toContain(secret);
    const decoded=await Promise.all(rows.map(x=>decryptOwnerOfflineRow(owner,key,x)));
    expect(decoded).toContainEqual(tomb);
    expect(decoded).toContainEqual(orphan);
    expect(decoded).toContainEqual(task);
    expect(input.readAll).toHaveBeenCalledTimes(LOCAL_OWNER_COLLECTIONS.length*2);
  });
  it('seals local friendship and chat copies without creating any remote social identity',async()=>{
    const friend={id:'friend_semantic_id',userId:owner.ownerId,isDeleted:false,
      friendId:'other_person',friendDisplayName:'private_friend'},
      message={id:'chat_semantic_id',userId:owner.ownerId,isDeleted:false,
        senderId:owner.ownerId,recipientId:'other_person',
        content:'CONFIDENTIAL-HISTORICAL-MESSAGE',threadId:'sensitive_thread'};
    const source=reader({friendships:[friend],messages:[message]});
    const key=root(),kid=generateKeyId();
    const first=await sealCurrentOwnerOfflineRows(owner,key,kid,gate,source);
    const second=await sealCurrentOwnerOfflineRows(owner,key,kid,gate,source);
    expect(first).toHaveLength(2);
    const serialized=JSON.stringify(first);
    for(const s of ['CONFIDENTIAL-HISTORICAL-MESSAGE','sensitive_thread',
      'private_friend','other_person','chat_semantic_id',owner.ownerId])
      expect(serialized).not.toContain(s);
    expect(first.every(x=>/^p_[a-f0-9]{32}$/.test(x.rowId))).toBe(true);
    expect(first[0].rowId).not.toBe(second[0].rowId);
    expect((await Promise.all(first.map(row=>decryptOwnerOfflineRow(owner,key,row)))))
      .toEqual([friend,message]);
    await expect(decryptOwnerOfflineRow({...owner,ownerId:'other'},key,first[0])).rejects.toThrow();
  });
  it('derives stable opaque row identity but fresh authenticated local revision on retries',async()=>{
    const input=reader({tasks:[task]});
    const key=root(),kid=generateKeyId();
    const first=await sealCurrentOwnerOfflineRows(owner,key,kid,gate,input);
    const second=await sealCurrentOwnerOfflineRows(owner,key,kid,gate,input);
    expect(first[0].rowId).toBe(second[0].rowId);
    expect(first[0].revision).not.toBe(second[0].revision);
    expect(first[0].envelope.ct).not.toBe(second[0].envelope.ct);
  });
  it('rejects wrong owner/root and tampered collection or opaque mapping',async()=>{
    const key=root();
    const [record]=await sealCurrentOwnerOfflineRows(owner,key,generateKeyId(),gate,reader({tasks:[task]}));
    await expect(decryptOwnerOfflineRow({...owner,ownerId:'stranger'},key,record)).rejects.toThrow();
    await expect(decryptOwnerOfflineRow({...owner,projectId:'another'},key,record)).rejects.toThrow();
    await expect(decryptOwnerOfflineRow(owner,root(),record)).rejects.toThrow();
    await expect(decryptOwnerOfflineRow(owner,key,{...record,collection:'diary'})).rejects.toThrow();
    await expect(decryptOwnerOfflineRow(owner,key,{...record,rowId:'p_'+'f'.repeat(32)})).rejects.toThrow();
  });
  it('does not report complete source if rows change between readback passes',async()=>{
    const base=reader({tasks:[task]});
    let reads=0;
    const changing:OwnerLocalReader={readAll:async(c,u)=>{
      const r=await base.readAll(c,u);
      if(c==='tasks'&&++reads===2)return [tomb];
      return r;
    }};
    await expect(sealCurrentOwnerOfflineRows(owner,root(),generateKeyId(),gate,changing)).rejects.toThrow('incomplete');
  });
  it('rejects malformed/cross-owner/duplicate source and missing auth before reading',async()=>{
    const key=root(),kid=generateKeyId();
    for(const rows of [[task,{...task,title:'duplicate'}],[{...task,userId:'someone_else'}],[{...task,isDeleted:'yes'}]]) {
      await expect(sealCurrentOwnerOfflineRows(owner,key,kid,gate,reader({tasks:rows}))).rejects.toThrow();
    }
    const denied={assertReady:vi.fn(async()=>{throw new Error('MFA pending')})};
    const source=reader({tasks:[task]});
    await expect(sealCurrentOwnerOfflineRows(owner,key,kid,denied,source)).rejects.toThrow('MFA pending');
    expect(source.readAll).not.toHaveBeenCalled();
  });
});


describe('offline owner row snapshot direct callback account binding',()=>{
  it('keeps the original owner and encryption key despite reentrant MFA and caller mutation',async()=>{
    const secret=root(),mutable=secret.slice(),scope={...owner};
    const guarded={assertReady:vi.fn(async (seen:{ownerId:string})=>{
      expect(Object.isFrozen(seen)).toBe(true);
      expect(seen.ownerId).toBe(owner.ownerId);
      expect(Reflect.set(seen,'ownerId','synthetic_wrong_owner')).toBe(false);
    })};
    const input=reader({tasks:[task]});
    const pending=sealCurrentOwnerOfflineRows(scope,mutable,
      generateKeyId(),guarded,input);
    scope.ownerId='synthetic_wrong_owner';
    mutable.fill(0);
    const rows=await pending;
    expect(rows).toHaveLength(1);
    expect(await decryptOwnerOfflineRow(owner,secret,rows[0])).toEqual(task);
    expect(input.readAll).toHaveBeenCalledTimes(LOCAL_OWNER_COLLECTIONS.length*2);
    expect(guarded.assertReady).toHaveBeenCalledTimes(3);
  });
});


describe('offline row capture detaches each source object before subsequent reads',()=>{
  it('does not capture an in-place mutation performed by a later collection read',async()=>{
    const key=root(),kid=generateKeyId(),shared={...task};
    let taskReads=0,editedDuringFirstSweep=false;
    const r:OwnerLocalReader={
      readAll:vi.fn(async(collection)=>{
        if(collection==='tasks'){
          taskReads++;
          return taskReads===1?[shared]:[{...task}];
        }
        if(collection==='categories'&&!editedDuringFirstSweep){
          shared.title='MUTATED_AFTER_TASK_READ';
          editedDuringFirstSweep=true;
        }
        return [];
      }),
    };
    const saved=await sealCurrentOwnerOfflineRows(owner,key,kid,gate,r);
    expect(editedDuringFirstSweep).toBe(true);
    expect(saved).toHaveLength(1);
    const original=await decryptOwnerOfflineRow(owner,key,saved[0]);
    expect(original).toEqual(task);
    expect(original.title).toBe('PRIVATE TODAY');
    expect(JSON.stringify(saved)).not.toContain('MUTATED_AFTER_TASK_READ');
    expect(r.readAll).toHaveBeenCalledTimes(LOCAL_OWNER_COLLECTIONS.length*2);
  });
});
