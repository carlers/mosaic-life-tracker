import { describe, expect, it } from 'vitest';
import { generateAccountRoot } from '../../src/lib/e2ee/coreCrypto';
import {
  encryptPendingLegacyIntents, decryptPendingLegacyIntents,
  type PendingLegacyIntent,
} from '../../src/lib/e2ee/legacyPendingRecovery';

const owner = { projectId: 'scratch_test_only', ownerId: 'disposable_owner' };
const entries: PendingLegacyIntent[] = [
  { queue: 'social', record: { id: 'social_1', userId: owner.ownerId,
    action: 'upsert_profile', payload: { bio: 'private sensitive test note' } } },
  { queue: 'message-action', record: { id: 'message_1', userId: owner.ownerId,
    action: 'unsend', payload: { text: 'recovery-only message' } } },
  { queue: 'friendship', record: { id: 'friend_1', ownerId: owner.ownerId,
    action: 'send', friendUserId: 'disposable_friend', dependsOn: 'older' } },
];

describe('encrypted local legacy pending-recovery capsule — no network', () => {
  it('roundtrips all old action domains without revealing plaintext, IDs or the root', async () => {
    const root = generateAccountRoot();
    const saved = await encryptPendingLegacyIntents(owner, root, entries);
    expect(saved).toContain('AES-256-GCM');
    for (const secret of ['private sensitive test note','recovery-only message','disposable_friend','social_1', owner.ownerId]) {
      expect(saved).not.toContain(secret);
    }
    expect(await decryptPendingLegacyIntents(owner, root, saved)).toEqual(entries);
  });

  it('denies wrong root and other project/account with no plaintext fallback', async () => {
    const root = generateAccountRoot();
    const saved = await encryptPendingLegacyIntents(owner, root, entries);
    await expect(decryptPendingLegacyIntents(owner, generateAccountRoot(), saved)).rejects.toThrow();
    await expect(decryptPendingLegacyIntents({ ...owner, ownerId: 'wrong_owner' }, root, saved)).rejects.toThrow();
    await expect(decryptPendingLegacyIntents({ ...owner, projectId: 'wrong_project' }, root, saved)).rejects.toThrow();
    await expect(decryptPendingLegacyIntents(owner, root, JSON.stringify(entries))).rejects.toThrow();
  });

  it('rejects tamper, envelope downgrade and invalid media before any action is returned', async () => {
    const root = generateAccountRoot();
    const saved = JSON.parse(await encryptPendingLegacyIntents(owner, root, entries));
    await expect(decryptPendingLegacyIntents(owner, root,
      JSON.stringify({ ...saved, version: 0 }))).rejects.toThrow();
    await expect(decryptPendingLegacyIntents(owner, root,
      JSON.stringify({ ...saved, iv: saved.iv.replace(/^./, saved.iv[0] === 'A' ? 'B' : 'A') }))).rejects.toThrow();
    await expect(decryptPendingLegacyIntents(owner, root,
      JSON.stringify({ ...saved, plaintext: 'leak' }))).rejects.toThrow();
  });

  it('rejects duplicate, cross-account, unknown actions and oversized intent sets', async () => {
    const root = generateAccountRoot();
    await expect(encryptPendingLegacyIntents(owner, root, [...entries, entries[0]])).rejects.toThrow();
    await expect(encryptPendingLegacyIntents(owner, root, [{
      queue: 'social', record: { id: 'x', userId: 'other', action: 'update' },
    }])).rejects.toThrow();
    await expect(encryptPendingLegacyIntents(owner, root,
      Array.from({length: 501}, (_, index) => ({
        queue: 'social' as const, record: {id:String(index),userId:owner.ownerId,action:'update'},
      })))).rejects.toThrow();
    await expect(encryptPendingLegacyIntents(owner, root, [{
      queue: 'unregistered' as 'social', record: { id:'x',userId:owner.ownerId,action:'update' },
    }])).rejects.toThrow();
  });

  it('uses a fresh nonce and salt for every export of the same pending data', async () => {
    const root = generateAccountRoot();
    const first = JSON.parse(await encryptPendingLegacyIntents(owner, root, entries));
    const second = JSON.parse(await encryptPendingLegacyIntents(owner, root, entries));
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
