import {afterEach,describe,expect,it,vi} from 'vitest';
import {type RootEnvelope,generateAccountRoot} from '../../src/lib/e2ee/coreCrypto';
import {
  AccountRootConflictError,InitialRootEnrollment,RecoveryKeyReplacement,
  recoverAccountRoot,unlockRememberedAccountRoot,
  type AtomicRootTransport,type FullyAuthenticatedSessionGate,
  type RememberedRootStore,
} from '../../src/lib/e2ee/accountRootLifecycle';

const owner={projectId:'synthetic_scratch',ownerId:'synthetic_secret_cleanup'};
function createFixture(){
  let current:{generation:number;envelope:RootEnvelope}|null=null;
  const transport:AtomicRootTransport={
    create:vi.fn(async (_owner,envelope)=>{
      if(current)return 'conflict';
      current={generation:1,envelope};return 'created';
    }),
    read:vi.fn(async()=>current),
    replace:vi.fn(async (_owner,expected,envelope)=>{
      if(!current||current.generation!==expected.generation)return 'conflict';
      current={generation:current.generation+1,envelope};return 'updated';
    }),
  };
  const gate:FullyAuthenticatedSessionGate={assertReady:vi.fn(async()=>{})};
  return {transport,gate,current:()=>current};
}
async function enrolled(){
  const f=createFixture(),prepared=await InitialRootEnrollment.prepare(owner);
  await prepared.confirmSavedRecoveryKey(prepared.displayRecoveryKey);
  const session=await prepared.commit(f.gate,f.transport,null);
  return {...f,prepared,session};
}
function interceptDecryptedBuffers(){
  const original=crypto.subtle.decrypt.bind(crypto.subtle);
  const buffers:ArrayBuffer[]=[];
  vi.spyOn(crypto.subtle,'decrypt').mockImplementation(async(algorithm,key,data)=>{
    const result=await original(algorithm,key,data);
    buffers.push(result);
    return result;
  });
  return buffers;
}
afterEach(()=>vi.restoreAllMocks());

describe('dormant root lifecycle drops copies only when no session is returned',()=>{
  it('erases decrypted verification root on successful confirmation',async()=>{
    const p=await InitialRootEnrollment.prepare(owner);
    const buffers=interceptDecryptedBuffers();
    await p.confirmSavedRecoveryKey(p.displayRecoveryKey);
    expect(p.confirmed).toBe(true);
    expect(buffers.length).toBeGreaterThan(0);
    for(const result of buffers)
      expect(new Uint8Array(result)).toEqual(new Uint8Array(result.byteLength));
  });
  it('erases emergency recovery plaintext root when remote epoch changes',async()=>{
    const f=await enrolled();
    const saved=f.current();
    const changed={generation:2,envelope:saved!.envelope};
    vi.mocked(f.transport.read).mockResolvedValueOnce(saved).mockResolvedValueOnce(changed);
    const buffers=interceptDecryptedBuffers();
    await expect(recoverAccountRoot(owner,f.prepared.displayRecoveryKey,
      f.gate,f.transport,null)).rejects.toThrow();
    expect(buffers).toHaveLength(1);
    expect(new Uint8Array(buffers[0])).toEqual(new Uint8Array(32));
  });
  it('returns a usable root on successful recovery rather than erasing it',async()=>{
    const f=await enrolled();
    const buffers=interceptDecryptedBuffers();
    const recovered=await recoverAccountRoot(owner,f.prepared.displayRecoveryKey,
      f.gate,f.transport,null);
    expect(recovered.root).toEqual(f.session.root);
    expect(new Uint8Array(buffers[0])).toEqual(f.session.root);
  });
  it('erases remembered root copy when the server rejects its epoch',async()=>{
    const root=generateAccountRoot(),original=Array.from(root);
    let savedCopy:Uint8Array|undefined;
    Object.defineProperty(root,'slice',{value:()=>{
      savedCopy=Uint8Array.prototype.slice.call(root);
      return savedCopy;
    }});
    const devices:RememberedRootStore={
      remember:vi.fn(async()=>{}),
      unlock:vi.fn(async()=>({root,keyId:'k_'+'a'.repeat(32),generation:2})),
    };
    const transport:AtomicRootTransport={
      create:vi.fn(),replace:vi.fn(),
      read:vi.fn(async()=>({generation:1,envelope:{
        v:1,alg:'A256GCM',kid:'k_'+'a'.repeat(32),iv:'x',ct:'y',
      }})),
    };
    await expect(unlockRememberedAccountRoot(owner,
      {assertReady:async()=>{}},transport,devices)).rejects.toThrow();
    expect(savedCopy?Array.from(savedCopy):null).toEqual(Array(32).fill(0));
    expect(Array.from(root)).toEqual(original);
  });
  it('clears the pinned root when recovery replacement MFA fails',async()=>{
    const f=await enrolled();
    const root=f.session.root,original=Array.from(root);
    let savedCopy:Uint8Array|undefined;
    Object.defineProperty(root,'slice',{value:()=>{
      savedCopy=Uint8Array.prototype.slice.call(root);
      return savedCopy;
    }});
    const gate:FullyAuthenticatedSessionGate={
      assertReady:async()=>{throw new Error('MFA expired');},
    };
    await expect(RecoveryKeyReplacement.prepare(owner,f.session,gate,
      f.transport)).rejects.toThrow('MFA expired');
    expect(savedCopy?Array.from(savedCopy):null).toEqual(Array(32).fill(0));
    expect(Array.from(root)).toEqual(original);
  });
  it('erases remembered enrollment argument after local store returns',async()=>{
    const f=createFixture(),p=await InitialRootEnrollment.prepare(owner);
    await p.confirmSavedRecoveryKey(p.displayRecoveryKey);
    let localCopy:Uint8Array|undefined;
    const devices:RememberedRootStore={
      unlock:async()=>null,
      remember:async(_owner,root)=>{localCopy=root;},
    };
    const session=await p.commit(f.gate,f.transport,devices);
    expect(localCopy?Array.from(localCopy):null).toEqual(Array(32).fill(0));
    expect(session.root.some(byte=>byte!==0)).toBe(true);
    expect(await recoverAccountRoot(owner,p.displayRecoveryKey,
      f.gate,f.transport,null)).toHaveProperty('generation',1);
  });
  it('erases recovery-to-vault argument after a successful guarded recovery',async()=>{
    const f=await enrolled();
    let localCopy:Uint8Array|undefined;
    const devices:RememberedRootStore={
      unlock:async()=>null,
      remember:async(_owner,root)=>{localCopy=root;},
    };
    const recovered=await recoverAccountRoot(owner,
      f.prepared.displayRecoveryKey,f.gate,f.transport,devices);
    expect(localCopy?Array.from(localCopy):null).toEqual(Array(32).fill(0));
    expect(recovered.root).toEqual(f.session.root);
  });
});
