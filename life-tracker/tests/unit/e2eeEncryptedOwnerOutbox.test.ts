import { describe, expect, it } from 'vitest';
import { generateAccountRoot } from '../../src/lib/e2ee/coreCrypto';
import {
  queueEncryptedOwnerIntent, listEncryptedOwnerIntents,
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
  it('requires owner/project scoping and refuses unclassified messages',async()=>{
    expect(generateAccountRoot()).toHaveLength(32);
    await expect(queueEncryptedOwnerIntent(
      {projectId:'scratch',ownerId:''},{} as never)).rejects.toThrow();
  });
});
