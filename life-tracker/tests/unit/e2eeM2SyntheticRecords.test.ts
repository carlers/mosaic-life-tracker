import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import { assertStagedPrivateOwnerDocument } from '../../src/lib/e2ee/ownerPrivateWritePolicy';
import { prepareEncryptedOwnerMutation, OWNER_ONLY_COLLECTIONS } from '../../src/lib/e2ee/ownerCiphertextTransport';
import { syntheticDoc } from '../../src/pages/E2eeM2Page';
import { isE2eeM2SettingsLocation } from '../../src/lib/crypto/pilotRoute';

const owner = { projectId: '6b00671500279e901846', ownerId: 'synthetic_owner' };

describe('isolated M2 test UI safety and synthetic record classification', () => {
  it('enables only one exact hidden Settings route outside gesture previews', () => {
    expect(isE2eeM2SettingsLocation('/settings','?e2eeM2=1')).toBe(true);
    for (const [path, query, preview] of [
      ['/settings','?e2eeM2=0', undefined],
      ['/settings','?e2eeM2=1&e2eeM2=1', undefined],
      ['/settings','?e2eeM2=1&e2eePilot=1', undefined],
      ['/settings/data','?e2eeM2=1', undefined],
      ['/settings','?e2eeM2=1','/settings'],
      ['/', '?e2eeM2=1', undefined],
    ] as const) {
      expect(isE2eeM2SettingsLocation(path,query,preview)).toBe(false);
    }
  });

  it('builds only classified synthetic owner-private documents across all six domains', async () => {
    const session={root:generateAccountRoot(),keyId:generateKeyId(),generation:1};
    for (const collection of OWNER_ONLY_COLLECTIONS) {
      const doc=syntheticDoc(owner.ownerId,collection,'synthetic canary','local_bucket','local_task');
      expect(doc.userId).toBe(owner.ownerId);
      expect(doc.isDeleted).toBe(false);
      expect(typeof doc.id).toBe('string');
      expect(() => assertStagedPrivateOwnerDocument(collection,doc,owner)).not.toThrow();
      const sealed=await prepareEncryptedOwnerMutation(owner,session,collection,doc,null);
      const transmitted=JSON.stringify(sealed);
      expect(transmitted).not.toContain(String(doc.id));
      if(collection!=='bucketTaskLinks')expect(transmitted).not.toContain('synthetic canary');
      expect(sealed.record.rowId).toMatch(/^p_[a-f0-9]{32}$/);
      expect(sealed.record.envelope.alg).toBe('A256GCM');
    }
  });

  it('preserves semantic IDs and strips internal ciphertext revision before encrypted edit', async () => {
    const original=syntheticDoc(owner.ownerId,'tasks','initial','','');
    const next=syntheticDoc(owner.ownerId,'tasks','updated','','',{
      ...original,__e2eeRevision:'r_'+'a'.repeat(32),
    });
    expect(next.id).toBe(original.id);
    expect(next.title).toBe('updated');
    expect(next).not.toHaveProperty('__e2eeRevision');
    expect(() => assertStagedPrivateOwnerDocument('tasks',next,owner)).not.toThrow();
  });

  it('never invents task-link targets or falls back to shared visibility', () => {
    expect(() => syntheticDoc(owner.ownerId,'bucketTaskLinks','x','',''))
      .toThrow('Missing linked test records');
    for(const domain of ['tasks','categories','diary'] as const) {
      const doc=syntheticDoc(owner.ownerId,domain,'private','','');
      expect(doc.visibility).toBe('private');
    }
  });
});
