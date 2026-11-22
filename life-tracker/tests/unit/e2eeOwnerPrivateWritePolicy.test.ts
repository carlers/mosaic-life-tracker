import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import { assertStagedPrivateOwnerDocument } from '../../src/lib/e2ee/ownerPrivateWritePolicy';
import {
  commitEncryptedOwnerMutation, prepareEncryptedOwnerMutation,
  type OwnerOnlyCollection,
} from '../../src/lib/e2ee/ownerCiphertextTransport';
import { decryptOwnerDocument, DOMAIN_FOR_COLLECTION } from '../../src/lib/e2ee/ownerRecordCodec';
import { queueEncryptedOwnerIntent } from '../../src/lib/e2ee/encryptedOwnerOutbox';

const owner = { projectId: '6b00671500279e901846', ownerId: 'synthetic_owner' };
const session = () => ({ root: generateAccountRoot(), keyId: generateKeyId(), generation: 1 });
const base = { userId: owner.ownerId, isDeleted: false };
const docs: Record<OwnerOnlyCollection, Record<string, unknown>> = {
  tasks: { ...base, id: 'local_task_1', title: 'private calendar entry',
    completed: false, categoryId: 'private_category', order: 0,
    date: '2026-11-22', createdAt: '2026-11-22', updatedAt: '2026-11-22',
    visibility: 'private', image: '' },
  categories: { ...base, id: 'local_category_1', name: 'private work',
    color: '#556677', order: 0, updatedAt: '2026-11-22', visibility: 'private' },
  diary: { ...base, id: 'local_diary_1', date: '2026-11-22',
    content: 'my private synthetic diary', photos: '[]',
    visibility: 'private', createdAt: '2026-11-22', updatedAt: '2026-11-22' },
  bucketList: { ...base, id: 'local_bucket_1', title: 'private bucket goal',
    description: 'private details', achieved: false,
    achievedAt: '', createdAt: '2026-11-22', updatedAt: '2026-11-22' },
  bucketTaskLinks: { ...base, id: 'local_link_1',
    bucketListId: 'local_bucket_1', taskId: 'local_task_1',
    createdAt: '2026-11-22', updatedAt: '2026-11-22' },
  settings: { ...base, id: 'local_setting_1', key: 'dateFormat',
    value: 'private setting value', updatedAt: '2026-11-22' },
};

describe('M2 private-only write policy shared by migration and live transport', () => {
  it('encrypts the six private domains without disclosing semantic IDs or contents', async () => {
    const key = session();
    for (const collection of Object.keys(docs) as OwnerOnlyCollection[]) {
      const original = docs[collection];
      expect(() => assertStagedPrivateOwnerDocument(collection, original, owner)).not.toThrow();
      const mutation = await prepareEncryptedOwnerMutation(owner, key, collection, original, null);
      const wire = JSON.stringify(mutation);
      expect(wire).not.toContain(String(original.id));
      for (const field of ['title','name','content','description','value','bucketListId','taskId']) {
        if (typeof original[field] === 'string' && original[field]) {
          expect(wire).not.toContain(original[field] as string);
        }
      }
      const unwrapped = await decryptOwnerDocument(key.root, collection, {
        ...owner, rowId: mutation.record.rowId, revision: mutation.record.envelope.revision,
        keyId: key.keyId, payloadDomain: DOMAIN_FOR_COLLECTION[collection],
      }, mutation.record);
      expect(unwrapped).toEqual(original);
    }
  });

  it('rejects shared, inherited, or public content before creating a ciphertext intent', async () => {
    const key = session();
    for (const collection of ['tasks','categories','diary'] as const) {
      for (const visibility of ['public','followers','',undefined]) {
        await expect(prepareEncryptedOwnerMutation(owner, key, collection, {
          ...docs[collection], visibility,
        }, null)).rejects.toThrow('explicit private visibility required');
      }
    }
  });

  it('rejects legacy attachment references in direct writes, not merely in shadow snapshots', async () => {
    const key = session();
    const unsafe: Array<[OwnerOnlyCollection, Record<string, unknown>]> = [
      ['tasks', { ...docs.tasks, image: 'unencrypted_file_id' }],
      ['tasks', { ...docs.tasks, image: { fileId: 'unencrypted_file_id' } }],
      ['diary', { ...docs.diary, photos: '["unencrypted_file_id"]' }],
      ['diary', { ...docs.diary, photos: ['unencrypted_file_id'] }],
      ['settings', { ...docs.settings, key: 'wallpaperFileId' }],
    ];
    for (const [collection, doc] of unsafe) {
      await expect(prepareEncryptedOwnerMutation(owner, key, collection, doc, null))
        .rejects.toThrow('blocked');
    }
  });

  it('rejects unknown fields, wrong owner, unsafe routing and oversize source before encryption', async () => {
    const key = session();
    for (const mutation of [
      { ...docs.tasks, userId: 'foreign' },
      { ...docs.tasks, extraSecret: 'unclassified' },
      { ...docs.tasks, date: 'x'.repeat(513) },
      { ...docs.tasks, updatedAt: Number.POSITIVE_INFINITY },
      { ...docs.tasks, memo: 'x'.repeat(131073) },
      { ...docs.tasks, id: '' },
    ]) {
      await expect(prepareEncryptedOwnerMutation(owner, key, 'tasks', mutation, null))
        .rejects.toThrow('blocked');
    }
  });

  it('rejects manually constructed public ciphertext before server write or IndexedDB queue', async () => {
    const key = session();
    const valid = await prepareEncryptedOwnerMutation(owner, key, 'tasks', docs.tasks, null);
    const invalid = {
      ...valid,
      record: { ...valid.record,
        routing: { ...valid.record.routing, visibility: 'public' } },
    };
    const rpc = { send: vi.fn(async () => ({ ok: true })) };
    const gate = { assertReady: vi.fn(async () => {}) };
    await expect(commitEncryptedOwnerMutation(owner, key, invalid, rpc, gate))
      .rejects.toThrow('unavailable');
    expect(rpc.send).not.toHaveBeenCalled();
    expect(gate.assertReady).not.toHaveBeenCalled();
    await expect(queueEncryptedOwnerIntent(owner, invalid))
      .rejects.toThrow('unsafe intent');
  });
});
