import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import { prepareEncryptedOwnerMutation, listAndDecryptOwnerPage,
  scanAndDecryptOwnerCollection, type EncryptedOwnerRpc,
} from '../../src/lib/e2ee/ownerCiphertextTransport';

const owner={projectId:'scratch',ownerId:'synthetic_owner'};
const gate={assertReady:vi.fn(async()=>{})};
function session(){return {root:generateAccountRoot(),keyId:generateKeyId(),generation:1};}
const task=(id:string)=>({id,userId:owner.ownerId,title:'private '+id,
  date:'2026-11-20',isDeleted:false,completed:false,visibility:'private'});
async function remote(sessionKey:ReturnType<typeof session>,id:string) {
  const v=await prepareEncryptedOwnerMutation(owner,sessionKey,'tasks',task(id),null);
  return {...v.record,deleted:false,updatedAt:'2026-11-20'};
}
describe('M2 source-only encrypted cross-device owner scans',()=>{
  it('reads two independent ciphertexts and checks owner metadata and opaque IDs',async()=>{
    const key=session(), rows=[await remote(key,'one'),await remote(key,'two')]
      .sort((a,b)=>a.rowId.localeCompare(b.rowId));
    const rpc:EncryptedOwnerRpc={send:vi.fn(async op=>{
      if(op==='list')return {ok:true,rows,after:null};
      throw new Error('not expected');
    })};
    const decoded=await scanAndDecryptOwnerCollection(owner,key,'tasks',rpc,gate);
    expect(decoded.map(x=>x.title).sort()).toEqual(['private one','private two']);
    expect(JSON.stringify(vi.mocked(rpc.send).mock.calls)).not.toContain('private one');
  });
  it('rejects malformed pagination cursors, owner spoofing and mixed collections',async()=>{
    const key=session(), row=await remote(key,'one');
    for(const res of [
      {ok:true,rows:[{...row,ownerId:'foreign'}],after:null},
      {ok:true,rows:[{...row,collection:'diary'}],after:null},
      {ok:true,rows:[{...row,routing:{...row.routing,date:'2026-11-19'}}],after:null},
      {ok:true,rows:[row],after:'p_'+'a'.repeat(32)},
      {ok:true,rows:[],after:'p_'+'a'.repeat(32)},
      {ok:true,rows:[row],after:undefined},
    ]){
      const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>res)};
      await expect(listAndDecryptOwnerPage(owner,key,'tasks',rpc,gate)).rejects.toThrow();
    }
  });
  it('never supplies a stale cursor to a new complete scan',async()=>{
    const key=session(),row=await remote(key,'one');
    const rpc:EncryptedOwnerRpc={send:vi.fn(async (op,input)=>{
      expect(op).toBe('list');
      expect(input).toEqual({collection:'tasks'});
      return {ok:true,rows:[row],after:null};
    })};
    expect(await scanAndDecryptOwnerCollection(owner,key,'tasks',rpc,gate)).toHaveLength(1);
    expect(await scanAndDecryptOwnerCollection(owner,key,'tasks',rpc,gate)).toHaveLength(1);
  });
});
