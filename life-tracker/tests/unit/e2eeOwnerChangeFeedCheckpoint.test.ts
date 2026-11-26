import { describe,expect,it,vi,beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({changes:vi.fn()}));
vi.mock('../../src/lib/e2ee/ownerCiphertextTransport',()=>({
  OWNER_ONLY_COLLECTIONS:['tasks','categories','diary','bucketList','bucketTaskLinks','settings'],
  listAndDecryptOwnerChanges:mocks.changes,
}));
import {stageEncryptedOwnerChangeFeed, type OwnerFeedCheckpoint} from '../../src/lib/e2ee/ownerChangeFeedCheckpoint';
import type {Owner} from '../../src/lib/e2ee/coreCrypto';
import type {CryptoSession} from '../../src/lib/e2ee/accountRootLifecycle';

const owner:Owner={projectId:'6b00671500279e901846',ownerId:'synthetic_owner'};
const session={root:new Uint8Array(32),keyId:'k_'+'a'.repeat(32),generation:1} as CryptoSession;
const first={updatedAt:'2026-11-26T02:00:00.000Z',rowId:'p_'+'b'.repeat(32)};
const second={updatedAt:'2026-11-26T02:00:01.000Z',rowId:'p_'+'c'.repeat(32)};
const change=(id:string,after:typeof first)=>({
  document:{id,userId:owner.ownerId,__e2eeRevision:'r_'+'e'.repeat(32)},
  rowId:after.rowId,serverUpdatedAt:after.updatedAt,
});
function harness() {
  let saved:OwnerFeedCheckpoint|null=null;
  const apply=vi.fn().mockResolvedValue(undefined);
  const cas=vi.fn().mockImplementation(async (_o,_c,expected,next)=>{
    if (JSON.stringify(saved)!==JSON.stringify(expected)) return false;
    saved=next;return true;
  });
  return {apply,cas,
    store:{read:vi.fn(async()=>saved),compareAndSet:cas},
    gate:{assertReady:vi.fn().mockResolvedValue(undefined)},
    current:vi.fn(()=>true),
    rpc:{send:vi.fn()},
    saved:()=>saved,
  };
}
beforeEach(()=>{vi.clearAllMocks();});
describe('staged Scratch-only authenticated owner change checkpoint',()=>{
  it('applies AEAD-verified page before advancing local checkpoint and resumes from exact timestamp+opaque ID',async()=>{
    const h=harness();
    mocks.changes.mockResolvedValueOnce({documents:[change('local_a',first)],cursor:first,hasMore:false});
    const result=await stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current);
    expect(result).toMatchObject({pages:1,records:1,lastCursor:first,moreMayRemain:false});
    expect(h.apply).toHaveBeenCalledOnce();
    expect(h.cas).toHaveBeenCalledOnce();
    expect(h.saved()).toMatchObject({ownerId:owner.ownerId,projectId:owner.projectId,
      keyId:session.keyId,generation:1,after:first});
    mocks.changes.mockResolvedValueOnce({documents:[change('local_b',second)],cursor:second,hasMore:false});
    await stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,h.store,{apply:h.apply},h.current);
    expect(mocks.changes.mock.calls[1][5]).toEqual(first);
  });
  it('never commits a checkpoint when local apply fails, allowing an idempotent retry',async()=>{
    const h=harness();
    mocks.changes.mockResolvedValue({documents:[change('local_a',first)],cursor:first,hasMore:false});
    h.apply.mockRejectedValueOnce(new Error('disposable IndexedDB locked'));
    await expect(stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current)).rejects.toThrow();
    expect(h.cas).not.toHaveBeenCalled();
    expect(h.saved()).toBeNull();
    h.apply.mockResolvedValue(undefined);
    await stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current);
    expect(h.saved()?.after).toEqual(first);
    expect(mocks.changes.mock.calls[1][5]).toBeNull();
  });
  it('refuses stale account after authenticated fetch, before local apply or checkpoint',async()=>{
    const h=harness();
    mocks.changes.mockImplementationOnce(async()=>{
      h.current.mockReturnValue(false);
      return {documents:[change('local_a',first)],cursor:first,hasMore:false};
    });
    await expect(stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current)).rejects.toThrow('checkpoint unavailable');
    expect(h.apply).not.toHaveBeenCalled();
    expect(h.cas).not.toHaveBeenCalled();
  });
  it('rejects cross-account or stale-key checkpoint without fetching or applying data',async()=>{
    const h=harness();
    h.store.read.mockResolvedValueOnce({schema:1,...owner,
      ownerId:'other',collection:'tasks',keyId:session.keyId,generation:1,after:first});
    await expect(stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current)).rejects.toThrow();
    expect(mocks.changes).not.toHaveBeenCalled();
    h.store.read.mockResolvedValueOnce({schema:1,...owner,collection:'tasks',
      keyId:'k_'+'f'.repeat(32),generation:1,after:first});
    await expect(stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current)).rejects.toThrow();
    expect(mocks.changes).not.toHaveBeenCalled();
  });
  it('never applies or advances after local CAS conflict, even with a valid remote page',async()=>{
    const h=harness();
    mocks.changes.mockResolvedValue({documents:[change('local_a',first)],cursor:first,hasMore:false});
    h.cas.mockResolvedValueOnce(false);
    await expect(stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current)).rejects.toThrow('checkpoint unavailable');
    expect(h.apply).toHaveBeenCalledTimes(1);
    expect(h.saved()).toBeNull();
  });
  it('rejects non-Scratch owner and invalid root before network or local mutations',async()=>{
    const h=harness();
    await expect(stageEncryptedOwnerChangeFeed({...owner,projectId:'prod'},session,'tasks',
      h.rpc,h.gate,h.store,{apply:h.apply},h.current)).rejects.toThrow();
    expect(mocks.changes).not.toHaveBeenCalled();
    expect(h.cas).not.toHaveBeenCalled();
  });
  it('stops at an empty final page without moving checkpoint or calling applier',async()=>{
    const h=harness();
    mocks.changes.mockResolvedValue({documents:[],cursor:null,hasMore:false});
    const out=await stageEncryptedOwnerChangeFeed(owner,session,'tasks',h.rpc,h.gate,
      h.store,{apply:h.apply},h.current);
    expect(out.records).toBe(0);
    expect(out.pages).toBe(0);
    expect(h.cas).not.toHaveBeenCalled();
    expect(h.apply).not.toHaveBeenCalled();
  });
});
