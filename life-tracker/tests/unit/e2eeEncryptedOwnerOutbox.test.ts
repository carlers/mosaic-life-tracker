import { describe, expect, it } from 'vitest';
import { generateAccountRoot } from '../../src/lib/e2ee/coreCrypto';
import {
  queueEncryptedOwnerIntent, listEncryptedOwnerIntents,
  rejectCompetingOwnerIntent,
} from '../../src/lib/e2ee/encryptedOwnerOutbox';
describe('source-only encrypted owner outbox safety',()=>{
  const owner={projectId:'scratch',ownerId:'synthetic'};
  it('never silently accepts missing IndexedDB or plaintext-shaped input',async()=>{
    const bad={opId:'o_'+'a'.repeat(32),expectedRevision:null,
      record:{content:'private plaintext'}};
    await expect(queueEncryptedOwnerIntent(owner,bad as never)).rejects.toThrow('unsafe intent');
    if(typeof indexedDB==='undefined') {
      await expect(listEncryptedOwnerIntents(owner)).rejects.toThrow('IndexedDB');
    }
  });
  it('blocks simultaneous offline edits to one opaque owner row',()=>{
    const id='p_'+'a'.repeat(32);
    const mutation={
      opId:'o_'+'b'.repeat(32),expectedRevision:null,
      record:{
        projectId:owner.projectId,ownerId:owner.ownerId,rowId:id,
        collection:'tasks',domain:'task',
        routing:{userId:owner.ownerId,isDeleted:false,visibility:'private'},published:{},
        envelope:{
          v:1,alg:'A256GCM',kid:'k_'+'c'.repeat(32),
          revision:'r_'+'d'.repeat(32),iv:'AAAAAAAAAAAAAAAA',ct:'A'.repeat(64),
        },
      },
    } as const;
    expect(()=>rejectCompetingOwnerIntent(owner,mutation as never,[])).not.toThrow();
    expect(()=>rejectCompetingOwnerIntent(owner,mutation as never,
      [{...mutation,opId:'o_'+'e'.repeat(32)}] as never)).toThrow('unsafe intent');
    expect(()=>rejectCompetingOwnerIntent(owner,mutation as never,
      [mutation] as never)).toThrow('unsafe intent');
  });
  it('requires owner/project scoping and refuses unclassified messages',async()=>{
    expect(generateAccountRoot()).toHaveLength(32);
    await expect(queueEncryptedOwnerIntent(
      {projectId:'scratch',ownerId:''},{} as never)).rejects.toThrow();
  });
});
