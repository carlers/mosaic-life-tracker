import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot } from '../../src/lib/e2ee/coreCrypto';
import { decryptPendingLegacyIntents } from '../../src/lib/e2ee/legacyPendingRecovery';
import {
  snapshotOwnerPendingQueues, sealOwnerPendingQueueSnapshot,
} from '../../src/lib/e2ee/localPendingQueueSnapshot';

const owner = { projectId: 'disposable_e2ee_project', ownerId: 'test_owner' };
function storageOf(entries: [string, string][]) {
  const data = new Map(entries);
  const storage: Pick<Storage, 'length' | 'key' | 'getItem'> = {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null,
  };
  return { storage, data };
}
const social = { id: 'profile:test_owner', userId: owner.ownerId,
  action: 'upsert_profile', attempts: 0, enqueuedAt: '2026-11-25T10:00:00Z',
  op: { kind: 'updateRow', data: { bio: 'private bio test' } }, revert: { myRowId: '' },
};
const message = { id: 'mark_read:th_test', userId: owner.ownerId,
  action: 'mark_read', attempts: 1, enqueuedAt: '2026-11-25T10:00:01Z',
  payload: { threadId: 'secret_thread' },
};
const friendship = { id: 'fr_test', ownerId: owner.ownerId, friendUserId: 'friend_test',
  operation: 'send', expectedVersion: null, enqueuedAt: Date.parse('2026-11-25'),
  attempts: 2, dependsOn: 'old', preview: { friendDisplayName: 'private_name' },
};
const single = (base: string, value: {id: string;userId:string}) =>
  [base + ':entry:' + encodeURIComponent(value.userId) + ':' +
    encodeURIComponent(value.id), JSON.stringify(value)] as [string, string];

describe('read-only local queue snapshots for source-only E2EE recovery', () => {
  it('collects all three known queue types, deduplicates matching legacy/new storage and encrypts without writes', async () => {
    const other = { ...message, userId: 'other_user' };
    const {storage,data} = storageOf([
      single('mosaic_social_outbox', social),
      ['mosaic_social_outbox', JSON.stringify([social])],
      single('mosaic_message_action_queue', message),
      single('mosaic_message_action_queue', other),
      ['mosaic_friendship_commands_v1', JSON.stringify([friendship])],
      ['unrelated_key', 'other_data'],
    ]);
    const snapshot = [...data];
    const found = snapshotOwnerPendingQueues(owner, storage);
    expect(found.map(item => item.queue).sort()).toEqual(['friendship','message-action','social']);
    expect(found.find(item => item.queue === 'friendship')?.record).toEqual(friendship);
    expect([...data]).toEqual(snapshot);
    const root = generateAccountRoot();
    const sealed = await sealOwnerPendingQueueSnapshot(owner, root, storage);
    expect(sealed).not.toContain('private bio test');
    expect(sealed).not.toContain('secret_thread');
    expect(sealed).not.toContain('private_name');
    expect(await decryptPendingLegacyIntents(owner, root, sealed)).toEqual(found);
    expect([...data]).toEqual(snapshot);
  });

  it('refuses malformed, account-mismatched, conflicted, missing and bad-key records', () => {
    const scenarios: [string,string][][] = [
      [['mosaic_friendship_commands_v1', '{broken']],
      [['mosaic_message_action_queue', JSON.stringify([{ ...message, userId: '' }])]],
      [single('mosaic_social_outbox', { ...social, id:'wrong_id' }).map((v,i)=>i===0?'mosaic_social_outbox:entry:test_owner:expected':v) as [string,string]],
      [['mosaic_social_outbox', JSON.stringify([social])],
        single('mosaic_social_outbox', {...social, attempts: 3})],
      [['mosaic_message_action_queue', JSON.stringify([{ ...message, payload: null }])]],
      [['mosaic_friendship_commands_v1', JSON.stringify([{ ...friendship, operation:'mystery' }])]],
    ];
    for (const raw of scenarios) {
      expect(() => snapshotOwnerPendingQueues(owner, storageOf(raw).storage)).toThrow('incomplete');
    }
  });

  it('fails closed if local queue changes during read, never returning partial plaintext', async () => {
    const {storage,data} = storageOf([single('mosaic_social_outbox', social)]);
    const originalRead = storage.getItem;
    let reads = 0;
    const racing = { ...storage,
      getItem: (key: string) => {
        reads++;
        if (reads === 2) data.set(key, JSON.stringify({ ...social, attempts: 8 }));
        return originalRead(key);
      },
    };
    expect(() => snapshotOwnerPendingQueues(owner, racing)).toThrow('incomplete');
    const root = generateAccountRoot();
    const original = storageOf([single('mosaic_social_outbox', social)]);
    const modified = { ...original.storage,
      getItem: vi.fn((key: string) => original.storage.getItem(key)),
    };
    const saved = await sealOwnerPendingQueueSnapshot(owner, root, modified);
    expect(saved).toContain('AES-256-GCM');
  });

  it('fails on storage exceptions or missing keys without changing the store', () => {
    const {storage,data} = storageOf([single('mosaic_social_outbox',social)]);
    expect(() => snapshotOwnerPendingQueues(owner, { ...storage, key:()=>null })).toThrow('incomplete');
    expect(() => snapshotOwnerPendingQueues(owner, {
      ...storage, getItem: () => { throw new Error('storage denied'); },
    })).toThrow();
    expect(data.size).toBe(1);
  });
});
