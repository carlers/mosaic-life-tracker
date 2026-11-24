import {describe,it,expect,vi,beforeEach} from 'vitest';
import {generateAccountRoot,generateKeyId} from '../../src/lib/e2ee/coreCrypto';
import {buildSyntheticOwnerMigrationSource} from '../../src/lib/e2ee/m2SyntheticMigrationFixture';
import {OWNER_ONLY_COLLECTIONS,commitEncryptedOwnerMutation,
  type EncryptedOwnerMutation,type EncryptedOwnerRpc,
} from '../../src/lib/e2ee/ownerCiphertextTransport';
import {derivePrivateMigrationReceipt,shadowMigrateOwnerSnapshot}
  from '../../src/lib/e2ee/ownerShadowMigration';
import {assertStagedPrivateOwnerDocument}
  from '../../src/lib/e2ee/ownerPrivateWritePolicy';

const state=vi.hoisted(()=>({pending:[] as unknown[]}));
vi.mock('../../src/lib/e2ee/encryptedOwnerOutbox',()=>({
  queueEncryptedOwnerIntent:async(_owner:unknown,mutation:unknown)=>{
    state.pending.push(mutation);
  },
  listEncryptedOwnerIntents:async()=>[...state.pending],
  replayEncryptedOwnerIntents:async(owner:unknown,session:unknown,rpc:unknown,gate:unknown)=>{
    let n=0;
    const {commitEncryptedOwnerMutation}=await import('../../src/lib/e2ee/ownerCiphertextTransport');
    for(const item of [...state.pending]) {
      const m=item as EncryptedOwnerMutation;
      await commitEncryptedOwnerMutation(owner as never,session as never,m,rpc as never,gate as never);
      state.pending.splice(state.pending.indexOf(item),1);
      n++;
    }
    return n;
  },
}));
const owner={projectId:'6b00671500279e901846',ownerId:'disposable_m2_owner'};
beforeEach(()=>{state.pending.length=0;});

describe('deterministic isolated Scratch six-domain shadow migration',()=>{
  it('never claims an account snapshot and rejects a non-Scratch project',async()=>{
    expect(()=>buildSyntheticOwnerMigrationSource({...owner,projectId:'6ae9599c002ab812f9c3'}))
      .toThrow('unavailable');
    expect(()=>buildSyntheticOwnerMigrationSource({...owner,ownerId:''}))
      .toThrow('unavailable');
    const first=buildSyntheticOwnerMigrationSource(owner);
    const second=buildSyntheticOwnerMigrationSource(owner);
    expect(first).toEqual(second);
    expect(first.completeAndFresh).toBe(true);
    expect(Object.keys(first.collections).sort()).toEqual([...OWNER_ONLY_COLLECTIONS].sort());
    for(const c of OWNER_ONLY_COLLECTIONS){
      expect(first.collections[c]).toHaveLength(1);
      const doc=first.collections[c][0];
      expect(doc.userId).toBe(owner.ownerId);
      expect(doc.id).toMatch(/^m2batch_/);
      expect(()=>assertStagedPrivateOwnerDocument(c,doc,owner)).not.toThrow();
    }
    expect(first.collections.tasks[0]).toMatchObject({
      categoryId:first.collections.categories[0].id,image:'',visibility:'private',
    });
    expect(first.collections.diary[0]).toMatchObject({photos:'[]',visibility:'private'});
    expect(first.collections.bucketTaskLinks[0]).toMatchObject({
      bucketListId:first.collections.bucketList[0].id,
      taskId:first.collections.tasks[0].id,
    });
    const root=generateAccountRoot();
    expect(await derivePrivateMigrationReceipt(first,root))
      .toBe(await derivePrivateMigrationReceipt(second,root));
  });

  it('halts on a failed second write, replays original ciphertext, and idempotently verifies all six',async()=>{
    const source=buildSyntheticOwnerMigrationSource(owner);
    const session={root:generateAccountRoot(),keyId:generateKeyId(),generation:1};
    const gate={assertReady:vi.fn(async()=>{})};
    const records=new Map<string,Record<string,unknown>>();
    const transmitted:string[]=[];
    let putCalls=0;
    let injectFailure=true;
    const rpc:EncryptedOwnerRpc={send:async(operation,input={})=>{
      if(operation==='get'){
        const row=records.get(String(input.rowId));
        if(!row)throw Object.assign(new Error('not found'),{code:404});
        return {ok:true,row:{...row,deleted:(row.routing as {isDeleted:boolean}).isDeleted}};
      }
      if(operation==='put'){
        putCalls++;
        if(injectFailure&&putCalls===2)
          throw Object.assign(new Error('synthetic connection interrupted'),{code:503});
        const data=input.record as Record<string,unknown>;
        const serialized=JSON.stringify(input);
        transmitted.push(serialized);
        if(serialized.includes('Synthetic private migration')|| serialized.includes('m2batch_'))
          throw new Error('Synthetic plaintext or semantic ID left ciphertext boundary');
        const id=String(data.rowId);
        const existing=records.get(id);
        if(!existing)records.set(id,data);
        const next=existing??data;
        return {ok:true,status:existing?'duplicate':'created',
          revision:(next.envelope as {revision:string}).revision};
      }
      throw new Error('Unexpected encrypted owner RPC');
    }};
    await expect(shadowMigrateOwnerSnapshot(source,session,gate,rpc))
      .rejects.toThrow('synthetic connection interrupted');
    expect(records.size).toBe(1);
    expect(state.pending).toHaveLength(1);
    const queued=state.pending[0] as EncryptedOwnerMutation;
    const sameOp=queued.opId, sameCipher=queued.record.envelope.ct;
    injectFailure=false;
    const resumed=await shadowMigrateOwnerSnapshot(source,session,gate,rpc);
    expect(resumed).toMatchObject({
      staged:6,verifiedExisting:2,verifiedNew:4,state:'shadow-ciphertext-only',
    });
    expect(records.size).toBe(6);
    expect(state.pending).toHaveLength(0);
    expect(transmitted.some(text=>text.includes(sameOp)&&text.includes(sameCipher))).toBe(true);
    const second=await shadowMigrateOwnerSnapshot(source,session,gate,rpc);
    expect(second).toMatchObject({
      staged:6,verifiedExisting:6,verifiedNew:0,state:'shadow-ciphertext-only',
    });
    expect(records.size).toBe(6);
    expect(gate.assertReady).toHaveBeenCalled();
  });
});
