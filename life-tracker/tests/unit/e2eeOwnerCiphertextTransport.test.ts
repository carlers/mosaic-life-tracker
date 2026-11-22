import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import {
  prepareEncryptedOwnerMutation, commitEncryptedOwnerMutation,
  fetchAndDecryptOwnerRecord, listAndDecryptOwnerChanges, type EncryptedOwnerRpc,
  rootTransportFromRpc,
} from '../../src/lib/e2ee/ownerCiphertextTransport';
import type { FullyAuthenticatedSessionGate } from '../../src/lib/e2ee/accountRootLifecycle';

const owner={projectId:'scratch_project',ownerId:'synthetic_owner'};
const gate:FullyAuthenticatedSessionGate={assertReady:vi.fn(async ()=>{})};
const doc={id:'local-task-A',userId:owner.ownerId,title:'Private school notes',
  date:'2026-11-19',completed:false,isDeleted:false,visibility:'private'};
function session() {return {root:generateAccountRoot(),keyId:generateKeyId(),generation:1};}

describe('M2 ciphertext-only owner transaction with verified server readback',()=>{
  it('sends no plaintext or semantic IDs and decrypts only matching ciphertext',async()=>{
    const key=session();
    const mutation=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    expect(mutation.record.rowId).toMatch(/^p_[a-f0-9]{32}$/);
    expect(JSON.stringify(mutation)).not.toContain('Private school notes');
    expect(JSON.stringify(mutation)).not.toContain('local-task-A');
    const rpc:EncryptedOwnerRpc={
      send:vi.fn(async (operation,input={})=>{
        if(operation==='put') {
          expect(JSON.stringify(input)).not.toContain('Private school notes');
          return {ok:true,status:'created',revision:mutation.record.envelope.revision};
        }
        if(operation==='get')return {ok:true,row:{...mutation.record,deleted:false,updatedAt:'2026-11-19'}};
        throw new Error('invalid');
      }),
    };
    const readback=await commitEncryptedOwnerMutation(owner,key,mutation,rpc,gate);
    expect(readback).toEqual(doc);
    expect(rpc.send).toHaveBeenCalledTimes(2);
  });
  it('derives the same opaque migration ID across devices and fresh client revisions',async()=>{
    const key=session();
    const a=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    const b=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    expect(a.record.rowId).toBe(b.record.rowId);
    expect(a.record.envelope.iv).not.toBe(b.record.envelope.iv);
    expect(a.opId).not.toBe(b.opId);
  });
  it('rejects modified routing and unauthenticated leaked plaintext fields',async()=>{
    const key=session(),mutation=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    for(const row of [
      {...mutation.record,routing:{...mutation.record.routing,date:'2026-11-20'}},
      {...mutation.record,deleted:true},
      {...mutation.record,title:'leaked task text'},
      {...mutation.record,ownerId:'foreign'},
    ]) {
      const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>({ok:true,row}))};
      await expect(fetchAndDecryptOwnerRecord(owner,key,'tasks',
        mutation.record.rowId,rpc,gate)).rejects.toThrow();
    }
  });
  it('preserves the intent on lost acknowledgement or mismatched readback revision',async()=>{
    const key=session(),mutation=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    const lost:EncryptedOwnerRpc={send:vi.fn(async()=>{throw new Error('offline')})};
    await expect(commitEncryptedOwnerMutation(owner,key,mutation,lost,gate)).rejects.toThrow('offline');
    const mismatch:EncryptedOwnerRpc={send:vi.fn(async op=>op==='put'
      ? {ok:true,status:'created',revision:mutation.record.envelope.revision}
      : {ok:true,row:{...mutation.record,envelope:{
        ...mutation.record.envelope,revision:'r_'+'f'.repeat(32)},
        deleted:false,updatedAt:'2026-11-19'}})};
    await expect(commitEncryptedOwnerMutation(owner,key,mutation,mismatch,gate)).rejects.toThrow();
  });
  it('never submits owner root or exposed local domain contents in RPC',async()=>{
    const key=session();
    const mutation=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>({ok:false}))};
    await expect(commitEncryptedOwnerMutation(owner,key,mutation,rpc,gate)).rejects.toThrow();
    const sent=JSON.stringify(vi.mocked(rpc.send).mock.calls);
    expect(sent).not.toContain('Private school notes');
    expect(sent).not.toContain('local-task-A');
    expect(sent).not.toContain(Array.from(key.root).join(','));
  });
  it('never uses account-root transport errors as plaintext fallback',async()=>{
    const rpc:EncryptedOwnerRpc={send:vi.fn(async op=>{
      if(op==='create_root') throw Object.assign(new Error('conflict'),{code:409});
      if(op==='read_root') throw Object.assign(new Error('missing'),{code:404});
      return {ok:true,status:'updated'};
    })};
    const wrapped={v:1,alg:'A256GCM' as const,kid:generateKeyId(),
      iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(64)};
    const root=rootTransportFromRpc(rpc);
    expect(await root.create(owner,wrapped)).toBe('conflict');
    expect(await root.read(owner)).toBeNull();
  });
  it('decrypts server-ordered changes and returns an independent timestamp+ID checkpoint',async()=>{
    const key=session();
    const mutation=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    const stamp='2026-11-22T08:42:12.123Z';
    const row={...mutation.record,deleted:false,updatedAt:stamp};
    const after={updatedAt:stamp,rowId:mutation.record.rowId};
    const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>({
      ok:true,rows:[{record:row,serverUpdatedAt:stamp}],after,hasMore:false,
    }))};
    const page=await listAndDecryptOwnerChanges(owner,key,'tasks',rpc,gate);
    expect(page.hasMore).toBe(false);
    expect(page.cursor).toEqual(after);
    expect(page.documents[0].rowId).toBe(after.rowId);
    expect(page.documents[0].serverUpdatedAt).toBe(after.updatedAt);
    expect(page.documents[0].document).toEqual({
      ...doc,__e2eeRevision:mutation.record.envelope.revision,
    });
    expect(rpc.send).toHaveBeenCalledWith('changes',{collection:'tasks'});
    vi.mocked(rpc.send).mockClear();
    vi.mocked(rpc.send).mockResolvedValueOnce({
      ok:true,rows:[],after,hasMore:false,
    });
    const idle=await listAndDecryptOwnerChanges(owner,key,'tasks',rpc,gate,after);
    expect(idle.documents).toEqual([]);
    expect(idle.cursor).toEqual(after);
    expect(rpc.send).toHaveBeenCalledWith('changes',{collection:'tasks',after});
    expect(JSON.stringify(vi.mocked(rpc.send).mock.calls)).not.toContain(doc.title);
  });

  it('rejects untrusted ciphertext pages before reporting any replication checkpoint',async()=>{
    const key=session();
    const m=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    const stamp='2026-11-22T08:42:12.123Z';
    const original={...m.record,deleted:false,updatedAt:stamp};
    const cursor={updatedAt:stamp,rowId:m.record.rowId};
    const ok={record:original,serverUpdatedAt:stamp};
    const invalid: Array<Record<string,unknown>>=[
      {ok:true,rows:[ok],after:null,hasMore:false},
      {ok:true,rows:[ok],after:cursor,hasMore:true},
      {ok:true,rows:[{...ok,serverUpdatedAt:'broken'}],after:cursor,hasMore:false},
      {ok:true,rows:[{...ok,record:{...original,ownerId:'other'}}],
        after:cursor,hasMore:false},
      {ok:true,rows:[{...ok,record:{...original,
        routing:{...original.routing,visibility:'public'}}}],
        after:cursor,hasMore:false},
      {ok:true,rows:[{...ok,record:{...original,envelope:{
        ...original.envelope,ct:'AAAAAAAAAAAAAAAAAAAAAA'}}}],
        after:cursor,hasMore:false},
      {ok:true,rows:[ok,ok],after:cursor,hasMore:false},
      {ok:true,rows:Array.from({length:21},()=>ok),
        after:cursor,hasMore:true},
      {ok:true,rows:[{...ok,plaintext:'secret'}],after:cursor,hasMore:false},
    ];
    for(const page of invalid) {
      const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>page)};
      await expect(listAndDecryptOwnerChanges(owner,key,'tasks',rpc,gate))
        .rejects.toThrow();
    }
    const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>({ok:true,rows:[],after:null,hasMore:false}))};
    await expect(listAndDecryptOwnerChanges(owner,key,'tasks',rpc,gate,{
      updatedAt:'invalid',rowId:cursor.rowId,
    })).rejects.toThrow('unavailable');
    expect(rpc.send).not.toHaveBeenCalled();
  });

  it('rejects a replayed earlier timestamp and equal-time lower row ID',async()=>{
    const key=session();
    const m=await prepareEncryptedOwnerMutation(owner,key,'tasks',doc,null);
    const start={updatedAt:'2026-11-22T08:42:12.123Z',rowId:m.record.rowId};
    const row={...m.record,deleted:false,updatedAt:start.updatedAt};
    for(const serverUpdatedAt of [
      '2026-11-20T00:00:00.000Z',start.updatedAt,
    ]) {
      const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>({
        ok:true,rows:[{record:row,serverUpdatedAt}],
        after:{updatedAt:serverUpdatedAt,rowId:m.record.rowId},hasMore:false,
      }))};
      await expect(listAndDecryptOwnerChanges(owner,key,'tasks',rpc,gate,start))
        .rejects.toThrow();
    }
  });

});
