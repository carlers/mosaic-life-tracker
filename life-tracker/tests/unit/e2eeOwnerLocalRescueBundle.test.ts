import {describe,expect,it,vi} from 'vitest';
import {generateAccountRoot,generateKeyId} from '../../src/lib/e2ee/coreCrypto';
import {
  buildOwnerLocalRescueFile,verifyOwnerLocalRescueFile,OWNER_LOCAL_RESCUE_FILENAME,
  type OwnerLocalRescueSources,
} from '../../src/lib/e2ee/ownerLocalRescueBundle';

const owner={projectId:'synthetic_project',ownerId:'synthetic_owner'};
const doc={id:'private_tombstone',userId:owner.ownerId,isDeleted:true,
  title:'SENSITIVE DELETED NOTE',date:'2045-02-04'};
const orphan={id:'private_orphan_link',userId:owner.ownerId,isDeleted:true,
  taskId:'missing_task',activityId:'missing_activity'};
const id='localimg_'+'f'.repeat(26);
function sources():OwnerLocalRescueSources{
  return {
    rows:{readAll:vi.fn(async(collection)=>
      collection==='tasks'?[{...doc}]:
      collection==='activityTaskLinks'?[{...orphan}]:[])},
    images:{readAll:vi.fn(async()=>[
      {id,ownerUserId:owner.ownerId,blob:new Blob(['sensitive orphan image'],{
        type:'image/png'}),createdAt:'2026-11-26T04:00:00.000Z'},
    ])},
  };
}
const gate={assertReady:vi.fn(async()=>{})};

describe('source-only local encrypted owner bundle (no filesystem or network)',()=>{
  it('builds a sealed Blob containing tombstones, orphaned links/images without plaintext',async()=>{
    const root=generateAccountRoot();
    const result=await buildOwnerLocalRescueFile(owner,root,generateKeyId(),gate,sources());
    expect(result.filename).toBe(OWNER_LOCAL_RESCUE_FILENAME);
    expect(result.rows).toBe(2);
    expect(result.media).toBe(1);
    expect(result.file.type).toBe('application/octet-stream');
    const text=await result.file.text();
    for(const secret of [doc.id,orphan.id,doc.title,doc.date,id,
      'sensitive orphan image',owner.ownerId,'image/png']){
      expect(text).not.toContain(secret);
    }
    expect(await verifyOwnerLocalRescueFile(owner,root,new Blob([text]))).toEqual({rows:2,media:1});
  });
  it('fails on tampering, truncation, plaintext fallback, wrong account and root',async()=>{
    const root=generateAccountRoot();
    const file=(await buildOwnerLocalRescueFile(owner,root,generateKeyId(),gate,sources())).file;
    await expect(verifyOwnerLocalRescueFile({...owner,ownerId:'wrong'},root,file)).rejects.toThrow();
    await expect(verifyOwnerLocalRescueFile({...owner,projectId:'other'},root,file)).rejects.toThrow();
    await expect(verifyOwnerLocalRescueFile(owner,generateAccountRoot(),file)).rejects.toThrow();
    await expect(verifyOwnerLocalRescueFile(owner,root,new Blob(['plaintext']))).rejects.toThrow();
    const parsed=JSON.parse(await file.text());
    await expect(verifyOwnerLocalRescueFile(owner,root,new Blob([JSON.stringify({
      ...parsed,rows:[],
    })]))).rejects.toThrow();
    parsed.media[0].ciphertextBase64=parsed.media[0].ciphertextBase64.replace(/^./,
      parsed.media[0].ciphertextBase64[0]==='A'?'B':'A');
    await expect(verifyOwnerLocalRescueFile(owner,root,new Blob([JSON.stringify(parsed)]))).rejects.toThrow();
  });
  it('never produces a result when owner gate fails or local records change',async()=>{
    const key=generateAccountRoot(),kid=generateKeyId();
    const denied={assertReady:vi.fn(async()=>{throw new Error('MFA pending')})};
    const source=sources();
    await expect(buildOwnerLocalRescueFile(owner,key,kid,denied,source)).rejects.toThrow('MFA pending');
    expect(source.rows.readAll).not.toHaveBeenCalled();
    let reads=0;
    const changing=sources();
    const original=changing.rows.readAll;
    changing.rows.readAll=async(c,user)=>{
      const result=await original(c,user);
      if(c==='tasks'&&++reads===2)return [{...doc,title:'CHANGED'}];
      return result;
    };
    await expect(buildOwnerLocalRescueFile(owner,key,kid,gate,changing)).rejects.toThrow();
  });
  it('refuses oversize and unreadable files before any plaintext output',async()=>{
    await expect(verifyOwnerLocalRescueFile(owner,generateAccountRoot(),{
      size:200_000_000,text:async()=>'{bad',
    })).rejects.toThrow();
    await expect(verifyOwnerLocalRescueFile(owner,generateAccountRoot(),{
      size:5,text:async()=>{throw new Error('file denied')},
    })).rejects.toThrow();
  });
});
