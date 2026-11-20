import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import {
  type OwnerMigrationSource, shadowMigrateOwnerSnapshot,
  derivePrivateMigrationReceipt,
} from '../../src/lib/e2ee/ownerShadowMigration';
import type { EncryptedOwnerRpc } from '../../src/lib/e2ee/ownerCiphertextTransport';
const owner={projectId:'scratch',ownerId:'synthetic_owner'};
const collections={
  tasks:[],categories:[],diary:[],bucketList:[],bucketTaskLinks:[],settings:[],
} as Record<'tasks'|'categories'|'diary'|'bucketList'|'bucketTaskLinks'|'settings',Record<string,unknown>[]>;
function source():OwnerMigrationSource {
  return {owner,completeAndFresh:true,collections:{
    ...collections,tasks:[{
      id:'local',userId:owner.ownerId,title:'private academic work',
      isDeleted:false,visibility:'private',date:'2026-11-19',
    }],
  }};
}
const session={root:generateAccountRoot(),keyId:generateKeyId(),generation:1};
const gate={assertReady:vi.fn(async()=>{})};
const rpc:EncryptedOwnerRpc={send:vi.fn(async()=>{throw new Error('network not used')})};
describe('M2 owner-private migration shadow preflight',()=>{
  it('binds the shadow migration receipt to owner root without public content hashes',async()=>{
    const original=source();
    const a=await derivePrivateMigrationReceipt(original,session.root);
    const b=await derivePrivateMigrationReceipt(source(),session.root);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain('private academic work');
    expect(await derivePrivateMigrationReceipt(original,generateAccountRoot())).not.toBe(a);
    expect(await derivePrivateMigrationReceipt({
      ...original,owner:{...owner,projectId:'other_project'},
    },session.root)).not.toBe(a);
    const modified={...original,collections:{...original.collections,tasks:[
      {...original.collections.tasks[0],title:'different private note'},
    ]}};
    expect(await derivePrivateMigrationReceipt(modified,session.root)).not.toBe(a);
    await expect(derivePrivateMigrationReceipt(original,new Uint8Array(1)))
      .rejects.toThrow('root unavailable');
  });
  it('refuses stale snapshots before any request',async()=>{
    await expect(shadowMigrateOwnerSnapshot({...source(),completeAndFresh:false},
      session,gate,rpc)).rejects.toThrow('offline or incomplete');
    expect(rpc.send).not.toHaveBeenCalled();
  });
  it('rejects shared/public content or media before any write',async()=>{
    for(const override of [
      {visibility:'public'}, {visibility:'followers'},
      {image:'private-photo-id'}, {someUnclassifiedField:'danger'},
    ]) {
      const x=source();
      const docs=x.collections.tasks as Record<string,unknown>[];
      const candidate={...x,collections:{...x.collections,tasks:[{...docs[0],...override}]}};
      await expect(shadowMigrateOwnerSnapshot(candidate,session,gate,rpc)).rejects.toThrow('blocked');
    }
    expect(rpc.send).not.toHaveBeenCalled();
  });
  it('rejects incomplete collection inventory and cross-account documents',async()=>{
    const x=source();
    const bad={...x,collections:{...x.collections,tasks:[{
      ...(x.collections.tasks[0]),userId:'foreign',
    }]}} as OwnerMigrationSource;
    await expect(shadowMigrateOwnerSnapshot(bad,session,gate,rpc)).rejects.toThrow();
    const partial={...x,collections:{tasks:[]}} as unknown as OwnerMigrationSource;
    await expect(shadowMigrateOwnerSnapshot(partial,session,gate,rpc)).rejects.toThrow();
  });
  it('blocks duplicate owner-local IDs and extreme inventories before migration',async()=>{
    const x=source(), d=x.collections.tasks[0];
    await expect(shadowMigrateOwnerSnapshot({
      ...x,collections:{...x.collections,tasks:[d,d]},
    },session,gate,rpc)).rejects.toThrow('duplicate');
    const bulk=Array.from({length:501},(_,i)=>({...d,id:'id'+i}));
    await expect(shadowMigrateOwnerSnapshot({
      ...x,collections:{...x.collections,tasks:bulk},
    },session,gate,rpc)).rejects.toThrow('limit');
  });
});
