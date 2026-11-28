import { describe, expect, it, vi } from 'vitest';
import { indexedDbRememberedRoots, forgetRememberedAccountRoot } from '../../src/lib/e2ee/rememberedRootIndexedDb';
import { generateAccountRoot } from '../../src/lib/e2ee/coreCrypto';

describe('M1 remembered-device IndexedDB source-only safety', () => {
  it('does not claim to remember a device without IndexedDB support', async () => {
    if (typeof indexedDB !== 'undefined') return;
    const owner = { projectId: 'scratch', ownerId: 'synthetic' };
    await expect(indexedDbRememberedRoots.remember(
      owner, generateAccountRoot(), 'k_' + 'a'.repeat(32), 1,
    )).rejects.toThrow('storage');
    await expect(indexedDbRememberedRoots.unlock(owner)).rejects.toThrow('storage');
  });
});


describe('remembered-device IDB handle closes on pretransaction exceptions',()=>{
  it('closes read and forget connections if IDB transaction creation throws',async()=>{
    const close=vi.fn();
    const db={close,transaction:vi.fn(()=>{
      throw new Error('synthetic database transaction unavailable');
    }),onversionchange:null as (()=>void)|null};
    vi.stubGlobal('indexedDB',{open:vi.fn(()=>{
      const request:{
        result:typeof db;onsuccess?:(()=>void);
        onerror?:(()=>void);onblocked?:(()=>void);
        onupgradeneeded?:(()=>void);
      }={result:db};
      queueMicrotask(()=>request.onsuccess?.());
      return request;
    })});
    const synthetic={projectId:'scratch',ownerId:'synthetic'};
    try{
      await expect(indexedDbRememberedRoots.unlock(synthetic))
        .rejects.toThrow('synthetic database transaction unavailable');
      expect(close).toHaveBeenCalledTimes(1);
      await expect(forgetRememberedAccountRoot(synthetic))
        .rejects.toThrow('synthetic database transaction unavailable');
      expect(close).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
});
