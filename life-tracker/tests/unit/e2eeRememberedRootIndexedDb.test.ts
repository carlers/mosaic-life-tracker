import { describe, expect, it } from 'vitest';
import { indexedDbRememberedRoots } from '../../src/lib/e2ee/rememberedRootIndexedDb';
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
